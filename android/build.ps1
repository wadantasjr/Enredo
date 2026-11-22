[CmdletBinding()]
param(
    [string]$AndroidSdk = $env:ANDROID_SDK_ROOT,
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$BuildToolsVersion = '34.0.0'
)

$ErrorActionPreference = 'Stop'
$platformVersion = '36'
$minSdk = '26'

function Invoke-BuildTool {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$(Split-Path -Leaf $Executable) terminou com código $LASTEXITCODE."
    }
}

$unityEditors = Join-Path $env:ProgramFiles 'Unity/Hub/Editor'
$unityAndroid = @(Get-ChildItem -LiteralPath $unityEditors -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'Editor/Data/PlaybackEngines/AndroidPlayer' })

if (!$AndroidSdk) {
    $sdkCandidates = @($env:ANDROID_HOME, (Join-Path $env:LOCALAPPDATA 'Android/Sdk')) +
        @($unityAndroid | ForEach-Object { Join-Path $_ 'SDK' })
    $AndroidSdk = $sdkCandidates | Where-Object {
        $_ -and (Test-Path -LiteralPath (Join-Path $_ "platforms/android-$platformVersion/android.jar")) -and
        (Test-Path -LiteralPath (Join-Path $_ "build-tools/$BuildToolsVersion/aapt2.exe"))
    } | Select-Object -First 1
}
if (!$AndroidSdk) { throw 'Informe -AndroidSdk com o caminho do Android SDK (plataforma 36 e Build Tools 34.0.0).' }

if (!$JavaHome) {
    $javac = Get-Command javac.exe -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    $javaCandidates = @($unityAndroid | ForEach-Object { Join-Path $_ 'OpenJDK' })
    if ($javac) { $javaCandidates = @((Split-Path -Parent (Split-Path -Parent $javac.Source))) + $javaCandidates }
    $JavaHome = $javaCandidates | Where-Object {
        Test-Path -LiteralPath (Join-Path $_ 'bin/keytool.exe')
    } | Select-Object -First 1
}
if (!$JavaHome) { throw 'Informe -JavaHome com o caminho para o JDK 11 ou 17.' }

$AndroidSdk = (Resolve-Path -LiteralPath $AndroidSdk).Path
$JavaHome = (Resolve-Path -LiteralPath $JavaHome).Path
$tools = Join-Path $AndroidSdk "build-tools/$BuildToolsVersion"
$platformJar = Join-Path $AndroidSdk "platforms/android-$platformVersion/android.jar"
$lambdaStubs = Join-Path $tools 'core-lambda-stubs.jar'
$app = Join-Path $PSScriptRoot 'app/src/main'
$webRoot = Split-Path -Parent $PSScriptRoot
$output = Join-Path $PSScriptRoot 'Enredo.apk'

foreach ($requiredFile in @($platformJar, $lambdaStubs, "$tools/aapt2.exe", "$tools/d8.bat", "$tools/zipalign.exe",
        "$tools/apksigner.bat", "$JavaHome/bin/javac.exe", "$JavaHome/bin/jar.exe", "$JavaHome/bin/keytool.exe")) {
    if (!(Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw "Arquivo necessário ausente. $requiredFile" }
}

$buildRoot = New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'build')
$work = New-Item -ItemType Directory -Path (Join-Path $buildRoot.FullName ([guid]::NewGuid().ToString('N')))
$signing = New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot '.signing')
$key = Join-Path $signing.FullName 'enredo-debug.jks'
$previousJavaHome = $env:JAVA_HOME
$env:JAVA_HOME = $JavaHome

try {
    Push-Location -LiteralPath $work.FullName
    try {
        New-Item -ItemType Directory -Path generated, classes, dex | Out-Null

        Invoke-BuildTool "$tools/aapt2.exe" @('compile', '--dir', "$app/res", '-o', 'resources.zip')
        Invoke-BuildTool "$tools/aapt2.exe" @('link', '-I', $platformJar, '--manifest', "$app/AndroidManifest.xml",
            '--java', 'generated', '-o', 'unsigned.apk', 'resources.zip')

        $sources = @(Get-ChildItem -LiteralPath "$app/java", 'generated' -Filter '*.java' -File -Recurse |
            ForEach-Object { $_.FullName })
        Invoke-BuildTool "$JavaHome/bin/javac.exe" (@('-encoding', 'UTF-8', '-source', '8', '-target', '8',
            '-bootclasspath', "$lambdaStubs;$platformJar", '-d', 'classes') + $sources)
        Invoke-BuildTool "$JavaHome/bin/jar.exe" @('cf', 'classes.jar', '-C', 'classes', '.')
        Invoke-BuildTool "$tools/d8.bat" @('--release', '--min-api', $minSdk, '--lib', $platformJar,
            '--output', 'dex', 'classes.jar')

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $unsigned = [IO.Compression.ZipFile]::Open((Join-Path $work.FullName 'unsigned.apk'), 'Update')
        try {
            # AssetManager uses forward slashes even when the APK is built on Windows.
            $webFiles = @(Get-Item -LiteralPath (Join-Path $webRoot 'index.html')) +
                @(Get-ChildItem -LiteralPath (Join-Path $webRoot 'web') -File -Recurse)
            foreach ($webFile in $webFiles) {
                $assetPath = [IO.Path]::GetRelativePath($webRoot,$webFile.FullName).Replace('\','/')
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                    $unsigned, $webFile.FullName, "assets/$assetPath", 'Optimal') | Out-Null
            }
            foreach ($dex in Get-ChildItem -LiteralPath 'dex' -Filter 'classes*.dex' -File) {
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                    $unsigned, $dex.FullName, $dex.Name, 'NoCompression') | Out-Null
            }
        } finally {
            $unsigned.Dispose()
        }

        if (!(Test-Path -LiteralPath $key)) {
            Invoke-BuildTool "$JavaHome/bin/keytool.exe" @('-genkeypair', '-keystore', $key, '-storetype', 'JKS',
                '-storepass', 'android', '-keypass', 'android', '-alias', 'enredo-debug', '-keyalg', 'RSA',
                '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Enredo Debug, O=Enredo, C=BR')
        }
        Invoke-BuildTool "$tools/zipalign.exe" @('-f', '4', 'unsigned.apk', 'aligned.apk')
        Invoke-BuildTool "$tools/apksigner.bat" @('sign', '--ks', $key, '--ks-key-alias', 'enredo-debug',
            '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--v4-signing-enabled', 'false',
            '--out', 'Enredo.apk', 'aligned.apk')
        Invoke-BuildTool "$tools/apksigner.bat" @('verify', '--verbose', 'Enredo.apk')
        Invoke-BuildTool "$tools/zipalign.exe" @('-c', '4', 'Enredo.apk')
        Move-Item -LiteralPath 'Enredo.apk' -Destination $output -Force
    } finally {
        Pop-Location
    }
} finally {
    $env:JAVA_HOME = $previousJavaHome
    $resolvedWork = Get-Item -LiteralPath $work.FullName
    if ($resolvedWork.Parent.FullName -eq $buildRoot.FullName -and $resolvedWork.Name -match '^[a-f0-9]{32}$') {
        Remove-Item -LiteralPath $resolvedWork.FullName -Recurse -Force
    }
}

Write-Output $output
