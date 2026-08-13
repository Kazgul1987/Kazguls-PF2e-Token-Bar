import { PF2eAdapter } from "../../integrations/pf2e.js";
import { ActionTracker } from "./action-tracker.js";

const MODULE_ID = "pf2e-token-bar";

/** Charges Stand when PF2e removes the active combatant's embedded prone condition. */
export class ProneTracker {
  static registerHooks() {
    Hooks.on("deleteItem", (item, operation, userId) => this.onDeleteItem(item, operation, userId));
  }

  static async onDeleteItem(item, operation = {}, _userId = null) {
    if (item?.type !== "condition" || PF2eAdapter.getActivitySlug(item) !== "prone") return false;
    if (!game.settings.get(MODULE_ID, "turnAssistant") || !game.settings.get(MODULE_ID, "autoActions")) return false;
    if (!ActionTracker.isAuthority() || game.paused) return false;

    const combat = game.combat;
    const actor = item.actor ?? item.parent;
    const active = combat?.combatant;
    if (!combat?.started) return this.ignore(actor, false, "no active encounter");
    const isActive = !!actor && !!active && (active.actor === actor || active.actorId === actor.id);
    if (!isActive) return this.ignore(actor, false, "actor is not active combatant");

    const kipUp = PF2eAdapter.hasKipUp(actor);
    if (kipUp) {
      ActionTracker.debug("Prone removed", { actor: actor.name, combatantActive: true, kipUp: true, decision: "Kip Up", cost: 0 });
      return false;
    }

    const identity = `prone-removed:${combat.id}:${combat.round ?? 0}:${combat.turn ?? 0}:${active.id}:${item.id}`;
    ActionTracker.debug("Prone removed", { actor: actor.name, combatantActive: true, kipUp: false, decision: "Stand", cost: 1 });
    return ActionTracker.recordLocal(active, {
      resource: "action",
      cost: 1,
      label: game.i18n.localize("PF2ETokenBar.TurnAssistant.Stand"),
      identity,
      automatic: true,
      source: "prone-removed",
    });
  }

  static ignore(actor, active, reason) {
    ActionTracker.debug("Prone removed", { actor: actor?.name, combatantActive: active, decision: "ignored", reason });
    return false;
  }
}
