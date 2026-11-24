Enredo.projectSummary = ((app) => {
  'use strict';

  const { $, icon, option } = app.dom;
  const { t } = app.preferences;
  const tags = new Set(['div','p','br','b','strong','i','em','u','ul','ol','li']);
  const ignoredTags = new Set(['script','style','template']);
  const linkHref = (kind,id) => '#enredo-summary-' + kind + '/' + encodeURIComponent(JSON.stringify(id));
  const isStoryLink = href => /^#enredo-summary-(group|chapter|beat)\//.test(href ?? '');

  function render(value, resolveLink = href => href) {
    const fragment = document.createDocumentFragment();
    if (typeof value !== 'string' || !value.trim()) return fragment;

    const template = document.createElement('template');
    template.innerHTML = value;

    // Build fresh elements so imported and pasted text cannot carry scripts, styles or external URLs.
    function appendChildren(source,parent) {
      for (const child of source.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          parent.append(child.textContent);
        } else if (child.namespaceURI === 'http://www.w3.org/1999/xhtml' && !ignoredTags.has(child.localName)) {
          const tag = child.localName;
          const href = tag === 'a' ? child.getAttribute('href') : null;
          const target = isStoryLink(href) ? resolveLink(href) : null;
          if (tags.has(tag) || target) {
            const element = document.createElement(tag);
            if (target) element.setAttribute('href',target);
            appendChildren(child,element);
            parent.append(element);
          } else appendChildren(child,parent);
        }
      }
    }

    appendChildren(template.content,fragment);
    return fragment;
  }

  function serialize(fragment) {
    const root = document.createElement('div');
    root.append(fragment);
    return root.innerHTML;
  }

  function normalize(value) {
    const content = render(value);
    return content.textContent.trim() ? serialize(content) : '';
  }

  function save(project,editor) {
    const value = normalize(editor.innerHTML);
    if (value) project.summary = value;
    else delete project.summary;
  }

  function destinations(project) {
    const title = item => item.title.trim() || t('untitled');
    const chapters = new Map(project.chapters.map(chapter => [chapter.id,title(chapter)]));
    return [
      ['groups',(project.chapterGroups ?? []).map(group => ({kind:'group',id:group.id,label:title(group)}))],
      ['chapters',project.chapters.map(chapter => ({kind:'chapter',id:chapter.id,label:chapters.get(chapter.id)}))],
      ['summaryBeats',project.nodes.map(node => ({kind:'beat',id:node.id,chapter:node.chapter,
        label:chapters.get(node.chapter) + ' / ' + title(node)}))]
    ];
  }

  function translatedTemplate(id) {
    const root = document.importNode($(id).content,true).firstElementChild;
    root.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    root.querySelectorAll('[data-i18n-label]').forEach(node => node.setAttribute('aria-label',t(node.dataset.i18nLabel)));
    root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
    return root;
  }

  function mountEditor(container,project) {
    const controls = translatedTemplate('projectSummaryEditorTemplate');
    const editor = controls.querySelector('[contenteditable]');
    const toolbar = controls.querySelector('.story-summary-toolbar');
    const picker = controls.querySelector('.story-summary-link-picker');
    const select = picker.querySelector('select');
    const choose = toolbar.querySelector('[data-summary-choose-link]');
    const insert = picker.querySelector('[data-summary-insert-link]');
    let selectionRange;

    editor.append(render(project.summary));
    select.innerHTML = option('',t('summaryChooseTarget'),true);
    for (const [label,items] of destinations(project)) {
      if (!items.length) continue;
      const group = document.createElement('optgroup');
      group.label = t(label);
      group.innerHTML = items.map(item => option(linkHref(item.kind,item.id),item.label)).join('');
      select.append(group);
    }
    choose.disabled = select.options.length < 2;

    function saveSelection() {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) selectionRange = range.cloneRange();
    }

    function restoreSelection() {
      editor.focus({preventScroll:true});
      if (!selectionRange || !editor.contains(selectionRange.commonAncestorContainer)) {
        selectionRange = document.createRange();
        selectionRange.selectNodeContents(editor);
        selectionRange.collapse(false);
      }
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(selectionRange.cloneRange());
    }

    function currentLink() {
      const node = selectionRange?.startContainer;
      const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      const link = element?.closest('a');
      return link && editor.contains(link) ? link : null;
    }

    function selectCurrentLink() {
      const link = selectionRange?.collapsed && currentLink();
      if (link) {
        selectionRange.selectNodeContents(link);
        restoreSelection();
      }
    }

    function formatList(command) {
      const {collapsed,startContainer,startOffset} = selectionRange;
      const caretInText = collapsed && startContainer.nodeType === Node.TEXT_NODE;
      let offset;
      if (caretInText) {
        const beforeCaret = document.createRange();
        beforeCaret.selectNodeContents(editor);
        beforeCaret.setEnd(startContainer,startOffset);
        offset = beforeCaret.toString().length;
      }
      document.execCommand(command);
      if (!caretInText) return;

      // Creating a list can move the caret to the start of the item it just wrapped.
      const text = document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);
      for (let node = text.nextNode(); node; node = text.nextNode()) {
        if (offset < node.length || (offset === node.length && startOffset > 0)) {
          window.getSelection().collapse(node,offset);
          return;
        }
        offset -= node.length;
      }
    }

    function closePicker() {
      picker.hidden = true;
      choose.setAttribute('aria-expanded','false');
      restoreSelection();
    }

    toolbar.addEventListener('pointerdown',event => {
      if (!event.target.closest('button')) return;
      saveSelection();
      if (event.pointerType === 'mouse') event.preventDefault();
    });
    editor.addEventListener('focusout',saveSelection);
    toolbar.addEventListener('click',event => {
      const command = event.target.closest('[data-summary-command]')?.dataset.summaryCommand;
      if (!command) return;
      saveSelection();
      restoreSelection();
      if (command === 'unlink') selectCurrentLink();
      if (command === 'insertOrderedList' || command === 'insertUnorderedList') formatList(command);
      else document.execCommand(command);
      saveSelection();
    });
    choose.addEventListener('click',() => {
      if (!picker.hidden) return closePicker();
      saveSelection();
      picker.hidden = false;
      choose.setAttribute('aria-expanded','true');
      select.value = currentLink()?.getAttribute('href') ?? '';
      if (select.selectedIndex < 0) select.selectedIndex = 0;
      insert.disabled = !select.value;
      select.focus();
    });
    select.addEventListener('change',() => { insert.disabled = !select.value; });
    picker.querySelector('[data-summary-cancel-link]').addEventListener('click',closePicker);
    insert.addEventListener('click',() => {
      if (!select.value) return;
      const href = select.value;
      const label = select.selectedOptions[0].textContent;
      closePicker();
      selectCurrentLink();
      if (selectionRange.collapsed) {
        const link = document.createElement('a');
        link.setAttribute('href',href);
        link.textContent = label;
        document.execCommand('insertHTML',false,link.outerHTML);
      } else document.execCommand('createLink',false,href);
      saveSelection();
    });
    editor.addEventListener('paste',event => {
      event.preventDefault();
      const html = render(event.clipboardData?.getData('text/html'));
      if (html.textContent.trim()) document.execCommand('insertHTML',false,serialize(html));
      else document.execCommand('insertText',false,event.clipboardData?.getData('text/plain') ?? '');
    });
    editor.addEventListener('drop',event => event.preventDefault());
    container.append(controls);
    return editor;
  }

  function editDialog(project) {
    let editor;
    app.dialogs.showDialog({title:t('editStorySummary'),className:'story-summary-dialog',body:'<div class="fields"></div>',submitKey:'save',
      extra:form => { editor = mountEditor(form.firstElementChild,project); },onSubmit:() => {
        app.dialogs.closeDialog();
        app.store.edit(() => save(project,editor));
        $('presentationContent').querySelector('[data-edit-project-summary]')?.focus({preventScroll:true});
      }});
    editor.focus();
  }

  function overviewSection(project) {
    const section = translatedTemplate('projectSummaryOverviewTemplate');
    const content = section.querySelector('.story-summary-content');
    const targets = new Map(destinations(project).flatMap(([,items]) =>
      items.map(item => [linkHref(item.kind,item.id),item])));
    content.append(render(project.summary,href => targets.has(href) ? href : null));
    section.querySelector('.hint').hidden = !!content.textContent.trim();
    section.querySelector('[data-edit-project-summary]').addEventListener('click',() => editDialog(project));
    content.addEventListener('click',event => {
      const href = event.target.closest('a')?.getAttribute('href');
      const target = targets.get(href);
      if (!target) return;
      event.preventDefault();
      if (target.kind === 'group') app.chapterGroups.openGroup(target.id);
      else if (target.kind === 'chapter') app.workspace.navigate(project.id,target.id);
      else {
        app.workspace.navigate(project.id,target.chapter);
        app.workspace.inspect(target.id,true);
      }
    });
    return section;
  }

  return {linkHref,mountEditor,normalize,overviewSection,render,save};
})(Enredo);
