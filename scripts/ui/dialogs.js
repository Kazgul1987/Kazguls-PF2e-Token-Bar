function dialogRoot(dialog) {
  return dialog.element;
}

/** Native-DOM facade for Foundry V14's DialogV2. */
export class ModuleDialog {
  static prompt({ title, content, label, onRender, callback }) {
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content,
      ok: {
        label,
        callback: (_event, _button, dialog) => callback?.(dialogRoot(dialog)),
      },
      render: (_event, dialog) => onRender?.(dialogRoot(dialog)),
      rejectClose: false,
    });
  }

  static confirm({ title, content }) {
    return foundry.applications.api.DialogV2.confirm({
      window: { title },
      content,
      rejectClose: false,
    });
  }
}
