Enredo.dialogs = ((app) => {
  'use strict';

  const { $, esc, bindActions } = app.dom;
  const { tx, t } = app.preferences;

  function showDialog({title,body,submitKey,onSubmit,remove,extra,className = '',danger = submitKey === 'delete'}) {
    app.workspace.closeMenus();
    $('dialog').className = className;
    const form = $('dialogForm');
    $('dialogTitle').textContent = title;
    form.innerHTML = body + '<div class="dialog-actions">' +
      (remove ? '<button type="button" class="btn danger" id="dialogRemove">' + tx('delete') + '</button>' : '') +
      '<button type="button" class="btn" id="dialogCancel">' + tx(onSubmit ? 'cancel' : 'close') + '</button>' +
      (onSubmit ? '<button class="btn ' + (danger ? 'danger' : 'primary') + '" type="submit">' + tx(submitKey) + '</button>' : '') +
      '</div>';
    form.onsubmit = event => {
      event.preventDefault();
      onSubmit?.(new FormData(form));
    };
    $('dialogCancel').onclick = closeDialog;
    if (remove) $('dialogRemove').onclick = remove;
    extra?.(form);
    app.imageEditor.renderCoverPreviews(form);
    if (!$('dialog').open) $('dialog').showModal();
    const first = form.querySelector('input:not([hidden]), select');
    if (first) {
      first.focus();
      if (first.type === 'text') first.select();
    }
  }

  function closeDialog() {
    $('dialog').close();
    $('dialog').className = '';
  }

  function confirmation(title,message,onConfirm,{submitKey = 'delete',danger = true} = {}) {
    showDialog({title,body:'<p>' + esc(message) + '</p>',submitKey,danger,onSubmit:() => {
      closeDialog();
      onConfirm();
    }});
    $('dialogCancel').focus();
  }

  function showHelp() {
    const helpItems = ['helpHome','helpChapter','helpCovers','helpImageGallery','helpPath','helpStory','helpMapGrouping','helpMapBackground','helpStructure','helpCharacters','helpManagement',
      app.platform.android ? 'touchHelpZoom' : 'helpZoom',app.platform.android ? 'deviceHelpFiles' : 'helpFiles'];
    const body = '<ul>' + helpItems.map(key => '<li>' + t(key) + '</li>').join('') + '</ul>';
    showDialog({title:t('helpTitle'),body});
  }

  function bindEvents() {
    bindActions({dialogClose:closeDialog,helpButton:showHelp,fileHelp:showHelp});
  }

  return {
    bindEvents,
    closeDialog,
    confirmation,
    showDialog
  };
})(Enredo);
