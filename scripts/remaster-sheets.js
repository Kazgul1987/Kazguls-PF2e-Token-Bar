const MODULE_ID = "pf2e-token-bar";
const THEME_CLASSES = ["dark-theme", "dark-npc-theme", "remasterLight", "remasterDark", "remasterRed"];

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "remasterSheetMode", {
    name: game.i18n.localize("PF2ETokenBar.Settings.RemasterSheetMode.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.RemasterSheetMode.Hint"),
    scope: "client",
    config: true,
    type: String,
    default: "off",
    choices: {
      off: game.i18n.localize("PF2ETokenBar.Settings.RemasterSheetMode.Choices.Off"),
      remasterLight: game.i18n.localize("PF2ETokenBar.Settings.RemasterSheetMode.Choices.RemasterLight"),
      remasterDark: game.i18n.localize("PF2ETokenBar.Settings.RemasterSheetMode.Choices.RemasterDark"),
      remasterRed: game.i18n.localize("PF2ETokenBar.Settings.RemasterSheetMode.Choices.RemasterRed"),
    },
    onChange: applyModeToRenderedSheets,
  });
});

function applySheetMode(element, mode) {
  if (!(element instanceof HTMLElement)) return;
  element.classList.remove(...THEME_CLASSES);
  if (mode === "off") return;

  const isNpc = element.classList.contains("npc") || element.matches('[data-document-type="npc"]');
  element.classList.add(mode, isNpc ? "dark-npc-theme" : "dark-theme");
}

function applyModeToRenderedSheets(mode) {
  // Settings changes only need the live DOM; this avoids ui.windows and PF2e sheet globals.
  for (const element of document.querySelectorAll(".application.actor.sheet, .app.actor.sheet")) {
    applySheetMode(element, mode);
  }
}

function themeRenderedSheet(application) {
  const mode = game.settings.get(MODULE_ID, "remasterSheetMode");
  applySheetMode(application.element, mode);
}

Hooks.on("renderCharacterSheetPF2e", themeRenderedSheet);
Hooks.on("renderNPCSheetPF2e", themeRenderedSheet);
