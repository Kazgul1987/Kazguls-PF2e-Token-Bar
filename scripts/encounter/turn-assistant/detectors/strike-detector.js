import { PF2eAdapter } from "../../../integrations/pf2e.js";

export class StrikeDetector {
  static detect(message) {
    const context = PF2eAdapter.getMessageContext(message);
    if (context?.type !== "attack-roll") return null;
    const actor = PF2eAdapter.resolveMessageActor(message);
    const item = PF2eAdapter.resolveMessageItem(message);
    if (!actor || !item?.isOfType?.("weapon", "melee")) return null;
    return { actorId: actor.id, resource: "action", cost: 1, label: message.item?.name ?? "Strike", confidence: "high", identity: `message:${message.id}` };
  }
}
