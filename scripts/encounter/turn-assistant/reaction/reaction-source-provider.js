import { REACTION_SOURCES } from "./reaction-registry.js";

export class ReactionSourceProvider {
  static getSources(actor) {
    const items = Array.from(actor?.items ?? []);
    return items.flatMap((item, index) => {
      const slug = item.slug ?? item.system?.slug;
      const definition = REACTION_SOURCES[slug];
      if (!definition) return [];
      return [{ ...definition, sourceSlug: slug, id: `source:${item.id ?? definition.sourceId}:${index}` }];
    });
  }
}

