import test from "node:test";
import assert from "node:assert/strict";

globalThis.game = {
  pf2e: { actions: new Map() },
  i18n: { localize: value => value },
  settings: { get: () => false },
  actors: new Map(),
};

const { PF2eAdapter } = await import("../scripts/integrations/pf2e.js");
const { SystemActionDetector } = await import("../scripts/encounter/turn-assistant/detectors/system-action-detector.js");

const actions = [
  ["climb", 1, []], ["swim", 1, []], ["sneak", 1, []], ["leap", 1, []],
  ["high-jump", 2, ["action:stride", "action:leap"]],
  ["long-jump", 2, ["action:stride", "action:leap"]],
];
for (const [slug, cost, rollOptions] of actions) {
  game.pf2e.actions.set(slug, { slug, cost, rollOptions, name: `PF2E.Actions.${slug}.Title` });
}

function message(slug, { id = slug, actor = { id: "actor" }, traits = ["move"], options } = {}) {
  return {
    id, actor,
    flags: { pf2e: { context: { type: "check", options: options ?? [`action:${slug}`], traits } } },
  };
}

test("detects item-less PF2e movement checks and their V14 costs", () => {
  for (const [slug, cost] of actions) {
    const options = slug.endsWith("jump")
      ? ["action:stride", "action:leap", `action:${slug}`]
      : undefined;
    const event = SystemActionDetector.detect(message(slug, { options }));
    assert.equal(event.slug, slug);
    assert.equal(event.cost, cost);
    assert.equal(event.source, "pf2e-system-action");
    assert.equal(event.movement, true);
  }
});

test("rejects ordinary skill rolls, missing move traits, ambiguous actions, and rerolls", () => {
  assert.equal(SystemActionDetector.detect(message("athletics", { options: [] })), null);
  assert.equal(SystemActionDetector.detect(message("climb", { traits: [] })), null);
  assert.equal(SystemActionDetector.detect(message("climb", { options: ["action:climb", "action:swim"] })), null);
  const reroll = message("climb"); reroll.flags.pf2e.context.isReroll = true;
  assert.equal(SystemActionDetector.detect(reroll), null);
});

function actorWith({ quickened = false, slowed = 0 } = {}) {
  const conditions = new Map();
  if (quickened) conditions.set("quickened", { slug: "quickened", active: true });
  if (slowed) conditions.set("slowed", { slug: "slowed", active: true, badge: { value: slowed } });
  return {
    conditions: {
      hasType: slug => conditions.has(slug),
      bySlug: slug => conditions.has(slug) ? [conditions.get(slug)] : [],
    },
  };
}

test("calculates only quickened and slowed at turn start", () => {
  for (const [conditions, expected] of [
    [{}, 3], [{ quickened: true }, 4], [{ slowed: 1 }, 2], [{ slowed: 2 }, 1],
    [{ quickened: true, slowed: 1 }, 3], [{ quickened: true, slowed: 2 }, 2], [{ slowed: 9 }, 0],
  ]) {
    assert.equal(PF2eAdapter.getTurnStartActionEconomy(actorWith(conditions)).actions, expected);
  }
});
