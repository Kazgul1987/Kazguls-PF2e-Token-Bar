import { PF2eAdapter } from "../../../integrations/pf2e.js";

/** Detect executed PF2e rolls and unrolled item-use cards with a verified item origin. */
export class ActivityDetector {
  static detect(message) {
    const context = PF2eAdapter.getMessageContext(message);
    if (PF2eAdapter.isRerollMessage(message)) return null;
    const actor = PF2eAdapter.resolveMessageActor(message);
    const item = PF2eAdapter.resolveMessageItem(message);
    const cost = PF2eAdapter.getActionCost(item);
    if (!actor || !item || !cost) return null;

    if (!context) {
      if (cost.type !== "reaction" || !PF2eAdapter.isItemUsageMessage(message, item)) return null;
      return {
        actorId: actor.id, resource: "reaction", cost: 1,
        label: item.name ?? "PF2e Reaction", confidence: "certain", identity: `message:${message.id}`,
        slug: PF2eAdapter.getActivitySlug(item), actionSlug: PF2eAdapter.getActivitySlug(item),
        actionUuid: item.uuid ?? null, sourceUuid: item.sourceId ?? item.flags?.core?.sourceId ?? null,
        source: "pf2e-reaction-card",
      };
    }

    const type = String(context.type ?? "");
    if (type.includes("damage") || type.includes("healing")) return null;
    const executed = type.includes("roll") || type === "spell-cast" || type === "self-effect" || context.outcome != null;
    if (!executed) return null;
    return {
      actorId: actor.id, resource: cost.type, cost: cost.value,
      label: item.name ?? message.flavor ?? "PF2e Activity",
      confidence: "certain", identity: `message:${message.id}`,
      movement: PF2eAdapter.isMovementActivity(item),
      slug: PF2eAdapter.getActivitySlug(item), actionSlug: PF2eAdapter.getActivitySlug(item),
      actionUuid: item.uuid ?? null, sourceUuid: item.sourceId ?? item.flags?.core?.sourceId ?? null,
    };
  }
}
