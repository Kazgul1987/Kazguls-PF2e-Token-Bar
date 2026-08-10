import { PF2eAdapter } from "../integrations/pf2e.js";

export class TokenProvider {
  static partyActors() {
    if (game.combat?.started) return [];
    const actors = PF2eAdapter.getPartyMembers();
    if (!game.settings.get("pf2e-token-bar", "partyOnlySelf") || game.user.isGM) return actors;
    const characterId = game.user.character?.id;
    return actors.filter(actor => actor.id === characterId || actor.isOwner);
  }

  static combatTokens() {
    const combatants = Array.from(game.combat?.combatants ?? []).sort((a, b) => {
      const initiative = (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity);
      return initiative || Number(a.actor?.hasPlayerOwner) - Number(b.actor?.hasPlayerOwner);
    });
    return combatants
      .map(combatant => canvas.tokens.get(combatant.tokenId))
      .filter(token => token && (!token.document.hidden || game.user.isGM));
  }

  static activePlayerTokens() {
    return (canvas.tokens?.placeables ?? []).filter(token => token.actor?.hasPlayerOwner);
  }
}
