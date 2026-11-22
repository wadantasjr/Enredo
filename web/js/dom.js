globalThis.Enredo = {};

Enredo.dom = (() => {
  'use strict';

  const icons = {
    expand: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
    contract: '<path d="M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5"/>',
    sidePanel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M6 13h5a7 7 0 0 0 7-5"/>',
    book: '<path d="M12 6a8 8 0 0 0-9-2v15a9 9 0 0 1 9 1 9 9 0 0 1 9-1V4a8 8 0 0 0-9 2zm0 0v14"/>',
    home: '<path d="m3 10 9-7 9 7M5 9v11h14V9m-10 11v-6h6v6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20.5 15.3A8.5 8.5 0 0 1 8.7 3.5 8.5 8.5 0 1 0 20.5 15.3Z"/>',
    monitor: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8m-4-3v3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-4 3 2 4-5 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 6 6 6-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 2.8c-.8.3-1 1.2-1 2.2m0 3h.01"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
    upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 16v4h16v-4"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L5 15z"/>',
    timeline: '<path d="M3 12h18M7 12V5m5 7v7m5-7V5"/>',
    undo: '<path d="M9 5l-5 5 5 5m-5-5h10a5 5 0 0 1 0 10h-2"/>',
    redo: '<path d="m15 5 5 5-5 5m5-5H10a5 5 0 0 0 0 10h2"/>',
    link: '<path d="m10 13 4-4m-7 2-2 2a4 4 0 0 0 6 6l2-2m-2-10 2-2a4 4 0 0 1 6 6l-2 2"/>',
    layout: '<rect x="2" y="9" width="6" height="6" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M8 12h4m4-7h-4v14h4"/>',
    fit: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.7-2.3L4 14a1.5 1.5 0 0 1 2.2-2L8 14"/>',
    device: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    scene: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8m-8 5h6"/>',
    decision: '<path d="m12 2 10 10-10 10L2 12z"/><path d="M10 9a2 2 0 1 1 3.2 1.6A2.8 2.8 0 0 0 12 13m0 3h.01"/>',
    outcome: '<path d="m12 3 2.3 5.7 6.2.5-4.8 4 1.5 6-5.2-3.3-5.2 3.3 1.5-6-4.8-4 6.2-.5z"/>',
    merge: '<circle cx="5" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 5c5 0 3 7 10 7M7 19c5 0 3-7 10-7"/>',
    ending: '<path d="M5 21V4m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
    panel: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 4v16m3-11h4m-4 4h3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13m-8 4v5m4-5v5"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.2a3 3 0 0 1 0 5.6m2 3.2a5 5 0 0 1 3 4.6V20"/>',
    tasks: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 8 1 1 2-2m2 1h3m-8 7 1 1 2-2m2 1h3"/>'
  };

  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';

  const $ = id => document.getElementById(id);

  const esc = value => String(value).replace(/[&<>"'\r]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','\r':'&#13;'
  }[c]));

  const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

  const number = index => String(index + 1).padStart(2,'0');

  function field(label,control) {
    return '<label class="field"><span>' + esc(label) + '</span>' + control + '</label>';
  }

  function input(name,value = '',placeholder = '',required = false) {
    return '<input name="' + name + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) +
      '" maxlength="120"' + (required ? ' required' : '') + '>';
  }

  function option(value,label,selected = false) {
    return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function renderIcons() {
    document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
  }

  function bindActions(actions) {
    for (const [id,action] of Object.entries(actions)) $(id).addEventListener('click',action);
  }

  return {
    $,
    bindActions,
    esc,
    field,
    icon,
    input,
    number,
    option,
    renderIcons,
    uid
  };
})();
