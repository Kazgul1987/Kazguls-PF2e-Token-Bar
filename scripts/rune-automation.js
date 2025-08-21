Hooks.once("init", () => {
  game.settings.register("pf2e-token-bar", "autoFortification", {
    name: game.i18n.localize("PF2ETokenBar.Settings.AutoFortification.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.AutoFortification.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

Hooks.on("createChatMessage", async (message) => {
  if (!game.settings.get("pf2e-token-bar", "autoFortification")) return;

  const context = message.flags.pf2e?.context;
  if (context?.type !== "attack-roll" || context?.outcome !== "criticalSuccess") return;

  const targetUuid = context.target?.actor;
  const target = targetUuid ? await fromUuid(targetUuid) : null;
  if (!target?.isOfType?.("creature")) return;

  const options = target.rollOptions.all;
  const hasFort = options["armor:rune:property:fortification"];
  const hasGreater = options["armor:rune:property:greater-fortification"];
  if (!hasFort && !hasGreater) return;

  const dc = hasGreater ? 14 : 17;

  const content = `
    <div class="fortification-check" data-message-id="${message.id}">
      <button class="fort-btn" data-dc="${dc}">
        Fortification Flat Check (DC ${dc})
      </button>
    </div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: target }),
    flavor: `Fortification – ${target.name}`,
    content,
  });
});

Hooks.on("renderChatMessage", (message, html) => {
  if (!game.settings.get("pf2e-token-bar", "autoFortification")) return;

  html.find("button.fort-btn").on("click", async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;

    const dc = Number(button.dataset.dc);
    const msgId = button.closest(".fortification-check").dataset.messageId;
    const original = game.messages.get(msgId);
    const item = original?.item;

    const roll = await new Roll("1d20").evaluate({ async: true });
    await roll.toMessage({ flavor: `Fortification (DC ${dc})` });

    if (roll.total >= dc) {
      await original.update({ "flags.pf2e.context.outcome": "success" });
      ui.notifications.info("Critical downgraded to normal damage.");
    }

    await item?.rollDamage({ event, message: original });
  });
});
