import { ActionState } from "../action-state.js";
import { PF2eAdapter } from "../../../integrations/pf2e.js";
import { ReactionTracker } from "./reaction-tracker.js";
import { allReactionSlots, generalSlot, REACTION_SCHEMA_VERSION } from "./reaction-state.js";

function localize(key) { return game.i18n.localize(`PF2ETokenBar.TurnAssistant.Reactions.${key}`); }

/** Read-only reaction presentation shared by active and inactive combatants. */
export class ReactionDisplay {
  static async render(combatant) {
    if (!game.settings.get("pf2e-token-bar", "turnAssistant")) return null;
    const stored = await ActionState.read(combatant);
    const state = stored ?? { reactions: { version: REACTION_SCHEMA_VERSION, initialized: false, general: generalSlot(0), bonus: [] } };
    ReactionTracker.reconcile(state, combatant.actor);

    const root = document.createElement("div");
    root.className = "pf2e-reaction-display";
    for (const slot of allReactionSlots(state.reactions)) for (let i = 0; i < slot.max; i++) {
      const unavailable = slot.refresh?.type === "start-own-turn" && !state.reactions.initialized;
      const available = !unavailable && i < slot.remaining;
      const element = document.createElement("span");
      element.className = `reaction-slot ${unavailable ? "unavailable" : available ? "available" : "spent"}`;
      const glyph = document.createElement("span"); glyph.className = "action-glyph";
      glyph.textContent = PF2eAdapter.getActionGlyph("reaction"); element.append(glyph);
      const restriction = slot.restriction?.type === "general" ? "" : `\n${slot.label}`;
      const status = unavailable ? localize("FirstTurn") : available ? localize("Available") : localize("Spent");
      const refresh = !unavailable && !available && slot.refresh?.type === "start-own-turn" ? `\n${localize("NextTurn")}` : "";
      element.title = `${slot.label}${restriction}\n${status}${refresh}`;
      root.append(element);
    }
    return root;
  }
}
