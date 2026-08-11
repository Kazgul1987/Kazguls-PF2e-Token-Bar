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
  // PF2e 7.8 (Foundry V14) SystemActions definitions. Used only if the public
  // game.pf2e.actions collection is unavailable or does not contain the action.
  static MOVEMENT_ACTION_COSTS = new Map([
    ["stride", 1], ["step", 1], ["climb", 1], ["swim", 1], ["crawl", 1],
    ["sneak", 1], ["leap", 1], ["high-jump", 2], ["long-jump", 2], ["fly", 1],
  ]);
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

  /** Resolve a unique supported action from PF2e's sorted check roll options. */
  static getMessageActionSlug(message) {
    const options = this.getMessageContext(message)?.options;
    if (!Array.isArray(options)) return null;
    const candidates = [...new Set(options
      .filter(option => typeof option === "string" && option.startsWith("action:"))
      .map(option => option.slice("action:".length))
      .filter(slug => this.MOVEMENT_ACTION_SLUGS.has(slug)))];
    if (candidates.length === 1) return candidates[0];
    if (candidates.length < 2) return null;

    // High Jump and Long Jump deliberately include action:stride and action:leap.
    // PF2e's action definition identifies the primary slug and lists those two
    // prerequisite roll options, allowing an unambiguous, data-driven choice.
    const matches = candidates.filter(slug => {
      const action = this.getSystemAction(slug);
      const related = Array.isArray(action?.rollOptions)
        ? action.rollOptions.filter(option => option.startsWith("action:")).map(option => option.slice(7))
        : [];
      return related.length > 0 && candidates.every(candidate => candidate === slug || related.includes(candidate));
    });
    return matches.length === 1 ? matches[0] : null;
  }

  static getMessageTraits(message) {
    const traits = this.getMessageContext(message)?.traits;
    return Array.isArray(traits) ? traits : [];
  }

  static getSystemAction(slug) {
    return game.pf2e?.actions?.get?.(slug) ?? null;
  }

  static getSystemActionCost(slug) {
    const cost = this.getSystemAction(slug)?.cost;
    return Number.isInteger(cost) && cost > 0 ? cost : this.MOVEMENT_ACTION_COSTS.get(slug) ?? null;
  }

  static getSystemActionLabel(slug, message) {
    const name = this.getSystemAction(slug)?.name;
    if (typeof name === "string" && name) return game.i18n.localize(name);
    const title = this.getMessageContext(message)?.title;
    if (typeof title === "string" && title) return game.i18n.localize(title);
    return message?.flavor ?? slug;
  }

  static isRerollMessage(message) {
    const context = this.getMessageContext(message);
    return context?.isReroll === true || message?.isReroll === true;
  }

  static getCondition(actor, slug) {
    return actor?.conditions?.bySlug?.(slug, { active: true })?.[0] ?? null;
  }

  /** PF2e V14 has no prepared action total: apply only start-of-turn quickened/slowed. */
  static getTurnStartActionEconomy(actor) {
    const quickened = actor?.conditions?.hasType?.("quickened") === true || !!this.getCondition(actor, "quickened");
    const slowed = this.getCondition(actor, "slowed");
    const slowedValue = Math.max(0, Number(slowed?.badge?.value ?? slowed?.system?.badge?.value) || 0);
    const reasons = [];
    if (quickened) reasons.push({ type: "quickened", value: 1 });
    if (slowedValue) reasons.push({ type: "slowed", value: slowedValue });
    return { actions: Math.max(0, 3 + (quickened ? 1 : 0) - slowedValue), reaction: true, reasons };
  }

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
