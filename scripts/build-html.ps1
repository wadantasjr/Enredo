[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '../dist/Enredo.html')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$page = [IO.File]::ReadAllText((Join-Path $root 'index.html'))

$page = [regex]::Replace($page, '<script src="(web/js/[a-z0-9-]+\.js)"></script>', {
    param($reference)
    $script = [IO.File]::ReadAllText((Join-Path $root $reference.Groups[1].Value))
    if ($script -match '</script') { throw "Invalid inline script: $($reference.Groups[1].Value)" }
    "<script>`n$script</script>"
})

$page = [regex]::Replace($page, '<link rel="stylesheet" href="(web/css/[a-z0-9-]+\.css)">', {
    param($reference)
    $stylesheet = [IO.File]::ReadAllText((Join-Path $root $reference.Groups[1].Value))
    if ($stylesheet -match '</style') { throw "Invalid inline stylesheet: $($reference.Groups[1].Value)" }
    "<style>`n$stylesheet</style>"
})

if ($page -match '(?:src|href)="web/') { throw 'The portable HTML still references a local asset.' }
$output = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$null = [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output))
[IO.File]::WriteAllText($output,$page,[Text.UTF8Encoding]::new($false))
Write-Output $output
