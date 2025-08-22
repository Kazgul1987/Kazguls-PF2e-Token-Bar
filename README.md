# PF2e Token-Bar

The **PF2e Token-Bar** extends Foundry VTT with a compact display of all relevant characters at the top of the screen. It allows quick interactions with tokens, linked character sheets, and various party actions—optimized for Pathfinder 2e.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Party Mode](#party-mode)
3. [Combat Mode](#combat-mode)
4. [Ring Menu](#ring-menu)
5. [Fortification Automation](#fortification-automation)
6. [Settings & Controls](#settings--controls)
7. [Hotkeys](#hotkeys)
8. [Debugging](#debugging)

---

## Feature Overview

- **Token bar** with portraits of relevant actors (party or combatants).  
- **HP bar & value** directly under the token.  
- **Hero Points:** plus/minus buttons for quick adjustment.  
- **Effect bar:** active effects and conditions as icons (click to open, right-click to remove).  
- **Roll requests:** “Request Roll” button creates chat links for skills or saving throws.  
- **Orientation & position:** horizontal or vertical, freely movable, scalable.  
- **Collapsible** and can be **locked** to prevent repositioning.

---

## Party Mode

Active when **no combat is running**.

### Display

- Shows all party members (actors from the party).  
- HP bar, hero points, and effects as described above.

### Additional Buttons

- **Add party to encounter** – creates a new encounter and adds all party tokens.  
- **Heal all** – sets HP of all party members to the maximum.  
- **Rest all** – triggers “Rest for the Night” for the entire party.  
- **Party stash** – opens the party inventory; items can be dragged & dropped.  
- **Loot / Sell** – opens named loot actors and accepts items via drag & drop.  
- **Request roll** – see above.  
- **Start encounter** – begins a new encounter (button toggles to “End encounter”).

---

## Combat Mode

Active when an **encounter is running** or combatants exist.

### Display

- Shows all combatants, sorted by initiative (NPCs first on tie).  
- **Initiative values** per token; missing values show “RFC!” (roll for initiative).  
- **Current turn:** the active combatant’s token is highlighted.  
- **Round counter** and **encounter difficulty** (Trivial to Extreme).  
- **Delay/play icons:** delay a turn or resume it, including hourglass/play symbols.

### Additional Buttons

- **End encounter** – ends the current combat.  
- **NPC initiative** – rolls initiative for all NPCs without a value.  
- **Previous/Next turn** – navigate the active combatant.  
- **Request roll** – also available during combat.  
- **Toggle visibility** – expand or minimize the token bar.

---

## Ring Menu

Right-click a token to open a radial menu:

| Icon | Function |
|------|----------|
| 📋 List | **Add/remove condition** (Condition Manager) |
| 👁️ / 🚫 | **Toggle visibility** |
| 🎯 | **Ping** the token’s position |
| ⌛ / ▶️ | **Delay or resume** turn (combat only) |
| 🎲 | **Roll initiative** (if unset) |

---

## Fortification Automation

Automatically handle Fortification armor runes on critical hits.

- Enable the **Auto Fortification** setting under *Settings → Module Settings → PF2e Token-Bar*.
- When a creature with a **Fortification** or **Greater Fortification** rune suffers a critical hit, a chat button prompts a **flat check** (DC 17 or DC 14 for greater fortification).
- Success downgrades the critical hit to normal damage and rolls the weapon's damage automatically.

---

## Settings & Controls

Under **Settings → Module Settings → PF2e Token-Bar**:

- **Enable PF2e Token-Bar** – toggle the bar on or off.  
- **Close default combat tracker** – prevents auto-opening of Foundry’s combat tracker.  
- **Bar size** – scale between 50% and 200%.  
- **Orientation** – horizontal or vertical (also via button on the bar).  
- **Lock bar** – prevents accidental moving.
- **Position** – automatically saved after moving.
- **Encounter mode** – when enabled (default), the bar switches to combatants during encounters and shows round counter and difficulty.
- **Encounter scrollbar** – when disabled, the bar extends to the right without scrolling.
- **Quick loot** – automatically transfer defeated NPC loot and open the Loot actor when combat ends.

---

## Hotkeys

- **T** – toggle targeting for the currently hovered token.

---

## Debugging

Enable **“PF2E Token Bar: Debug Logging”** in the module settings for additional console messages.

```javascript
// Alternatively via the browser console:
game.settings.set("pf2e-token-bar", "debug", true);
```

Enjoy the PF2e Token-Bar and quick access to party and combat functions!

