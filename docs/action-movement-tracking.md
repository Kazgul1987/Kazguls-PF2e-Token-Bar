# PF2e V14 chat action and movement tracking

## Verified PF2e data

The implementation was checked against these files in the local `reference/pf2e` checkout:

- `src/module/chat-message/data.ts` (`flags.pf2e.origin`, check contexts, options, traits, and reroll context)
- `src/module/chat-message/helpers.ts` (item-use messages and action glyphs)
- `src/module/item/ability/document.ts` and `src/module/item/feat/document.ts` (`actionCost`)
- `src/module/item/ability/helpers.ts` (action type/cost roll options)
- `src/module/actor/creature/document.ts`, `src/module/actor/creature/types.ts`, and
  `src/module/system/statistic/speed.ts` (derived `actor.movement.speeds[type].value`)
- `src/module/canvas/token/ruler.ts` (PF2e's distance/cost handling)

Reliable runtime inputs are `message.actor`, `message.item`, `flags.pf2e.origin.uuid`,
`flags.pf2e.context` (including `type`, `options`, and `traits`), item `actionCost`,
item `slug`/`uuid`/`sourceId`, and structured `action:*` roll options. No visible or
localized chat HTML is inspected. A text-only third-party card is deliberately ignored.

## Detection pipeline

The authority processes each message in this priority order: Strike, item-less PF2e
SystemAction, then generic PF2e Activity. Rerolls are rejected first. Detector processing
stops after the first match, and every event uses `message:<id>` for persisted idempotency.
Reaction strikes and reaction cards remain reaction events; free actions cost zero.
Generic item activities require an actor, item, supported action cost, and either an
executed structured context or a matching PF2e item origin. This supports compatible
third-party modules without identifying the originating UI or module. Damage/healing
follow-ups, ambiguous roll options, unverifiable text-only cards, and `stand` are ignored.
`stand` remains exclusively owned by `ProneTracker`.

## Movement accounting

Distance-based movement applies to `stride -> land`, `sneak -> land`, `fly -> fly`,
`climb -> climb`, and `swim -> swim`. `step`, `crawl`, `leap`, `high-jump`, and
`long-jump` retain their verified fixed PF2e action costs; they are not divided by land
speed. A movement chat card creates a typed intent. Continuous movement consumes the
unpaid intent and charges the measured session, while a fixed, already-paid movement
intent suppresses the following token-movement charge. An unpaid intent with no token
movement expires without synthesizing a movement session.

Each `updateToken` segment is measured between the pre-update and post-update token
centers with Foundry V14 `canvas.grid.measurePath`, then added to the debounced session.
This preserves scene units, configured diagonal rules, turns in the route, and elevation
handling supplied by Foundry's path API. At finalization the current derived speed is read
without a global cache and the cost is `ceil(totalDistance / effectiveSpeed)`. A positive
distance always costs at least one action, exact speed boundaries do not round upward,
and costs above three remain a single history entry. Existing state clamping, overspend,
and undo therefore apply to the full detected cost.

If a requested fly/climb/swim speed is absent, the session is conservatively ignored and
debug logging explains why; land is the default when there is no intent. PF2e/Foundry do
not expose terrain-adjusted cost on ordinary token document updates, so this tracker does
not pretend to infer difficult terrain. Forced-movement ambiguity likewise remains
subject to the existing active-combatant, paused-game, authority, and GM-movement guards.
