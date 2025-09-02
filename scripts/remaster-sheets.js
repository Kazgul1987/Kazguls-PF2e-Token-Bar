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
    onChange: (value) => {
      for (const app of Object.values(ui.windows)) {
        if (app instanceof ActorSheetPF2e) {
          const element = app.element?.[0] ?? app.element;
          applySheetMode(element, value);
        }
      }
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

Hooks.on("renderActorSheetPF2e", (app) => {
  const mode = game.settings.get("pf2e-token-bar", "remasterSheetMode");
  const element = app.element?.[0] ?? app.element;
  applySheetMode(element, mode);
});

