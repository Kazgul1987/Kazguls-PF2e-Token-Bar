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

const applySheetMode = (element, mode, useNpc) => {
  if (!element) return;
  element.classList.remove("dark-theme", "dark-npc-theme", "remaster", "red", "dark");
  if (mode === "remasterLight") {
    if (useNpc) element.classList.add("dark-npc-theme", "remaster");
    else element.classList.add("remaster");
  } else if (mode === "remasterDark") {
    element.classList.add(useNpc ? "dark-npc-theme" : "dark-theme", "remaster");
  } else if (mode === "remasterRed") {
    element.classList.add(useNpc ? "dark-npc-theme" : "dark-theme", "red");
  }
};

Hooks.on("renderCharacterSheetPF2e", (_app, html) => {
  const mode = game.settings.get("pf2e-token-bar", "remasterSheetMode");
  applySheetMode(html[0], mode, false);
});

Hooks.on("renderNPCSheetPF2e", (_app, html) => {
  const mode = game.settings.get("pf2e-token-bar", "remasterSheetMode");
  applySheetMode(html[0], mode, true);
});

