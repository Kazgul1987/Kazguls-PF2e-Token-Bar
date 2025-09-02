Hooks.once("init", () => {
  game.settings.register("pf2e-token-bar", "remasterSheetMode", {
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
  });
});

function applySheetMode(element, mode) {
  if (!element) return;

  element.classList.remove(
    "dark-theme",
    "dark-npc-theme",
    "remasterLight",
    "remasterDark",
    "remasterRed"
  );

  if (mode === "off") return;

  const theme = element.classList.contains("npc") ? "dark-npc-theme" : "dark-theme";
  element.classList.add(mode, theme);
}

Hooks.on("renderActorSheet", (app, html) => {
  const mode = game.settings.get("pf2e-token-bar", "remasterSheetMode");
  const element = html.closest(".sheet")[0];
  applySheetMode(element, mode);
});

