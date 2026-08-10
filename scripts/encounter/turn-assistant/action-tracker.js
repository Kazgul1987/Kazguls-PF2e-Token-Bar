import { PF2eAdapter } from "../../integrations/pf2e.js";
import { ActionState } from "./action-state.js";
import { ActivityDetector } from "./detectors/activity-detector.js";
import { StrikeDetector } from "./detectors/strike-detector.js";

const MODULE_ID = "pf2e-token-bar";
const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const MUTATION_TYPE = "action-tracker-mutation";
const RESOURCES = new Set(["action", "reaction", "free"]);

export class ActionTracker {
  static detectors = [ActivityDetector, StrikeDetector];
  static onChange = () => {};
  static socketRegistered = false;
  static handledRequests = new Set();

  static getAuthorityUser() {
    return game.users?.filter(user => user.active && user.isGM).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
  }

  static isAuthority(message = null) {
    const authority = this.getAuthorityUser();
    return authority ? game.user.id === authority.id : message?.user?.id === game.user.id;
  }

  static findCombatant(actorOrId) {
    const id = actorOrId?.id ?? actorOrId;
    return game.combat?.combatants.find(c => c.actorId === id) ?? null;
  }

  static getCombatant(combatantId) {
    return game.combat?.combatants.get?.(combatantId)
      ?? game.combat?.combatants.find?.(combatant => combatant.id === combatantId)
      ?? null;
  }

  static registerSocket() {
    if (this.socketRegistered) return;
    game.socket.on(SOCKET_CHANNEL, request => this.handleSocketRequest(request));
    this.socketRegistered = true;
  }

  static async requestMutation(operation, combatant, payload = {}) {
    if (!combatant) return false;
    const requestId = foundry.utils.randomID();
    const request = {
      type: MUTATION_TYPE,
      requestId,
      senderId: game.user.id,
      operation,
      combatantId: combatant.id,
      payload: { ...payload, identity: payload.identity ?? `manual:${requestId}` },
    };
    if (this.isAuthority()) return this.validateRequest(request) ? this.dispatchMutation(combatant, request) : false;
    if (!this.getAuthorityUser()) {
      console.warn(`${MODULE_ID} | Cannot mutate action state without an active GM`);
      return false;
    }
    game.socket.emit(SOCKET_CHANNEL, request);
    return true;
  }

  static async handleSocketRequest(request) {
    if (request?.type !== MUTATION_TYPE || !this.isAuthority()) return;
    if (!this.validateRequest(request) || this.handledRequests.has(request.requestId)) return;
    const combatant = this.getCombatant(request.combatantId);
    this.handledRequests.add(request.requestId);
    if (this.handledRequests.size > 100) this.handledRequests.delete(this.handledRequests.values().next().value);
    await this.dispatchMutation(combatant, request);
  }

  static validateRequest(request) {
    const sender = game.users?.get?.(request?.senderId);
    const combatant = this.getCombatant(request?.combatantId);
    const actor = combatant?.actor;
    if (!sender || !combatant || !actor || typeof request.requestId !== "string" || !request.requestId) return false;
    if (!sender.isGM && !actor.testUserPermission?.(sender, "OWNER")) return false;
    const payload = request.payload;
    if (!payload || typeof payload !== "object") return false;
    switch (request.operation) {
      case "adjust": return Number.isFinite(payload.amount) && payload.amount !== 0;
      case "consume":
      case "refund": return Number.isFinite(payload.cost) && payload.cost >= 0 && (payload.label == null || typeof payload.label === "string");
      case "consumeReaction": return payload.label == null || typeof payload.label === "string";
      case "restoreReaction":
      case "undo": return true;
      case "record": return RESOURCES.has(payload.resource) && Number.isFinite(payload.cost) && payload.cost >= 0 && typeof payload.label === "string";
      default: return false;
    }
  }

