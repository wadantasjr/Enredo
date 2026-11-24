Enredo.preferences = ((app) => {
  'use strict';

  const { esc, $, field, icon, option, bindActions } = app.dom;

  const languageKey = 'enredo.language';

  const fontSizeKey = 'enredo.font-size';

  const fontSizes = [75,85,100,115,130];
  const thumbnailSizeKey = 'enredo.thumbnail-size';
  const thumbnailSizes = ['1','2','3','hidden'];
  const diagramWiresKey = 'enredo.diagram-wires';
  const diagramViews = [['timeline','timeline'],['whole-story','wholeStory']];
  const wireWidths = [1,1.5,2,3,4,5,6];

  const themeKey = 'enredo.theme';

  const themePreferences = ['light','dark','system'];

  const themeMedia = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readThemePreference(storage = localStorage) {
    try {
      const saved = storage.getItem(themeKey);
      return themePreferences.includes(saved) ? saved : 'light';
    } catch {}
    return 'light';
  }

  let themePreference = readThemePreference();

  function resolveTheme(preference, media = themeMedia) {
    return preference === 'dark' || (preference === 'system' && media?.matches) ? 'dark' : 'light';
  }

  function applyTheme(preference = themePreference) {
    const valid = themePreferences.includes(preference) ? preference : 'light';
    const resolved = resolveTheme(valid);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = valid;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#17151d' : '#f7f6fb');
    return resolved;
  }

  function setThemePreference(next) {
    if (!themePreferences.includes(next)) return false;
    themePreference = next;
    try { localStorage.setItem(themeKey,next); } catch {}
    applyTheme();
    return true;
  }

  function setupThemeListener() {
    if (!themeMedia) return;
    const update = () => { if (themePreference === 'system') applyTheme(); };
    if (themeMedia.addEventListener) themeMedia.addEventListener('change',update);
    else if (themeMedia.addListener) themeMedia.addListener(update);
  }

  let language = readLanguage();

  let fontSize = readFontSize();
  let thumbnailSize = readThumbnailSize();
  let wireStyles = readWireStyles();

  function readFontSize() {
    try {
      const saved = Number(localStorage.getItem(fontSizeKey));
      if (fontSizes.includes(saved)) return saved;
    } catch {}
    return app.platform.android ? 85 : 100;
  }

  function readThumbnailSize() {
    try {
      const saved = localStorage.getItem(thumbnailSizeKey);
      if (thumbnailSizes.includes(saved)) return saved;
    } catch {}
    return '1';
  }

  function wireStyle(color,width) {
    return {
      color:typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color : null,
      width:wireWidths.includes(width) ? width : null
    };
  }

  function readWireStyles() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(diagramWiresKey)); } catch {}
    return Object.fromEntries(diagramViews.map(([view]) =>
      [view,wireStyle(saved?.[view]?.color,saved?.[view]?.width)]));
  }

  function readLanguage() {
    try {
      const saved = localStorage.getItem(languageKey);
      if (saved === 'pt' || saved === 'en') return saved;
    } catch {}
    return app.platform.android && /^pt\b/i.test(navigator.language) ? 'pt' : 'en';
  }

  function t(key, values = {}) {
    return app.messages[key][language === 'pt' ? 1 : 0].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }

  const tx = (key, values) => esc(t(key, values));

  let toastTimer;

  let toastKey;

  function renderThemeControls() {
    const button = $('themeButton');
    if (!button) return;
    const themeIcon = {light:'sun',dark:'moon',system:'monitor'}[themePreference];
    button.innerHTML = icon(themeIcon);
    button.title = t('theme');
    button.setAttribute('aria-label',t('theme'));
    document.querySelectorAll('[data-theme-choice]').forEach(option => {
      const current = option.dataset.themeChoice === themePreference;
      option.classList.toggle('current',current);
      option.setAttribute('aria-checked',current);
    });
  }

  function changeTheme(next) {
    if (!setThemePreference(next)) return;
    renderThemeControls();
  }

  function flash(key) {
    const toast = $('toast');
    toastKey = key;
    toast.textContent = t(key);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; },3000);
  }

  function renderLanguage() {
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
    document.title = t('pageTitle');
    $('languageSelect').value = language;
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-label]').forEach(element => {
      element.setAttribute('aria-label',t(element.dataset.i18nLabel));
    });
    $('imageViewerPhoto').alt = t('nodeImage');
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const shortcut = app.platform.android ? null : element.dataset.shortcut;
      element.title = t(element.dataset.i18nTitle) + (shortcut ? ' (' + shortcut + ')' : '');
    });
    renderThemeControls();
    $('legend').innerHTML = app.storyData.kinds.map(kind =>
      '<span class="legend-item" data-kind="' + kind + '"><i></i>' + tx(kind) + '</span>').join('');
    app.workspace.renderWorkspaceControls();
    app.store.renderSaveStatus();
    if (toastKey && !$('toast').hidden) $('toast').textContent = t(toastKey);
  }

  function changeLanguage(next) {
    if (next === language || (next !== 'en' && next !== 'pt')) return;
    language = next;
    try {
      localStorage.setItem(languageKey,language);
    } catch {}
    renderLanguage();
    app.workspace.render();
  }

  function applyFontSize() {
    document.documentElement.style.fontSize = fontSize + '%';
  }

  function wireSettings(view,label) {
    const {color,width} = wireStyles[view];
    const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--wire').trim();
    const colorInput = '<input type="color" name="' + view + '-color" value="' + esc(color ?? defaultColor) +
      '"' + (color === null ? ' disabled' : '') + '>';
    const widths = option('',t('arrowWidthDefault'),width === null) +
      wireWidths.map(size => option(size,size.toLocaleString(language) + ' px',size === width)).join('');
    return '<fieldset class="display-wire-settings"><legend>' + tx(label) + '</legend>' +
      '<div class="display-settings-grid">' +
      field(t('arrowColor'),colorInput) +
      field(t('arrowWidth'),'<select name="' + view + '-width">' + widths + '</select>') + '</div>' +
      '<label class="display-theme-color"><input type="checkbox" name="' + view + '-theme"' +
      (color === null ? ' checked' : '') + '> ' + tx('useThemeColor') + '</label></fieldset>';
  }

  function saveDisplaySettings(data) {
    const nextFontSize = Number(data.get('fontSize'));
    const nextThumbnailSize = data.get('thumbnailSize');
    if (!fontSizes.includes(nextFontSize) || !thumbnailSizes.includes(nextThumbnailSize)) return;

    const thumbnailsChanged = nextThumbnailSize !== thumbnailSize;
    fontSize = nextFontSize;
    thumbnailSize = nextThumbnailSize;
    wireStyles = Object.fromEntries(diagramViews.map(([view]) => [
      view,wireStyle(data.get(view + '-color'),Number(data.get(view + '-width')))
    ]));
    try {
      localStorage.setItem(fontSizeKey,String(fontSize));
      localStorage.setItem(thumbnailSizeKey,thumbnailSize);
      localStorage.setItem(diagramWiresKey,JSON.stringify(wireStyles));
    } catch {}
    applyFontSize();
    if (thumbnailsChanged) app.diagram.refreshThumbnailSize();
    else if (!app.session.atHome && app.session.hasMapView() && app.store.chapter()) app.diagram.renderWires();
    app.dialogs.closeDialog();
  }

  function editDisplaySettings() {
    const fonts = fontSizes.map(size => option(size,size + '%',size === fontSize)).join('');
    const thumbnails = thumbnailSizes.map(size =>
      option(size,size === 'hidden' ? t('hideThumbnails') : size + 'x',size === thumbnailSize)).join('');
    const body = '<div class="display-settings-grid">' +
      field(t('fontSize'),'<select name="fontSize">' + fonts + '</select>') +
      field(t('thumbnailSize'),'<select name="thumbnailSize">' + thumbnails + '</select>') + '</div>' +
      diagramViews.map(([view,label]) => wireSettings(view,label)).join('');
    app.dialogs.showDialog({
      title:t('displaySettings'),body,submitKey:'save',onSubmit:saveDisplaySettings,
      extra:form => {
        for (const [view] of diagramViews) {
          const useTheme = form.elements.namedItem(view + '-theme');
          const color = form.elements.namedItem(view + '-color');
          useTheme.addEventListener('change',() => { color.disabled = useTheme.checked; });
        }
      }
    });
  }

  function bindEvents() {
    bindActions({displaySettingsButton:editDisplaySettings});
    $('languageSelect').addEventListener('change',event => changeLanguage(event.target.value));
    document.addEventListener('click',event => {
      const choice = event.target.closest('button[data-theme-choice]');
      if (choice) changeTheme(choice.dataset.themeChoice);
    });
  }

  return {
    applyFontSize,
    applyTheme,
    bindEvents,
    diagramWires: view => wireStyles[view],
    flash,
    get fontSize() { return fontSize; },
    get language() { return language; },
    get thumbnailScale() { return thumbnailSize === 'hidden' ? 0 : Number(thumbnailSize); },
    renderLanguage,
    setupThemeListener,
    t,
    tx
  };
})(Enredo);
