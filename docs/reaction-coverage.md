# PF2e v14 reaction source coverage

Inventory source: `reference/pf2e` commit `40e16e02d5ef0f04132ba39bb719f5a3c34c852b`. The pack search covered PF2e actions, class features, equipment, feats, spells, spell effects and feat effects; `src` was searched for chat context, action-cost, roll-option, item-origin, reroll, and granted-by handling. Descriptions were used **only during this development inventory**. Runtime detection uses slugs, UUID/source IDs, item state, action costs, and PF2e context options.

`FULL` means a persistent actor source and an executed reaction can be identified without prose. `PARTIAL` means the source is known but activation/target/duration is not emitted as a stable machine-readable event in all workflows. `MANUAL` means the public temporary-grant API is required.

| Source | Slug | UUID | Type | Amount | Refresh | Expiration | Restriction | Coverage / strategy |
|---|---|---|---|---:|---|---|---|---|
| Esoteric Reflexes | `esoteric-reflexes` | `Compendium.pf2e.feats-srd.Item.4n59y5tb9bxffKsi` | feat | 1 | own turn | never | implement-granted reactions | FULL: actor slug registry |
| Tactical Reflexes | `tactical-reflexes` | `Compendium.pf2e.feats-srd.Item.rzaoi5Roef9zO22G` | feat | 1 | own turn | never | Reactive Strike | FULL |
| Improved Dueling Riposte | `improved-dueling-riposte` | `Compendium.pf2e.feats-srd.Item.mgs7vxq6d3hQoswa` | feat | 1 | own turn | never | Dueling Riposte | FULL |
| Improved Twin Riposte (Fighter) | `improved-twin-riposte-fighter` | `Compendium.pf2e.feats-srd.Item.w2v5LZmpJy0MBxo5` | feat | 1 | own turn | never | Twin Riposte | FULL |
| Improved Twin Riposte (Ranger) | `improved-twin-riposte-ranger` | `Compendium.pf2e.feats-srd.Item.Cgk4By6gEomD2bJ0` | feat | 1 | own turn | never | Twin Riposte | FULL |
| Divine Reflexes | `divine-reflexes` | `Compendium.pf2e.feats-srd.Item.EvSfoYmuCDCRAvaF` | feat | 1 | own turn | never | champion reaction | FULL source; action grouping PARTIAL |
| Quick Shield Block | `quick-shield-block` | `Compendium.pf2e.feats-srd.Item.pRqcm5P2ZFihSpVI` | feat | 1 | own turn | never | Shield Block | FULL |
| Reflexive Riposte | `reflexive-riposte` | `Compendium.pf2e.feats-srd.Item.uotQ9yqetPoAWrfW` | feat | 1 | own turn | never | Opportune Riposte | FULL |
| Inexhaustible Countermoves | `inexhaustible-countermoves` | `Compendium.pf2e.feats-srd.Item.jG9YwAAvNbCShumf` | feat | 1 | enemy turn | end current turn | Opportune Riposte or Reactive Strike | PARTIAL: turn relation is known; hostile disposition is world-dependent |
| Slinger's Reflexes | `slingers-reflexes` | `Compendium.pf2e.feats-srd.Item.rMjlDss3Km1RQ8DE` | feat | 1 | creature turn | end current turn | gunslinger reactions | PARTIAL: action grouping |
| Preparation | `preparation` | `Compendium.pf2e.feats-srd.Item.zzMugLCUkQQPa2qT` | action feat | 1 | immediate | next own turn | rogue reactions | MANUAL: use is not a persistent effect |
| Reaction Time | `reaction-time` | `Compendium.pf2e.classfeatures.Item.qgEIQPhtEV6d1zB2` | class feature | 1 | own turn | never | guardian feat/class reactions plus Shield Block | PARTIAL: source FULL, grouping PARTIAL |
| Drilled Reactions | `drilled-reactions` | `Compendium.pf2e.classfeatures.Item.A5nOG2HuM8ZhMJ5p` | ally grant | 1 | tactic use | unused after tactic | that tactic | MANUAL: recipient and tactic require caller context |
| Drilled Reflexes | `drilled-reflexes` | `Compendium.pf2e.feats-srd.Item.Fen0uXQLiKRDP4ui` | feat modifier | up to 2 allies | tactic use | unused after tactic | that tactic | MANUAL grant API |
| Practiced Reflexes | `practiced-reflexes` | `Compendium.pf2e.feats-srd.Item.63jLdP6v8FbohoXb` | feat modifier | up to 4 allies | tactic use | unused after tactic | that tactic | MANUAL grant API |
| Wait For It… | `wait-for-it` | `Compendium.pf2e.actionspf2e.Item.5stdIykWux9WHqce` | action grant | 1 | immediate | designated Readied action | designated action | MANUAL grant API |
| Clockwork Shield | `clockwork-shield` | `Compendium.pf2e.equipment-srd.Item.S5CMsB7AyYC8iSa0` | equipment activation | 1 | immediate then own turn | 1 minute | Shield Block | MANUAL: ownership is not activation |
| Clockwork Shield (Greater) | `clockwork-shield-greater` | `Compendium.pf2e.equipment-srd.Item.ayST5rFSIKy2ynYk` | equipment activation | 1 | immediate then own turn | 1 minute | Shield Block | MANUAL |
| Helm of Zeal | `helm-of-zeal` | `Compendium.pf2e.equipment-srd.Item.h2gpUvHN3hTRS7jv` | equipment activation | 1 | immediate | next own turn | champion reaction | MANUAL |
| Helm of Zeal (Greater) | `helm-of-zeal-greater` | `Compendium.pf2e.equipment-srd.Item.FKf6eELtbFhbK69W` | equipment activation | 1 | immediate | next own turn | champion reaction | MANUAL |
| Seasoned Command | `seasoned-command` | `Compendium.pf2e.feats-srd.Item.c2hPWQ4zdc4CnrnZ` | skill feat/check | 1 | successful check | after Aid/use | Aid chosen ally | MANUAL: outcome and chosen ally must be supplied |
| Endless Return | `endless-return` | `Compendium.pf2e.feats-srd.Item.GXTB1hr7fvOw7PaU` | feat | 1 | own turn | never | Inevitable Return | FULL |
| Revel in Retribution | `revel-in-retribution` | `Compendium.pf2e.spells-srd.Item.Eed8QBWBtpufl1iP` | focus spell/effect | 1 | immediate then own turn | effect duration | Reactive Strike | PARTIAL: effect presence can be reconciled; initial grant needs cast event |
| Connective Current | `connective-current` | `Compendium.pf2e.spells-srd.Item.t6vJnkyAYLXrOjQI` | heightened spell | 1 | immediate then own turn | spell duration | spell movement reaction | PARTIAL: heightened rank/effect required |
| You Can't Kill an Idea | `you-cant-kill-an-idea` | `Compendium.pf2e.feats-srd.Item.R5oeNpNCOXU4OtIT` | mythic feat/effect | 2 | own turn | ideaform ends | general | PARTIAL: only active effect, not feat ownership, qualifies |
| Shield of Reckoning | `shield-of-reckoning` | `Compendium.pf2e.feats-srd.Item.VsTmB32x9673ONJ0` | feat reaction | 0 | — | — | matches both Shield Block and champion slots | FULL matcher support; most-specific eligible slot wins |

Additional broad pack-search hits (including creature abilities and adventure-specific entries) are intentionally not auto-registered: actor-owned NPC actions already use their explicit PF2e reaction action cost, while prose-only activation cannot safely create a bonus resource. They remain supported by the authority-safe temporary grant API.
