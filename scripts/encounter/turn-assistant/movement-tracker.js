import { ActionTracker } from "./action-tracker.js";
import { MovementIntent } from "./movement-intent.js";
import { PF2eAdapter } from "../../integrations/pf2e.js";

const MODULE_ID = "pf2e-token-bar";
const POSITION_KEYS = ["x", "y", "elevation"];

/** Debounces TokenDocument updates and turns one continuous move into one action event. */
export class MovementTracker {
  static pending = new Map();
  static previousPositions = new Map();
  static sequence = 0;

  static registerHooks() {
    Hooks.on("preUpdateToken", (token, changes) => this.capturePreviousPosition(token, changes));
    Hooks.on("updateToken", (token, changes, options, userId) => this.onTokenUpdate(token, changes, options, userId));
    Hooks.on("deleteCombat", () => this.clear());
    Hooks.on("updateCombat", combat => { if (!combat.started) this.clear(); });
    Hooks.on("canvasTearDown", () => this.clear());
  }

  static tokenKey(token) {
    return `${token.parent?.id ?? token.scene?.id ?? "scene"}:${token.id}`;
  }

  static capturePreviousPosition(token, changes) {
    if (!POSITION_KEYS.some(key => Object.prototype.hasOwnProperty.call(changes, key))) return;
    this.previousPositions.set(this.tokenKey(token), this.position(token, {}));
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

    const key = this.tokenKey(token);
    const position = this.position(token, changes);
    const previous = this.previousPositions.get(key);
    this.previousPositions.delete(key);
    if (!previous || this.samePosition(previous, position)) return;
    const segmentDistance = this.measureSegment(token, previous, position);
    if (!(segmentDistance > 0)) return;
    let session = this.pending.get(key);
    if (!session) {
      const intent = MovementIntent.consume(token.actor.id, combatant.id);
      session = {
        tokenId: token.id, actorId: token.actor.id, combatId: combat.id, combatantId: combatant.id,
        sessionId: `${Date.now().toString(36)}-${++this.sequence}`, startedAt: Date.now(),
        lastUpdate: Date.now(), position, distance: segmentDistance,
        movementType: intent?.movementType ?? "land", intent, timer: null,
      };
      this.pending.set(key, session);
      ActionTracker.debug("Movement started", { actor: token.actor.name, token: token.name });
    } else {
      if (this.samePosition(session.position, position)) return;
      session.position = position;
      session.distance += segmentDistance;
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

    if (session.intent?.paid) {
      ActionTracker.debug("Movement intent found; skipping additional movement cost", session.intent);
      return;
    }
    const speed = PF2eAdapter.getMovementSpeed(combatant.actor, session.movementType);
    if (!speed) {
      ActionTracker.debug("Movement session ignored / fallback", { actor: combatant.actor?.name,
        type: session.movementType, reason: `no reliable current ${session.movementType} speed` });
      return;
    }
    const cost = this.actionsRequired(session.distance, speed);
    if (!cost) return;
    const identity = `movement:${session.combatId}:${session.combatantId}:${session.sessionId}`;
    const distance = Math.round(session.distance * 100) / 100;
    const typeLabel = game.i18n.localize(`PF2ETokenBar.TurnAssistant.MovementType.${session.movementType}`);
    const units = globalThis.canvas?.scene?.grid?.units || game.i18n.localize("PF2ETokenBar.TurnAssistant.DistanceUnits");
    ActionTracker.debug("Movement session finalized", { actor: combatant.actor?.name, type: session.movementType,
      distance, speed, actionsRequired: cost });
    await ActionTracker.record(combatant, {
      resource: "action", cost,
      label: `${typeLabel} ${distance} ${units}`,
      automatic: true, source: "token-movement", identity,
    });
  }

  static actionsRequired(distance, speed) {
    const travelled = Number(distance); const effectiveSpeed = Number(speed);
    return travelled > 0 && effectiveSpeed > 0 ? Math.ceil(travelled / effectiveSpeed) : 0;
  }

  /** Foundry V14's grid path measurement honors scene units and diagonal rules. */
  static measureSegment(token, from, to) {
    const grid = globalThis.canvas?.grid;
    if (!grid?.measurePath) return 0;
    const size = globalThis.canvas?.dimensions?.size ?? grid.size ?? 0;
    const width = Number(token.width ?? 1) * size;
    const height = Number(token.height ?? 1) * size;
    const waypoint = point => ({ x: point.x + width / 2, y: point.y + height / 2, elevation: point.elevation });
    const measurement = grid.measurePath([waypoint(from), waypoint(to)]);
    return Number(measurement?.distance) || 0;
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
    this.previousPositions.clear();
    MovementIntent.clear();
  }
}
