import test from "node:test";
import assert from "node:assert/strict";

const settingValues = new Map();
globalThis.game = {
  pf2e: { actions: new Map() },
  i18n: { localize: value => value },
  settings: { get: (_module, key) => settingValues.get(key) ?? false },
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

const { ReactionTracker } = await import("../scripts/encounter/turn-assistant/reaction/reaction-tracker.js");
const { StrikeDetector } = await import("../scripts/encounter/turn-assistant/detectors/strike-detector.js");
const { ReactionSourceProvider } = await import("../scripts/encounter/turn-assistant/reaction/reaction-source-provider.js");
const { generalSlot } = await import("../scripts/encounter/turn-assistant/reaction/reaction-state.js");
const { ActivityDetector } = await import("../scripts/encounter/turn-assistant/detectors/activity-detector.js");
const { ActionState } = await import("../scripts/encounter/turn-assistant/action-state.js");
const { ActionTracker } = await import("../scripts/encounter/turn-assistant/action-tracker.js");
const { ProneTracker } = await import("../scripts/encounter/turn-assistant/prone-tracker.js");
const { MovementTracker } = await import("../scripts/encounter/turn-assistant/movement-tracker.js");
const { MovementIntent } = await import("../scripts/encounter/turn-assistant/movement-intent.js");

function reactionState(slugs = []) {
  const actor = { items: slugs.map((slug, i) => ({ id: `i${i}`, slug })) };
  const state = { reactions: { version: 2, general: generalSlot(), bonus: [] } };
  ReactionTracker.reconcile(state, actor); return state;
}

test("reaction providers keep general and restricted sources separate", () => {
  assert.equal(ReactionSourceProvider.getSources({ items: [] }).length, 0);
  for (const [slug, type, action] of [
    ["esoteric-reflexes", "thaumaturge-implement"],
    ["quick-shield-block", "exact-action", "shield-block"],
    ["tactical-reflexes", "exact-action", "reactive-strike"],
  ]) {
    const state = reactionState([slug]); assert.equal(state.reactions.bonus.length, 1);
    assert.equal(state.reactions.bonus[0].restriction.type, type);
    if (action) assert.deepEqual(state.reactions.bonus[0].restriction.values, [action]);
  }
});

test("specific reaction slot is spent first and undo snapshot is exact", () => {
  const state = reactionState(["quick-shield-block"]);
  const result = ReactionTracker.spend(state, { actionSlug: "shield-block" });
  assert.match(result.slot.id, /^source:/); assert.equal(result.slot.remaining, 0);
  assert.equal(state.reactions.general.remaining, 1);
  Object.assign(result.slot, result.before); assert.equal(result.slot.remaining, 1);
  const fallback = ReactionTracker.spend(state, { actionSlug: "aid" });
  assert.equal(fallback.slot.id, "general");
});

test("five independent reaction resources survive sequential matching", () => {
  const state = reactionState(["esoteric-reflexes", "quick-shield-block", "tactical-reflexes"]);
  ReactionTracker.grantTemporary(state, { id: "temporary", restriction: { type: "exact-action", values: ["temp-action"] } });
  assert.equal(1 + state.reactions.bonus.length, 5);
  for (const event of [
    { actionSlug: "implements-interruption", groups: ["thaumaturge-implement"] },
    { actionSlug: "shield-block" }, { actionSlug: "reactive-strike" }, { actionSlug: "other" }, { actionSlug: "temp-action" },
  ]) assert.ok(ReactionTracker.spend(state, event));
  assert.ok([state.reactions.general, ...state.reactions.bonus].every(slot => slot.remaining === 0));
});

test("reaction refresh is source-specific and temporary expiration is supported", () => {
  const state = reactionState(["quick-shield-block"]); ReactionTracker.spend(state, { actionSlug: "shield-block" });
  ReactionTracker.grantTemporary(state, { id: "enemy", refresh: "start-enemy-turn", expires: "end-current-turn" });
  ReactionTracker.refresh(state, "start-enemy-turn");
  assert.equal(state.reactions.bonus.find(s => s.id === "enemy").remaining, 1);
  assert.equal(state.reactions.bonus[0].remaining, 0);
  ReactionTracker.refresh(state, "end-current-turn"); assert.equal(state.reactions.bonus.some(s => s.id === "enemy"), false);
  ReactionTracker.refresh(state, "start-own-turn"); assert.equal(state.reactions.bonus[0].remaining, 1);
});

test("first-turn gate distinguishes unavailable, initialized, and spent", () => {
  const combatant = { id: "c", actorId: "a", combat: { id: "combat", round: 1, turn: 1 } };
  const state = ActionState.create(combatant, 3, null, { reactionsInitialized: false });
  assert.equal(state.reactions.initialized, false);
  assert.equal(state.reactions.general.remaining, 0);
  ReactionTracker.reconcile(state, { items: [{ id: "q", slug: "quick-shield-block" }] });
  assert.equal(state.reactions.bonus[0].remaining, 0);
  assert.equal(ReactionTracker.spend(state, { actionSlug: "shield-block" }), null);
  assert.equal(state.reactions.initialized, false, "attempted use must not initialize reactions");
  ReactionTracker.refresh(state, "start-own-turn");
  assert.equal(state.reactions.initialized, true);
  assert.deepEqual([state.reactions.general.remaining, state.reactions.bonus[0].remaining], [1, 1]);
  ReactionTracker.spend(state, { actionSlug: "shield-block" });
  assert.deepEqual([state.reactions.general.remaining, state.reactions.bonus[0].remaining], [1, 0]);
  ReactionTracker.refresh(state, "start-own-turn");
  assert.deepEqual([state.reactions.general.remaining, state.reactions.bonus[0].remaining], [1, 1]);
});

function reactionCard(slug, { id = slug, context = false, origin = true } = {}) {
  const actor = { id: "reactor" };
  const item = { id: `item-${slug}`, name: slug, slug, actor, uuid: `Actor.reactor.Item.${slug}`,
    sourceId: `Compendium.pf2e.actionspf2e.Item.${slug}`, actionCost: { type: "reaction", value: 1 } };
  return { id, actor, item, flags: { pf2e: {
    ...(context ? { context: { type: "roll" } } : {}),
    ...(origin ? { origin: { uuid: item.uuid, sourceId: item.sourceId, type: "feat" } } : {}),
  } } };
}

test("Shield Block and Reactive Strike item-use cards need no PF2e context", () => {
  for (const slug of ["shield-block", "reactive-strike"]) {
    const event = ActivityDetector.detect(reactionCard(slug));
    assert.equal(event.resource, "reaction");
    assert.equal(event.actionSlug, slug);
    assert.equal(event.source, "pf2e-reaction-card");
  }
});

test("reaction cards require a matching PF2e item origin and ignore rerolls", () => {
  assert.equal(ActivityDetector.detect(reactionCard("shield-block", { origin: false })), null);
  const mismatch = reactionCard("shield-block"); mismatch.flags.pf2e.origin.uuid = "Actor.other.Item.other";
  mismatch.flags.pf2e.origin.sourceId = "Compendium.other";
  assert.equal(ActivityDetector.detect(mismatch), null);
  const reroll = reactionCard("shield-block"); reroll.isReroll = true;
  assert.equal(ActivityDetector.detect(reroll), null);
});

function activityMessage(cost, { id = `activity-${cost.type}-${cost.value}`, context = null, external = false } = {}) {
  const actor = { id: "activity-actor" };
  const item = { actor, name: "Structured Activity", slug: "structured-activity",
    uuid: "Actor.activity-actor.Item.activity", actionCost: cost };
  return { id, actor, item, flags: { pf2e: {
    origin: { uuid: item.uuid, type: "action" },
    ...(context ? { context } : {}),
    ...(external ? { externalModule: true } : {}),
  } }, content: "<p>Localized text is intentionally irrelevant</p>" };
}

test("structured PF2e item cards support 1/2/3 actions, free actions, and external modules", () => {
  for (const value of [1, 2, 3]) {
    const event = ActivityDetector.detect(activityMessage({ type: "action", value }, { external: true }));
    assert.equal(event.resource, "action"); assert.equal(event.cost, value);
    assert.equal(event.source, "pf2e-chat-activity");
  }
  const free = ActivityDetector.detect(activityMessage({ type: "free", value: null }));
  assert.equal(free.resource, "free"); assert.equal(free.cost, 0);
  const rolled = ActivityDetector.detect(activityMessage({ type: "action", value: 2 }, { context: { type: "check", outcome: "success", options: [] } }));
  assert.equal(rolled.cost, 2);
});

test("chat HTML without structured PF2e actor/item/origin data is ignored", () => {
  assert.equal(ActivityDetector.detect({ id: "text", content: "<p>Stride</p>", flavor: "Aktion" }), null);
});

test("Stand remains deferred to ProneTracker", () => {
  const card = activityMessage({ type: "action", value: 1 }); card.item.slug = "stand";
  assert.equal(ActivityDetector.detect(card), null);
});

test("movement cost uses exact speed boundaries and permits overspend-sized costs", () => {
  for (const [distance, expected] of [[0, 0], [10, 1], [30, 1], [31, 2], [50, 2], [60, 2], [61, 3], [90, 3], [100, 4]]) {
    assert.equal(MovementTracker.actionsRequired(distance, 30), expected);
  }
  assert.equal(MovementTracker.actionsRequired(50, 40), 2, "fly speed");
  assert.equal(MovementTracker.actionsRequired(25, 15), 2, "climb speed");
});

test("multi-segment movement sums every measured turn rather than its endpoints", () => {
  globalThis.canvas = {
    dimensions: { size: 100 },
    grid: { measurePath: ([from, to]) => ({ distance: Math.abs(to.x - from.x) / 5 + Math.abs(to.y - from.y) / 5 }) },
  };
  const token = { width: 1, height: 1 };
  const points = [{ x: 0, y: 0, elevation: 0 }, { x: 100, y: 0, elevation: 0 },
    { x: 100, y: 100, elevation: 0 }, { x: 150, y: 100, elevation: 0 }];
  const distance = points.slice(1).reduce((sum, point, index) => sum + MovementTracker.measureSegment(token, points[index], point), 0);
  assert.equal(distance, 50); assert.equal(MovementTracker.actionsRequired(distance, 30), 2);
  delete globalThis.canvas;
});

test("PF2e derived movement speeds and movement slug classification are used", () => {
  const actor = { movement: { speeds: { land: { value: 30 }, fly: { value: 40 }, climb: { value: 15 }, swim: null } } };
  assert.equal(PF2eAdapter.getMovementSpeed(actor), 30);
  assert.equal(PF2eAdapter.getMovementSpeed(actor, "fly"), 40);
  assert.equal(PF2eAdapter.getMovementSpeed(actor, "climb"), 15);
  assert.equal(PF2eAdapter.getMovementSpeed(actor, "swim"), null);
  assert.deepEqual(["stride", "sneak", "fly", "climb", "swim"].map(slug => PF2eAdapter.getMovementType(slug)),
    ["land", "land", "fly", "climb", "swim"]);
  for (const slug of ["step", "crawl", "leap", "high-jump", "long-jump", "stand"]) assert.equal(PF2eAdapter.getMovementType(slug), null);
});

test("movement intent carries type and paid state for chat/token deduplication", () => {
  settingValues.set("movementIntentTimeout", 8000); MovementIntent.clear();
  MovementIntent.add({ actorId: "a", combatantId: "c", slug: "fly", movementType: "fly", cost: 1, identity: "message:m", paid: false });
  const intent = MovementIntent.consume("a", "c");
  assert.equal(intent.movementType, "fly"); assert.equal(intent.paid, false); assert.equal(intent.identity, "message:m");
  assert.equal(MovementIntent.consume("a", "c"), null);
});

test("reaction strike intent suppresses exactly one correlated strike roll", () => {
  ActionTracker.reactionStrikeIntents.clear();
  ActionTracker.addReactionStrikeIntent("reactor", "reactive-strike", 100);
  assert.equal(ActionTracker.consumeReactionStrikeIntent("reactor", "reactive-strike", 101), true);
  assert.equal(ActionTracker.consumeReactionStrikeIntent("reactor", "reactive-strike", 102), false);
  ActionTracker.addReactionStrikeIntent("reactor", "reactive-strike", 100);
  assert.equal(ActionTracker.consumeReactionStrikeIntent("reactor", "reactive-strike", 10101), false);
});

test("reaction strike detector prevents normal action charging and rerolls", () => {
  const weapon = { isOfType: (...types) => types.includes("weapon") };
  const reactive = { id: "rx", actor: { id: "a" }, item: weapon, flags: { pf2e: { context: { type: "attack-roll", options: ["action:reactive-strike"] } } } };
  const event = StrikeDetector.detect(reactive);
  assert.equal(event.resource, "reaction"); assert.equal(event.cost, 1);
  reactive.flags.pf2e.context.isReroll = true; assert.equal(StrikeDetector.detect(reactive), null);
});

test("Kip Up detection uses the verified feat slug or source, never its localized name", () => {
  assert.equal(PF2eAdapter.hasKipUp({ items: [{ type: "feat", slug: "kip-up", name: "Aufspringen" }] }), true);
  assert.equal(PF2eAdapter.hasKipUp({ items: [{ type: "feat", slug: "other", name: "Kip Up" }] }), false);
  assert.equal(PF2eAdapter.hasKipUp({ items: [{ type: "feat", slug: "renamed", sourceId: PF2eAdapter.KIP_UP_SOURCE_ID }] }), true);
});

test("prone removal charges only the active combatant, supports Kip Up, overspend, dedupe, and undo", async () => {
  settingValues.set("turnAssistant", true); settingValues.set("autoActions", true);
  game.user = { id: "gm" };
  game.users = [{ id: "gm", active: true, isGM: true }];
  game.paused = false;

  const actor = { id: "actor", name: "Valeros", items: [] };
  let state;
  const combatant = {
    id: "combatant", actorId: actor.id, actor,
    combat: { id: "combat", round: 2, turn: 1 },
    getFlag: async () => state,
    setFlag: async (_module, _key, value) => { state = structuredClone(value); },
  };
  game.combat = { id: "combat", round: 2, turn: 1, started: true, combatant };
  state = ActionState.create(combatant, 3);
  const prone = { id: "prone-id", type: "condition", slug: "prone", actor };

  assert.equal(await ProneTracker.onDeleteItem({ ...prone, slug: "frightened" }), false);
  assert.equal(await ProneTracker.onDeleteItem(prone), true);
  assert.equal(state.actions.remaining, 2);
  assert.equal(state.history.at(-1).source, "prone-removed");
  assert.equal(state.history.at(-1).label, "PF2ETokenBar.TurnAssistant.Stand");
  assert.equal(await ProneTracker.onDeleteItem(prone), false, "the deterministic identity deduplicates a repeated hook/signal");
  assert.equal(state.actions.remaining, 2);
  await ActionTracker.undoLocal(combatant); assert.equal(state.actions.remaining, 3);

  assert.equal(await ActionTracker.recordLocal(combatant, { resource: "action", cost: 2, label: "Move 50 ft", identity: "movement:test" }), true);
  assert.equal(state.actions.remaining, 1); assert.equal(state.history.at(-1).cost, 2);
  await ActionTracker.undoLocal(combatant); assert.equal(state.actions.remaining, 3, "one undo restores the whole movement session");

  assert.equal(await ActionTracker.recordLocal(combatant, { resource: "action", cost: 4, label: "Move 100 ft", identity: "movement:overspend" }), true);
  assert.equal(state.actions.remaining, 0); assert.equal(state.overSpent, true); assert.equal(state.history.at(-1).cost, 4);
  await ActionTracker.undoLocal(combatant); assert.equal(state.actions.remaining, 3);

  actor.items = [{ type: "feat", slug: "kip-up" }];
  assert.equal(await ProneTracker.onDeleteItem({ ...prone, id: "kip" }), false);
  assert.equal(state.actions.remaining, 3);

  actor.items = [];
  game.combat.combatant = { ...combatant, actorId: "other", actor: { id: "other" } };
  assert.equal(await ProneTracker.onDeleteItem({ ...prone, id: "inactive" }), false);
  assert.equal(state.actions.remaining, 3);

  game.combat.combatant = combatant; state.actions.remaining = 0;
  assert.equal(await ProneTracker.onDeleteItem({ ...prone, id: "overspend" }), true);
  assert.equal(state.actions.remaining, 0); assert.equal(state.overSpent, true);

  game.combat.started = false;
  assert.equal(await ProneTracker.onDeleteItem({ ...prone, id: "cleanup" }), false);
  settingValues.clear();
});
