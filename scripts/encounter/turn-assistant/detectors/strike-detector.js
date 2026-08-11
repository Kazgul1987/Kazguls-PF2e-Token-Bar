import { PF2eAdapter } from "../../../integrations/pf2e.js";
import { REACTION_STRIKE_SLUGS } from "../reaction/reaction-registry.js";

export class StrikeDetector {
  static detect(message) {
    const context = PF2eAdapter.getMessageContext(message);
    if (PF2eAdapter.isRerollMessage(message)) return null;
    if (context?.type !== "attack-roll") return null;
    const actor = PF2eAdapter.resolveMessageActor(message);
    const item = PF2eAdapter.resolveMessageItem(message);
    if (!actor || !item?.isOfType?.("weapon", "melee")) return null;
    const reactionSlugs = PF2eAdapter.getAllMessageActionSlugs(message).filter(slug => REACTION_STRIKE_SLUGS.has(slug));
    if (reactionSlugs.length === 1) return { actorId: actor.id, resource: "reaction", cost: 1,
      label: message.item?.name ?? reactionSlugs[0], actionSlug: reactionSlugs[0], slug: reactionSlugs[0],
      confidence: "certain", identity: `message:${message.id}`, source: "pf2e-reaction-strike" };
    // PF2e v14 creates this exact context for a completed Strike check; damage uses a different context type.
    return { actorId: actor.id, resource: "action", cost: 1, label: message.item?.name ?? "Strike", confidence: "certain", identity: `message:${message.id}` };
  }
}
