const MODULE_ID = "xdy-pf2e-workbench";

export class WorkbenchIntegration {
  static get active() {
    return game.modules.get(MODULE_ID)?.active === true;
  }

  static async executeMacro(macroName, ...args) {
    if (!this.active) return false;

    const worldMacro = game.macros?.getName?.(macroName)
      ?? game.macros?.find(document => document?.name === macroName);
    if (worldMacro?.execute) {
      await worldMacro.execute(...args);
      return true;
    }

    for (const pack of game.packs.filter(pack => pack.documentName === "Macro")) {
      const index = await pack.getIndex();
      const entry = index.find(item => item.name === macroName);
      if (!entry) continue;
      const macro = await pack.getDocument(entry._id);
      if (!macro?.execute) continue;
      await macro.execute(...args);
      return true;
    }

    return false;
  }
}
