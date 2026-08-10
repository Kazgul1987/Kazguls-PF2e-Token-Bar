const MODULE_ID = "pf2e-token-bar";
const FLAG = "turnAssistant";

export class ActionState {
  static async read(combatant) {
    return combatant?.getFlag(MODULE_ID, FLAG) ?? null;
  }

  static async write(combatant, state) {
    if (!combatant || !state) return null;
    await combatant.setFlag(MODULE_ID, FLAG, state);
    return state;
  }

  static create(combatant, maximum = 3, previous = null) {
    return {
      combatId: combatant.combat?.id ?? game.combat?.id,
      combatantId: combatant.id,
      actorId: combatant.actorId,
      turn: `${combatant.combat?.round ?? 0}:${combatant.combat?.turn ?? 0}`,
      actions: { max: maximum, remaining: maximum },
      reaction: { available: true },
      history: [], pending: null, overSpent: false,
      processed: previous?.processed?.slice(-100) ?? [],
    };
  }
}
