const MODULE_ID = "pf2e-token-bar";
const warnedApis = new Set();

function warnOnce(api) {
  if (warnedApis.has(api)) return;
  warnedApis.add(api);
  console.warn(`${MODULE_ID} | PF2e ${api} API unavailable`);
}

/** The deliberately small boundary around PF2e's public, version-sensitive APIs. */
export class PF2eAdapter {
  static ACTION_GLYPHS = Object.freeze({ action: "1", action2: "2", action3: "3", reaction: "R", free: "F" });

  static getActionGlyph(type = "action", value = 1) {
    if (type === "reaction" || type === "free") return this.ACTION_GLYPHS[type];
    return this.ACTION_GLYPHS[`action${value}`] ?? this.ACTION_GLYPHS.action;
  }

  static getActionCost(item) {
    const cost = item?.actionCost ?? item?.system?.actionType;
    if (!cost && item?.isOfType?.("spell")) {
      const glyph = item.actionGlyph;
      if (["1", "2", "3"].includes(glyph)) return { type: "action", value: Number(glyph) };
      if (glyph === "R") return { type: "reaction", value: 1 };
      if (glyph === "F") return { type: "free", value: 0 };
    }
    if (!cost || !["action", "reaction", "free"].includes(cost.type)) return null;
    const value = cost.type === "action" ? Number(cost.value) : cost.type === "reaction" ? 1 : 0;
    if (cost.type === "action" && ![1, 2, 3].includes(value)) return null;
    return { type: cost.type, value };
  }

  static resolveMessageActor(message) {
    return message?.actor ?? game.actors?.get(message?.speaker?.actor) ?? null;
  }

  static resolveMessageItem(message) {
    return message?.item ?? null;
  }

  static getMessageContext(message) {
    return message?.flags?.pf2e?.context ?? null;
  }

  static getPreparedActionCount(actor) {
    const prepared = actor?.system?.attributes?.actions;
    const value = Number(prepared?.value ?? prepared?.max);
    return Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
  }
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
