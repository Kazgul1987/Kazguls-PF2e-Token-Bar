Hooks.once("init", () => {
  game.settings.register("pf2e-token-bar", "characterSheetStyle", {
    name: "Character Sheet Style",
    scope: "client",
    config: true,
    type: String,
    choices: {
      standard: "standard",
      remaster: "remaster",
      red: "red",
      dark: "dark"
    },
    default: "standard"
  });
});

Hooks.on("renderActorSheet", (_app, html) => {
  const style = game.settings.get("pf2e-token-bar", "characterSheetStyle");
  const element = html[0];
  if (!element) return;
  element.classList.remove("dark-theme", "remaster", "red", "dark");
  if (style !== "standard") element.classList.add("dark-theme", style);
});

