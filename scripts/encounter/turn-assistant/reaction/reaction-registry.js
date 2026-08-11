/** PF2e v14 data verified at reference/pf2e commit 40e16e0. Runtime never reads reference/. */
export const REACTION_SOURCES = Object.freeze({
  "esoteric-reflexes": source("4n59y5tb9bxffKsi", "Esoteric Reflexes", "thaumaturge-implement"),
  "tactical-reflexes": source("rzaoi5Roef9zO22G", "Tactical Reflexes", "exact-action", ["reactive-strike"]),
  "improved-dueling-riposte": source("mgs7vxq6d3hQoswa", "Improved Dueling Riposte", "exact-action", ["dueling-riposte"]),
  "improved-twin-riposte-fighter": source("w2v5LZmpJy0MBxo5", "Improved Twin Riposte (Fighter)", "exact-action", ["twin-riposte"]),
  "improved-twin-riposte-ranger": source("Cgk4By6gEomD2bJ0", "Improved Twin Riposte (Ranger)", "exact-action", ["twin-riposte"]),
  "divine-reflexes": source("EvSfoYmuCDCRAvaF", "Divine Reflexes", "champion-reaction"),
  "quick-shield-block": source("pRqcm5P2ZFihSpVI", "Quick Shield Block", "exact-action", ["shield-block"]),
  "reflexive-riposte": source("uotQ9yqetPoAWrfW", "Reflexive Riposte", "exact-action", ["opportune-riposte"]),
  "endless-return": source("GXTB1hr7fvOw7PaU", "Endless Return", "exact-action", ["inevitable-return"]),
  "reaction-time": source("qgEIQPhtEV6d1zB2", "Reaction Time", "guardian-reaction", [], { pack: "classfeatures" }),
  "inexhaustible-countermoves": source("jG9YwAAvNbCShumf", "Inexhaustible Countermoves", "action-list", ["opportune-riposte", "reactive-strike"], { refresh: "start-enemy-turn", expires: "end-current-turn" }),
  "slingers-reflexes": source("rMjlDss3Km1RQ8DE", "Slinger's Reflexes", "gunslinger-reaction", [], { refresh: "start-creature-turn", expires: "end-current-turn" }),
});

function source(id, label, type, values = [], timing = {}) {
  return Object.freeze({ sourceUuid: `Compendium.pf2e.${timing.pack ?? "feats-srd"}.Item.${id}`, sourceId: id, label, amount: 1,
    sourceType: "feat", refresh: timing.refresh ?? "start-own-turn", expires: timing.expires ?? "never",
    initialRemaining: timing.refresh?.includes("creature-turn") || timing.refresh?.includes("enemy-turn") ? 0 : 1, restriction: { type, values } });
}

/** Verified reaction actions which can produce attack rolls. */
export const REACTION_STRIKE_SLUGS = new Set(["reactive-strike", "implement-s-interruption", "dueling-riposte", "twin-riposte", "opportune-riposte"]);
