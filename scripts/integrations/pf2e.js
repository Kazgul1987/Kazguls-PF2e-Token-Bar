const MODULE_ID = "pf2e-token-bar";
const warnedApis = new Set();

function warnOnce(api) {
  if (warnedApis.has(api)) return;
  warnedApis.add(api);
  console.warn(`${MODULE_ID} | PF2e ${api} API unavailable`);
}

/** The deliberately small boundary around PF2e's public, version-sensitive APIs. */
export class PF2eAdapter {
  static getParty() {
    return game.actors?.party ?? null;
  }

  static getPartyMembers() {
    return Array.from(this.getParty()?.members ?? []);
  }

  static requestCheck(actors) {
    const checkPrompt = game.pf2e?.gm?.checkPrompt;
    if (typeof checkPrompt !== "function") {
      warnOnce("gm.checkPrompt");
      return false;
    }
    checkPrompt({ actors });
    return true;
  }

  static async restForTheNight(actors) {
    const rest = game.pf2e?.actions?.restForTheNight;
    if (typeof rest !== "function") {
      warnOnce("actions.restForTheNight");
      return false;
    }
    await rest({ actors });
    return true;
  }

  static getConditionManager() {
    const manager = game.pf2e?.ConditionManager;
    if (!manager) warnOnce("ConditionManager");
    return manager ?? null;
  }
}
