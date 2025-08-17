# Kazguls-PF2e-Token-Bar

Displays a bar of party member tokens present in the scene at the top-right of the screen for PF2e games. Clicking a token opens the actor's character sheet. Includes a button for the GM to request rolls, presenting a dialog to choose tokens, skills or saving throws, and a DC. Compatible with Foundry VTT version 13.

## Debugging

Enable debug logging to see additional messages in the browser console.

1. Open **Settings → Configure Settings → Module Settings**.
2. Enable **PF2E Token Bar: Debug Logging**.

Debug logging can also be toggled from the console:

```javascript
game.settings.set("pf2e-token-bar", "debug", true);
```