  static dispatchMutation(combatant, request) {
    const { operation, payload } = request;
    switch (operation) {
      case "adjust": return this.adjustLocal(combatant, payload.amount, payload.identity);
      case "consume": return this.recordLocal(combatant, { resource: "action", cost: payload.cost, label: payload.label ?? "Macro", identity: payload.identity });
      case "refund": return this.adjustLocal(combatant, Math.abs(payload.cost), payload.identity);
      case "consumeReaction": return this.recordLocal(combatant, { resource: "reaction", cost: 1, label: payload.label ?? "Macro", identity: payload.identity });
      case "restoreReaction": return this.restoreReactionLocal(combatant, payload.identity);
      case "undo": return this.undoLocal(combatant);
      case "record": return this.recordLocal(combatant, { resource: payload.resource, cost: payload.cost, label: payload.label, identity: payload.identity });
      default: return false;
    }
  }

  static async startTurn(combatant) {
    if (!combatant || !this.isAuthority()) return;
    const old = await ActionState.read(combatant);
    const key = `${combatant.combat?.round ?? 0}:${combatant.combat?.turn ?? 0}`;
    if (old?.turn === key && old?.combatId === combatant.combat?.id) return;
    await ActionState.write(combatant, ActionState.create(combatant, PF2eAdapter.getDefaultActionCount(), old));
  }

  static record(combatant, event) {
    return this.requestMutation("record", combatant, event);
  }

  static consume(combatant, cost = 1, label = "Macro") {
    return this.requestMutation("consume", combatant, { cost: Number(cost), label });
  }

  static refund(combatant, cost = 1) {
    return this.requestMutation("refund", combatant, { cost: Number(cost) });
  }

  static consumeReaction(combatant, label = "Macro") {
    return this.requestMutation("consumeReaction", combatant, { label });
  }

  static restoreReaction(combatant) {
    return this.requestMutation("restoreReaction", combatant);
  }

  static adjust(combatant, delta) {
    return this.requestMutation("adjust", combatant, { amount: Number(delta) });
  }

  static undo(combatant) {
    return this.requestMutation("undo", combatant);
  }

  static async recordLocal(combatant, event) {
    if (!combatant || !event) return false;
    const state = await ActionState.read(combatant) ?? ActionState.create(combatant, PF2eAdapter.getDefaultActionCount());
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
        await this.recordLocal(combatant, { ...event, automatic: true });
      }
      return;
    }
  }

  static async adjustLocal(combatant, delta, identity) {
    if (delta < 0) return this.recordLocal(combatant, { resource: "action", cost: Math.abs(delta), label: game.i18n.localize("PF2ETokenBar.TurnAssistant.ManualSpend"), identity });
    const state = await ActionState.read(combatant);
    if (!state || (identity && state.processed.includes(identity))) return false;
    const before = { actions: state.actions.remaining, reaction: state.reaction.available };
    state.actions.remaining = Math.min(state.actions.max, state.actions.remaining + delta);
    state.history.push({ id: identity ?? foundry.utils.randomID(), label: game.i18n.localize("PF2ETokenBar.TurnAssistant.ManualRestore"), resource: "refund", cost: delta, automatic: false, timestamp: Date.now(), before });
    if (identity) state.processed.push(identity);
    state.processed = state.processed.slice(-100);
    await ActionState.write(combatant, state); this.onChange(); return true;
  }

  static async restoreReactionLocal(combatant, identity) {
    const state = await ActionState.read(combatant);
    if (!state || (identity && state.processed.includes(identity))) return false;
    const before = { actions: state.actions.remaining, reaction: state.reaction.available };
    state.reaction.available = true;
    state.history.push({ id: identity ?? foundry.utils.randomID(), label: "Restore Reaction", resource: "reaction-refund", cost: 0, automatic: false, timestamp: Date.now(), before });
    if (identity) state.processed.push(identity);
    state.processed = state.processed.slice(-100);
    await ActionState.write(combatant, state); this.onChange(); return true;
  }

  static async undoLocal(combatant) {
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
