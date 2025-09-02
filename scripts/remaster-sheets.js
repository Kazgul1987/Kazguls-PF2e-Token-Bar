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

Hooks.on("renderActorSheet", (app, html) => {
  const style = game.settings.get("pf2e-token-bar", "remasterSheetMode");
  const element = html.closest(".sheet.character")[0];
  if (!element) return;
  element.classList.remove("dark-theme", "remasterLight", "remasterDark", "remasterRed");
  if (style !== "off") element.classList.add("dark-theme", style);
});

