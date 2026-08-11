import { PF2eAdapter } from "../../../integrations/pf2e.js";

const MODULE_ID = "pf2e-token-bar";

/** Detect item-less PF2e SystemAction/SingleCheckAction movement checks. */
export class SystemActionDetector {
  static detect(message) {
    if (PF2eAdapter.isRerollMessage(message)) return null;
    const context = PF2eAdapter.getMessageContext(message);
    if (!context) return null;
    const slug = PF2eAdapter.getMessageActionSlug(message);
    if (!slug) {
      if (context.options?.some?.(option => typeof option === "string" && option.startsWith("action:"))) {
        this.debug("System action detection skipped", { reason: "no unique action slug", messageId: message.id });
      }
      return null;
    }
    const actor = PF2eAdapter.resolveMessageActor(message);
    const cost = PF2eAdapter.getSystemActionCost(slug);
    const movement = PF2eAdapter.MOVEMENT_ACTION_SLUGS.has(slug) && PF2eAdapter.getMessageTraits(message).includes("move");
    if (!actor || !cost || !movement) return null;
    const event = {
      actorId: actor.id,
      resource: "action",
      cost,
      label: PF2eAdapter.getSystemActionLabel(slug, message),
      slug,
      movement: true,
      confidence: "certain",
      source: "pf2e-system-action",
      identity: `message:${message.id}`,
    };
    this.debug("PF2e system action detected", { slug, cost, movement: true, confidence: "certain" });
    return event;
  }

  static debug(label, data) {
    if (game.settings.get(MODULE_ID, "debug")) console.debug(`${MODULE_ID} | ${label}`, data);
  }
}
