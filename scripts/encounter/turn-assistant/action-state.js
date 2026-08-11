import { generalSlot, migrateReactions, REACTION_SCHEMA_VERSION } from "./reaction/reaction-state.js";

const MODULE_ID = "pf2e-token-bar";
const FLAG = "turnAssistant";

export class ActionState {
  static async read(combatant) {
    const state = await combatant?.getFlag(MODULE_ID, FLAG) ?? null;
    if (state) migrateReactions(state);
    return state;
  }

  static async write(combatant, state) {
    if (!combatant || !state) return null;
    await combatant.setFlag(MODULE_ID, FLAG, state);
    return state;
  }

  static create(combatant, economy = 3, previous = null) {
    const maximum = typeof economy === "number" ? economy : economy.actions;
    return {
      combatId: combatant.combat?.id ?? game.combat?.id,
      combatantId: combatant.id,
      actorId: combatant.actorId,
      turn: `${combatant.combat?.round ?? 0}:${combatant.combat?.turn ?? 0}`,
      actions: { max: maximum, remaining: maximum },
      reactions: { version: REACTION_SCHEMA_VERSION, general: generalSlot(typeof economy === "number" || economy.reaction ? 1 : 0), bonus: [] },
      reasons: typeof economy === "number" ? [] : economy.reasons,
      history: [], pending: null, overSpent: false,
      processed: previous?.processed?.slice(-100) ?? [],
    };
  }
}
