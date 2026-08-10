export class TurnWarnings {
  static get(actor) {
    const conditions = Array.from(actor?.conditions?.active ?? []);
    return conditions.flatMap(condition => {
      const slug = condition.slug ?? condition.system?.slug;
      if (!slug || !["persistent-damage", "dying", "stunned", "slowed", "frightened", "wounded"].includes(slug)) return [];
      const value = condition.badge?.value ?? condition.system?.badge?.value ?? condition.value;
      const suffix = value == null ? "" : ` ${value}`;
      return [{ slug, label: `${condition.name}${suffix}`, critical: ["persistent-damage", "dying"].includes(slug) }];
    });
  }
}
