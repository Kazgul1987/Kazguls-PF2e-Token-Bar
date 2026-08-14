const MODULE_ID = "pf2e-token-bar";

/** Short-lived, authority-local receipts for already-paid PF2e movement activities. */
export class MovementIntent {
  static intents = new Map();

  static key(actorId, combatantId) {
    return `${actorId}:${combatantId}`;
  }

  static add({ actorId, combatantId, slug, movementType = null, cost, identity, paid = false }) {
    if (!actorId || !combatantId) return;
    this.prune();
    const key = this.key(actorId, combatantId);
    const queue = this.intents.get(key) ?? [];
    queue.push({ actorId, combatantId, slug, movementType, cost, identity, paid, createdAt: Date.now() });
    this.intents.set(key, queue);
  }

  static consume(actorId, combatantId) {
    this.prune();
    const key = this.key(actorId, combatantId);
    const queue = this.intents.get(key);
    const intent = queue?.shift() ?? null;
    if (!queue?.length) this.intents.delete(key);
    return intent;
  }

  static prune(now = Date.now()) {
    const ttl = Number(game.settings.get(MODULE_ID, "movementIntentTimeout")) || 8000;
    for (const [key, queue] of this.intents) {
      const current = queue.filter(intent => now - intent.createdAt <= ttl);
      if (current.length) this.intents.set(key, current);
      else this.intents.delete(key);
    }
  }

  static clear() {
    this.intents.clear();
  }
}
