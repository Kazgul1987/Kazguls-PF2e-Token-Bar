export class QuestLogIntegration {
  static get active() {
    return game.modules.get("forien-quest-log")?.active === true;
  }

  static open() {
    if (!this.active) return false;
    Hooks.callAll("ForienQuestLog.Open.QuestLog");
    return true;
  }
}

export class PointsTrackerIntegration {
  static get active() {
    return game.modules.get("pf2e-points-tracker")?.active === true;
  }

  static get opener() {
    if (!this.active) return null;
    if (typeof game.pf2ePointsTracker?.open === "function") {
      return () => game.pf2ePointsTracker.open();
    }
    if (typeof globalThis.openResearchTracker === "function") {
      return () => globalThis.openResearchTracker();
    }
    return null;
  }

  static open() {
    const open = this.opener;
    if (!open) return false;
    open();
    return true;
  }
}
