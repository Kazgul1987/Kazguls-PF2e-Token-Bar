export const REACTION_SCHEMA_VERSION = 3;

export function generalSlot(remaining = 1) {
  return { id: "general", kind: "general", label: "General Reaction", max: 1, remaining,
    refresh: { type: "start-own-turn" }, expires: { type: "never" }, restriction: { type: "general", values: [] } };
}

export function migrateReactions(state) {
  if (state?.reactions?.version === REACTION_SCHEMA_VERSION) return state.reactions;
  if (state?.reactions?.version === 2) {
    state.reactions.version = REACTION_SCHEMA_VERSION;
    // Version 2 flags only existed after a combatant's turn state was created.
    state.reactions.initialized = true;
    return state.reactions;
  }
  const available = state?.reaction?.available;
  const reactions = { version: REACTION_SCHEMA_VERSION, initialized: true, general: generalSlot(available === false ? 0 : 1), bonus: [] };
  if (state) { state.reactions = reactions; delete state.reaction; }
  return reactions;
}

export function allReactionSlots(reactions) { return [reactions.general, ...(reactions.bonus ?? [])]; }
