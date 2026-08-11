const SCORES = { "exact-uuid": 600, "exact-action": 500, "action-list": 400, "champion-reaction": 300,
  "rogue-reaction": 300, "gunslinger-reaction": 300, "guardian-reaction": 300, "dueling-reaction": 300,
  "thaumaturge-implement": 250, custom: 200, general: 0 };

export class ReactionMatcher {
  static matches(slot, event) {
    if (!slot || slot.remaining < 1) return false;
    const restriction = slot.restriction ?? { type: "general" };
    if (restriction.type === "general") return true;
    if (restriction.type === "exact-uuid") return restriction.values?.includes(event.actionUuid) || restriction.values?.includes(event.sourceUuid);
    if (["exact-action", "action-list"].includes(restriction.type)) return restriction.values?.includes(event.actionSlug ?? event.slug);
    if (restriction.type === "custom") return restriction.provider?.(event, slot) === true;
    return event.groups?.includes(restriction.type) === true;
  }

  static matching(slots, event) {
    return slots.filter(slot => this.matches(slot, event)).sort((a, b) =>
      (SCORES[b.restriction?.type ?? "general"] ?? 100) - (SCORES[a.restriction?.type ?? "general"] ?? 100)
      || String(a.id).localeCompare(String(b.id)));
  }
}

