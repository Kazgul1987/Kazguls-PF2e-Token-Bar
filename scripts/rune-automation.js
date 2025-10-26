Hooks.once("init", () => {
  game.settings.register("pf2e-token-bar", "autoFortification", {
    name: game.i18n.localize("PF2ETokenBar.Settings.AutoFortification.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.AutoFortification.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register("pf2e-token-bar", "autoShadow", {
    name: game.i18n.localize("PF2ETokenBar.Settings.AutoShadow.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.AutoShadow.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register("pf2e-token-bar", "autoKeen", {
    name: game.i18n.localize("PF2ETokenBar.Settings.AutoKeen.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.AutoKeen.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

Hooks.on("pf2e.prepareActorData", (actor) => {
  const options = actor.rollOptions.all ?? {};

  if (game.settings.get("pf2e-token-bar", "autoShadow")) {
    const rune = options["armor:rune:property:major-shadow"]
      ? {
          predicate: "armor:rune:property:major-shadow",
          option: "major-shadow-rune",
          label: "PF2E.ArmorRunePropertyMajorShadow.ItemBonus",
          bonus: 3,
        }
      : options["armor:rune:property:greater-shadow"]
      ? {
          predicate: "armor:rune:property:greater-shadow",
          option: "greater-shadow-rune",
          label: "PF2E.ArmorRunePropertyGreaterShadow.ItemBonus",
          bonus: 2,
        }
      : options["armor:rune:property:shadow"]
      ? {
          predicate: "armor:rune:property:shadow",
          option: "shadow-rune",
          label: "PF2E.ArmorRunePropertyShadow.ItemBonus",
          bonus: 1,
        }
      : null;

    if (rune) {
      actor.synthetics.toggles["skill-check"] ??= {};
      actor.synthetics.toggles["skill-check"][rune.option] = {
        itemId: `pf2e-token-bar.${rune.option}`,
        label: game.i18n.localize(rune.label),
        placement: "actions",
        domain: "skill-check",
        option: rune.option,
        suboptions: [],
        alwaysActive: false,
        checked: false,
        enabled: true,
      };

      const { FlatModifier } = game.pf2e.rules;
      const modifier = new FlatModifier({
        slug: rune.option,
        label: game.i18n.localize(rune.label),
        selector: "stealth",
        type: "item",
        value: rune.bonus,
        predicate: [rune.predicate, rune.option],
        custom: true,
      });

      actor.synthetics.statisticsModifiers.stealth ??= [];
      actor.synthetics.statisticsModifiers.stealth.push(modifier);
    }
  }

  if (game.settings.get("pf2e-token-bar", "autoKeen")) {
    const keenOptions = [
      "weapon:rune:property:keen",
      "weapon:property-rune:keen",
      "property-rune:keen",
      "item:rune:property:keen",
    ].filter((option) => options[option]);

    if (keenOptions.length > 0) {
      const label = game.i18n.localize("PF2E.PropertyRuneKeen");
      const predicateBase = ["check:type:attack", "check:total:natural:19"];

      actor.synthetics.degreeOfSuccessAdjustments["strike-attack-roll"] ??= [];

      for (const option of keenOptions) {
        actor.synthetics.degreeOfSuccessAdjustments["strike-attack-roll"].push({
          slug: `pf2e-token-bar-keen-${option.replace(/[:]/g, "-")}`,
          label,
          predicate: { all: [...predicateBase, option] },
          success: {
            label,
            amount: 1,
          },
        });
      }
    }
  }
});

Hooks.on("createChatMessage", async (message) => {
  const context = message.flags.pf2e?.context;
  const autoFortificationEnabled = game.settings.get("pf2e-token-bar", "autoFortification");

  if (!autoFortificationEnabled) return;
  if (context?.type !== "attack-roll" || context?.outcome !== "criticalSuccess") return;

  const targetUuid = context.target?.actor;
  const target = targetUuid ? await fromUuid(targetUuid) : null;
  if (!target?.isOfType?.("creature")) return;

  const options = target.rollOptions.all;
  const hasFort = options["armor:rune:property:fortification"];
  const hasGreater = options["armor:rune:property:greater-fortification"];
  if (!hasFort && !hasGreater) return;

  const dc = hasGreater ? 14 : 17;
  const label = game.i18n.format("PF2ETokenBar.Fortification.Check", { dc });
  const content = `@Check[type:flat|dc:${dc}|traits:fortification]{${label}}`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: target }),
    flavor: `Fortification – ${target.name}`,
    content,
    flags: { "pf2e-token-bar": { original: message.id } },
  });
});

Hooks.on("pf2e.check.roll", async (check, roll, data) => {
  if (!game.settings.get("pf2e-token-bar", "autoFortification")) return;
  if (!check.traits?.has("fortification")) return;

  const message = data?.message;
  const originalId = message?.flags?.["pf2e-token-bar"]?.original;
  if (!originalId) return;

  const original = game.messages.get(originalId);
  const item = original?.item;
  const dc = check.dc?.value ?? check.dc ?? 0;

  if (roll.total >= dc) {
    await original.update({ "flags.pf2e.context.outcome": "success" });
    ui.notifications.info(game.i18n.localize("PF2ETokenBar.Fortification.Success"));
  }

  await item?.rollDamage({ message: original });
});
