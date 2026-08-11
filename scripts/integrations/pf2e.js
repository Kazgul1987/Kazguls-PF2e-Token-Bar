const MODULE_ID = "pf2e-token-bar";
const warnedApis = new Set();

function warnOnce(api) {
  if (warnedApis.has(api)) return;
  warnedApis.add(api);
  console.warn(`${MODULE_ID} | PF2e ${api} API unavailable`);
}

/** The deliberately small boundary around PF2e's public, version-sensitive APIs. */
export class PF2eAdapter {
  static MOVEMENT_ACTION_SLUGS = new Set(["stride", "step", "climb", "swim", "crawl", "sneak", "leap", "high-jump", "long-jump", "fly"]);
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

  static getActivitySlug(item) {
    return item?.slug ?? item?.system?.slug ?? null;
  }

  static isMovementActivity(item) {
    const traits = item?.system?.traits?.value ?? item?.traits;
    if (traits?.has?.("move") || (Array.isArray(traits) && traits.includes("move"))) return true;
    return this.MOVEMENT_ACTION_SLUGS.has(this.getActivitySlug(item));
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

  static isRerollMessage(message) {
    const context = this.getMessageContext(message);
    return context?.isReroll === true || message?.isReroll === true;
  }

  /** PF2e does not expose a prepared per-turn action total; conditions remain warnings. */
  static getDefaultActionCount() {
    return 3;
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
