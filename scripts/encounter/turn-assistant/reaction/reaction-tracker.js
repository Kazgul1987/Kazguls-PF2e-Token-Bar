import { allReactionSlots, migrateReactions } from "./reaction-state.js";
import { ReactionMatcher } from "./reaction-matcher.js";
import { ReactionSourceProvider } from "./reaction-source-provider.js";

export class ReactionTracker {
  static reconcile(state, actor) {
    const reactions = migrateReactions(state);
    const existing = new Map(reactions.bonus.map(slot => [slot.id, slot]));
    const permanent = ReactionSourceProvider.getSources(actor).map(source => {
      const old = existing.get(source.id);
      const gated = source.refresh === "start-own-turn" && !reactions.initialized;
      return { ...source, max: source.amount, remaining: old ? Math.min(source.amount, old.remaining) : gated ? 0 : source.initialRemaining,
        refresh: { type: source.refresh }, expires: { type: source.expires }, restriction: structuredClone(source.restriction) };
    });
    const temporary = reactions.bonus.filter(slot => slot.kind === "temporary");
    reactions.bonus = [...permanent, ...temporary];
    return reactions;
  }

  static spend(state, event) {
    const slots = ReactionMatcher.matching(allReactionSlots(migrateReactions(state)), event);
    const slot = slots[0];
    if (!slot) return null;
    const before = structuredClone(slot);
    slot.remaining--;
    return { slot, before, matches: slots.map(candidate => candidate.id) };
  }

  static restore(state, slotId = "general") {
    const slot = allReactionSlots(migrateReactions(state)).find(candidate => candidate.id === slotId);
    if (!slot) return false;
    slot.remaining = slot.max;
    return true;
  }

  static refresh(state, type) {
    const reactions = migrateReactions(state);
    if (type === "start-own-turn") reactions.initialized = true;
    for (const slot of allReactionSlots(reactions)) if (slot.refresh?.type === type) slot.remaining = slot.max;
    reactions.bonus = reactions.bonus.filter(slot => slot.expires?.type !== type);
  }

  static grantTemporary(state, options = {}) {
    const reactions = migrateReactions(state); const amount = Math.max(1, Number(options.amount) || 1);
    const id = options.id ?? `temporary:${options.sourceActorId ?? "self"}:${options.sourceSlug ?? "manual"}:${crypto.randomUUID?.() ?? Date.now()}`;
    const slot = { id, kind: "temporary", sourceActorId: options.sourceActorId ?? null, sourceSlug: options.sourceSlug ?? "manual",
      sourceUuid: options.sourceUuid ?? null, label: options.label ?? options.sourceSlug ?? "Temporary Reaction", max: amount, remaining: amount,
      refresh: { type: options.refresh ?? "manual" }, expires: { type: options.expires ?? "start-next-own-turn" },
      restriction: options.restriction ?? { type: "general", values: [] } };
    reactions.bonus.push(slot); return slot;
  }
}
