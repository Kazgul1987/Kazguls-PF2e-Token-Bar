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

Hooks.on("renderActorSheet", (_app, html) => {
  const mode = game.settings.get("pf2e-token-bar", "remasterSheetMode");
  const element = html[0];
  if (!element) return;
  element.classList.remove("dark-theme", "remaster", "red", "dark");
  if (mode === "remasterLight") {
    element.classList.add("remaster");
  } else if (mode === "remasterDark") {
    element.classList.add("dark-theme", "remaster");
  } else if (mode === "remasterRed") {
    element.classList.add("dark-theme", "red");
  }
});

