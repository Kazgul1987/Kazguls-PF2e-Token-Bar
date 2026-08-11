import { PF2eAdapter } from "../../integrations/pf2e.js";
import { ActionState } from "./action-state.js";
import { ActionTracker } from "./action-tracker.js";
import { TurnWarnings } from "./turn-warnings.js";
import { MovementTracker } from "./movement-tracker.js";

const MODULE_ID = "pf2e-token-bar";

function glyph(type, value = 1) {
  const span = document.createElement("span");
  span.className = "action-glyph";
  span.textContent = PF2eAdapter.getActionGlyph(type, value);
  return span;
}

export class TurnAssistant {
  static startTurn(combatant) {
    return ActionTracker.startTurn(combatant);
  }

  static async render(combatant) {
    if (!game.settings.get(MODULE_ID, "turnAssistant")) return null;
    const state = await ActionState.read(combatant);
    if (!state) return null;
    const root = document.createElement("section"); root.className = "pf2e-turn-assistant";
    const title = document.createElement("strong"); title.textContent = game.i18n.localize("PF2ETokenBar.TurnAssistant.Turn"); root.append(title);

    const resources = document.createElement("div"); resources.className = "pf2e-turn-resources";
    const actions = document.createElement("span"); actions.className = "pf2e-turn-actions";
    for (let i = 0; i < state.actions.remaining; i++) actions.append(glyph("action"));
    actions.title = game.i18n.format("PF2ETokenBar.TurnAssistant.ActionsRemaining", { count: state.actions.remaining }); resources.append(actions);
    const reaction = glyph("reaction"); reaction.classList.toggle("spent", !state.reaction.available); reaction.title = game.i18n.localize(`PF2ETokenBar.TurnAssistant.Reaction${state.reaction.available ? "Available" : "Spent"}`); resources.append(reaction); root.append(resources);

    const last = state.history.at(-1);
    if (last && game.settings.get(MODULE_ID, "showActionHistory")) {
      const history = document.createElement("div"); history.className = "pf2e-turn-last";
      history.textContent = game.i18n.format("PF2ETokenBar.TurnAssistant.Last", { label: last.label }); root.append(history);
    }
    if (state.overSpent) { const warning = document.createElement("div"); warning.className = "pf2e-turn-warning"; warning.textContent = game.i18n.localize("PF2ETokenBar.TurnAssistant.AdditionalAction"); root.append(warning); }
    const warnings = game.settings.get(MODULE_ID, "showTurnWarnings") ? TurnWarnings.get(combatant.actor) : [];
    if (warnings.length) { const notes = document.createElement("ul"); notes.className = "pf2e-turn-warnings"; for (const item of warnings) { const li = document.createElement("li"); li.textContent = item.label; notes.append(li); } root.append(notes); }

    const controls = document.createElement("div"); controls.className = "pf2e-turn-controls";
    const button = (label, handler) => { const element = document.createElement("button"); element.type = "button"; element.title = label; element.setAttribute("aria-label", label); element.addEventListener("click", handler); controls.append(element); return element; };
    button(game.i18n.localize("PF2ETokenBar.TurnAssistant.SpendAction"), () => ActionTracker.adjust(combatant, -1)).append(glyph("action"), document.createTextNode("−"));
    button(game.i18n.localize("PF2ETokenBar.TurnAssistant.RestoreAction"), () => ActionTracker.adjust(combatant, 1)).append(glyph("action"), document.createTextNode("+"));
    const undo = button(game.i18n.localize("PF2ETokenBar.TurnAssistant.Undo"), () => ActionTracker.undo(combatant)); undo.innerHTML = '<i class="fas fa-undo"></i>'; undo.disabled = !last;
    const end = button(game.i18n.localize("PF2ETokenBar.TurnAssistant.EndTurn"), () => game.combat?.nextTurn()); end.innerHTML = '<i class="fas fa-forward-step"></i>'; root.append(controls);
    return root;
  }

  static registerHooks(render) {
    ActionTracker.onChange = render;
    ActionTracker.registerSocket();
    MovementTracker.registerHooks();
    Hooks.on("createChatMessage", message => ActionTracker.processMessage(message));
    Hooks.on("updateCombat", async combat => { if (combat.id === game.combat?.id && combat.started) await ActionTracker.startTurn(combat.combatant); });
    Hooks.on("combatStart", combat => ActionTracker.startTurn(combat.combatant));
    Hooks.on("deleteCombatant", combatant => { if (combatant.id === game.combat?.combatant?.id) render(); });
    Hooks.on("deleteCombat", render);
  }

  static exposeApi() {
    const resolve = actor => ActionTracker.findCombatant(actor);
    game.pf2eTokenBar ??= {};
    game.pf2eTokenBar.actions = {
      consume: (actor, cost = 1, label = "Macro") => ActionTracker.consume(resolve(actor), cost, label),
      refund: (actor, cost = 1) => ActionTracker.refund(resolve(actor), cost),
      consumeReaction: (actor, label = "Macro") => ActionTracker.consumeReaction(resolve(actor), label),
      restoreReaction: actor => ActionTracker.restoreReaction(resolve(actor)),
      record: ({ actor, type, cost = 0, label = "Macro" }) => ActionTracker.record(resolve(actor), { resource: type, cost, label }),
      undo: actor => ActionTracker.undo(resolve(actor)),
    };
  }
}
