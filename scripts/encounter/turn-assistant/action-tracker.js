import { PF2eAdapter } from "../../integrations/pf2e.js";
import { ActionState } from "./action-state.js";
import { ActivityDetector } from "./detectors/activity-detector.js";
import { StrikeDetector } from "./detectors/strike-detector.js";

const MODULE_ID = "pf2e-token-bar";

export class ActionTracker {
  static detectors = [ActivityDetector, StrikeDetector];
  static onChange = () => {};

  static isAuthority(message = null) {
    const gm = game.users?.filter(user => user.active && user.isGM).sort((a, b) => a.id.localeCompare(b.id))[0];
    return gm ? game.user.id === gm.id : message?.user?.id === game.user.id;
  }

  static findCombatant(actorOrId) {
    const id = actorOrId?.id ?? actorOrId;
    return game.combat?.combatants.find(c => c.actorId === id) ?? null;
  }

  static async startTurn(combatant) {
    if (!combatant || !this.isAuthority()) return;
    const old = await ActionState.read(combatant);
    const key = `${combatant.combat?.round ?? 0}:${combatant.combat?.turn ?? 0}`;
    if (old?.turn === key && old?.combatId === combatant.combat?.id) return;
    const maximum = PF2eAdapter.getPreparedActionCount(combatant.actor) ?? 3;
    await ActionState.write(combatant, ActionState.create(combatant, maximum, old));
  }

  static async record(combatant, event) {
    if (!combatant || !event) return false;
    const state = await ActionState.read(combatant) ?? ActionState.create(combatant, PF2eAdapter.getPreparedActionCount(combatant.actor) ?? 3);
    if (event.identity && state.processed.includes(event.identity)) return false;
    const before = { actions: state.actions.remaining, reaction: state.reaction.available };
    if (event.resource === "action") {
      const spend = Math.max(0, Number(event.cost) || 0);
      state.overSpent ||= spend > state.actions.remaining;
      state.actions.remaining = Math.max(0, state.actions.remaining - spend);
    } else if (event.resource === "reaction") state.reaction.available = false;
    state.history.push({ id: event.identity ?? foundry.utils.randomID(), label: event.label, resource: event.resource, cost: event.cost, automatic: event.automatic ?? false, timestamp: Date.now(), before });
    if (event.identity) state.processed.push(event.identity);
    state.processed = state.processed.slice(-100);
    await ActionState.write(combatant, state);
    this.onChange();
    return true;
  }

  static async processMessage(message) {
    if (!game.settings.get(MODULE_ID, "turnAssistant") || !this.isAuthority(message)) return;
    for (const detector of this.detectors) {
      const event = detector.detect(message);
      if (!event) continue;
      const allowed = event.confidence === "certain" || (event.confidence === "high" && game.settings.get(MODULE_ID, "trackingMode") === "automatic");
      if (!allowed) { this.debug("Action detection skipped: insufficient confidence", event); return; }
      if (event.resource === "reaction" && !game.settings.get(MODULE_ID, "autoReactions")) return;
      if (["action", "free"].includes(event.resource) && !game.settings.get(MODULE_ID, "autoActions")) return;
      const combatant = this.findCombatant(event.actorId);
      if (combatant) {
        this.debug("Detected action", { label: event.label, actorId: event.actorId, cost: event.cost, confidence: event.confidence, messageId: message.id });
        await this.record(combatant, { ...event, automatic: true });
      }
      return;
    }
  }

  static async adjust(combatant, delta) {
    if (delta < 0) return this.record(combatant, { resource: "action", cost: Math.abs(delta), label: game.i18n.localize("PF2ETokenBar.TurnAssistant.ManualSpend") });
    const state = await ActionState.read(combatant);
    if (!state) return false;
    const before = { actions: state.actions.remaining, reaction: state.reaction.available };
    state.actions.remaining = Math.min(state.actions.max, state.actions.remaining + delta);
    state.history.push({ id: foundry.utils.randomID(), label: game.i18n.localize("PF2ETokenBar.TurnAssistant.ManualRestore"), resource: "refund", cost: delta, automatic: false, timestamp: Date.now(), before });
    await ActionState.write(combatant, state); this.onChange(); return true;
  }

  static async undo(combatant) {
    const state = await ActionState.read(combatant); const entry = state?.history.pop();
    if (!entry) return false;
    state.actions.remaining = Math.min(state.actions.max, entry.before.actions);
    state.reaction.available = entry.before.reaction;
    state.overSpent = false;
    await ActionState.write(combatant, state); this.onChange(); return true;
  }

  static debug(label, data) {
    if (game.settings.get(MODULE_ID, "debug")) console.debug(`${MODULE_ID} | ${label}`, data);
  }
}
