import { ActionTracker } from "./action-tracker.js";
import { MovementIntent } from "./movement-intent.js";

const MODULE_ID = "pf2e-token-bar";
const POSITION_KEYS = ["x", "y", "elevation"];

/** Debounces TokenDocument updates and turns one continuous move into one action event. */
export class MovementTracker {
  static pending = new Map();
  static sequence = 0;

  static registerHooks() {
    Hooks.on("updateToken", (token, changes, options, userId) => this.onTokenUpdate(token, changes, options, userId));
    Hooks.on("deleteCombat", () => this.clear());
    Hooks.on("updateCombat", combat => { if (!combat.started) this.clear(); });
    Hooks.on("canvasTearDown", () => this.clear());
  }

  static onTokenUpdate(token, changes, options = {}, userId) {
    if (!POSITION_KEYS.some(key => Object.prototype.hasOwnProperty.call(changes, key))) return;
    if (!game.settings.get(MODULE_ID, "turnAssistant") || !game.settings.get(MODULE_ID, "automaticMovementTracking")) return;
    if (!ActionTracker.isAuthority() || game.paused) return;

    const combat = game.combat;
    if (!combat?.started || !combat.combatant || !token?.actor) return;
    const combatant = this.findCombatant(token, combat);
    if (!combatant) return;
    if (game.settings.get(MODULE_ID, "onlyTrackActiveCombatant") && combatant.id !== combat.combatant.id) return;
    if (this.ignoreGMMovement(token.actor, userId)) return;

    const key = `${token.parent?.id ?? token.scene?.id ?? "scene"}:${token.id}`;
    const position = this.position(token, changes);
    let session = this.pending.get(key);
    if (!session) {
      session = {
        tokenId: token.id, actorId: token.actor.id, combatId: combat.id, combatantId: combatant.id,
        sessionId: `${Date.now().toString(36)}-${++this.sequence}`, startedAt: Date.now(),
        lastUpdate: Date.now(), position, timer: null,
      };
      this.pending.set(key, session);
      ActionTracker.debug("Movement started", { actor: token.actor.name, token: token.name });
    } else {
      if (this.samePosition(session.position, position)) return;
      session.position = position;
      session.lastUpdate = Date.now();
      clearTimeout(session.timer);
      ActionTracker.debug("Movement update received", { actor: token.actor.name, token: token.name });
    }
    const delay = Number(game.settings.get(MODULE_ID, "movementDetectionDelay")) || 400;
    session.timer = setTimeout(() => this.finishMovement(key), delay);
  }

  static async finishMovement(key) {
    const session = this.pending.get(key);
    if (!session) return;
    this.pending.delete(key);
    clearTimeout(session.timer);
    const combat = game.combat;
    const combatant = ActionTracker.getCombatant(session.combatantId);
    if (!combat?.started || combat.id !== session.combatId || !combatant || game.paused) return;
    if (game.settings.get(MODULE_ID, "onlyTrackActiveCombatant") && combat.combatant?.id !== combatant.id) return;

    ActionTracker.debug("Movement completed", session);
    const intent = MovementIntent.consume(session.actorId, session.combatantId);
    if (intent) {
      ActionTracker.debug("Movement intent found; skipping additional movement cost", intent);
      return;
    }
    const identity = `movement:${session.combatId}:${session.combatantId}:${session.sessionId}`;
    ActionTracker.debug("No movement intent found; spending 1 action", { identity });
    await ActionTracker.record(combatant, {
      resource: "action", cost: 1,
      label: game.i18n.localize("PF2ETokenBar.TurnAssistant.Movement"),
      automatic: true, source: "token-movement", identity,
    });
  }

  static findCombatant(token, combat) {
    const tokenId = token.id;
    const sceneId = token.parent?.id ?? token.scene?.id;
    return combat.combatants.find(combatant =>
      (combatant.tokenId === tokenId && (!combatant.sceneId || !sceneId || combatant.sceneId === sceneId))
      || (combatant.actorId === token.actor?.id && combatant.id === combat.combatant?.id)
    ) ?? null;
  }

  static ignoreGMMovement(actor, userId) {
    if (!game.settings.get(MODULE_ID, "ignoreGMMovementOfPlayerTokens") || !actor?.hasPlayerOwner) return false;
    return game.users?.get?.(userId)?.isGM === true;
  }

  static position(token, changes) {
    return Object.fromEntries(POSITION_KEYS.map(key => [key, changes[key] ?? token[key] ?? token._source?.[key] ?? 0]));
  }

  static samePosition(a, b) {
    return POSITION_KEYS.every(key => a[key] === b[key]);
  }

  static clear() {
    for (const session of this.pending.values()) clearTimeout(session.timer);
    this.pending.clear();
    MovementIntent.clear();
  }
}
