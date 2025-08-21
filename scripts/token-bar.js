import { PF2ERingMenu } from "./ring-menu.js";

Hooks.once("init", () => {
  game.settings.register("pf2e-token-bar", "position", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
  game.settings.register("pf2e-token-bar", "orientation", {
    scope: "client",
    config: false,
    type: String,
    default: "horizontal",
    onChange: () => PF2ETokenBar.render(),
  });
  game.settings.register("pf2e-token-bar", "locked", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
  game.settings.register("pf2e-token-bar", "enabled", {
    name: game.i18n.localize("PF2ETokenBar.Settings.Enabled.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.Enabled.Hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => PF2ETokenBar.render()
  });
  game.settings.register("pf2e-token-bar", "closeCombatTracker", {
    name: game.i18n.localize("PF2ETokenBar.Settings.CloseCombatTracker.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.CloseCombatTracker.Hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register("pf2e-token-bar", "scale", {
    name: game.i18n.localize("PF2ETokenBar.Settings.Scale.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.Scale.Hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.5, max: 2, step: 0.1 },
    default: 1,
    onChange: () => PF2ETokenBar.render(),
  });
  game.settings.register("pf2e-token-bar", "debug", {
    name: "Debug Logging",
    hint: "Output additional debug information to the console",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register("pf2e-token-bar", "partyOnlySelf", {
    name: game.i18n.localize("PF2ETokenBar.Settings.PartyOnlySelf.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.PartyOnlySelf.Hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => PF2ETokenBar.render(),
  });
  game.settings.register("pf2e-token-bar", "quickLoot", {
    name: game.i18n.localize("PF2ETokenBar.Settings.QuickLoot.Name"),
    hint: game.i18n.localize("PF2ETokenBar.Settings.QuickLoot.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

class PF2ETokenBar {
  static hoveredToken = null;

  static debug(...args) {
    if (game.settings.get("pf2e-token-bar", "debug")) console.debug(...args);
  }

  static render() {
    PF2ERingMenu.close();
    if (!canvas?.ready) return;
    if (!game.settings.get("pf2e-token-bar", "enabled")) {
      document.getElementById("pf2e-token-bar")?.remove();
      return;
    }

    const activeCombat = game.combat && game.combats.has(game.combat.id) ? game.combat : null;

    this.debug("PF2ETokenBar | fetching party actors");
    const actors = this._partyTokens();
    this.debug("PF2ETokenBar | found actors", actors.map(a => a.id));
    // getActiveTokens(true) returns Token objects (not TokenDocuments)
    let tokens = actors
      .map(a => a.getActiveTokens(true)[0])
      .filter(t => t);

    if (activeCombat?.combatants.size) {
      this.debug("PF2ETokenBar | fetching combat tokens");
      tokens = this._combatTokens();
    }

    tokens = [...new Map(tokens.map(t => [t.id, t])).values()];

    this.debug("PF2ETokenBar | found tokens", tokens.map(t => t.id));
    if (!tokens.length) return;
    let bar = document.getElementById("pf2e-token-bar");
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.id = "pf2e-token-bar";
    const scale = game.settings.get("pf2e-token-bar", "scale");
    bar.style.transform = `scale(${scale})`;
    bar.style.transformOrigin = "top left";
    const orientation = game.settings.get("pf2e-token-bar", "orientation");
    if (orientation === "vertical") bar.classList.add("pf2e-token-bar-vertical");
    const pos = game.settings.get("pf2e-token-bar", "position");
    if (pos?.top !== undefined && pos?.left !== undefined) {
      bar.style.top = `${pos.top}px`;
      bar.style.left = `${pos.left}px`;
    } else {
      bar.style.top = "0px";
      bar.style.right = "0px";
    }

    const tokenContainer = document.createElement("div");
    tokenContainer.classList.add("pf2e-token-bar-content");
    if (orientation === "vertical") {
      tokenContainer.style.overflowY = "auto";
      tokenContainer.style.overflowX = "hidden";
      tokenContainer.style.maxHeight = "80vh";
    } else {
      tokenContainer.style.overflowX = "auto";
      tokenContainer.style.overflowY = "hidden";
      const tokenWidth = 64;
      const gap = 12;
      const maxWidth = (tokenWidth + gap) * 8;
      tokenContainer.style.setProperty("--token-bar-max-width", `${maxWidth}px`);
    }
    bar.appendChild(tokenContainer);


    const threat = activeCombat?.metrics?.threat ?? activeCombat?.analyze()?.threat;
    if (threat) {
      const difficultyDisplay = document.createElement("div");
      const capThreat = threat.charAt(0).toUpperCase() + threat.slice(1);
      difficultyDisplay.classList.add("pf2e-encounter-difficulty", `pf2e-encounter-${threat}`);
      difficultyDisplay.innerText = game.i18n.localize(`PF2ETokenBar.Difficulties.${capThreat}`);
      tokenContainer.prepend(difficultyDisplay);
    }

    if (activeCombat?.round > 0) {
      const roundDisplay = document.createElement("div");
      roundDisplay.classList.add("pf2e-round-display");
      roundDisplay.innerText = game.i18n.format("PF2ETokenBar.Round", { round: activeCombat.round });
      tokenContainer.prepend(roundDisplay);
    }

    tokens.forEach(token => {
      const actor = token.actor;
      const wrapper = document.createElement("div");
      wrapper.classList.add("pf2e-token-wrapper");
      if (token.document.hidden) wrapper.classList.add("pf2e-token-hidden");
      wrapper.addEventListener("mouseenter", () => PF2ETokenBar.hoveredToken = token);
      wrapper.addEventListener("mouseleave", () => {
        if (PF2ETokenBar.hoveredToken === token) PF2ETokenBar.hoveredToken = null;
      });
      wrapper.addEventListener("dragover", event => {
        event.preventDefault();
        wrapper.classList.add("pf2e-drop-hover");
      });
      wrapper.addEventListener("dragleave", () => wrapper.classList.remove("pf2e-drop-hover"));
      wrapper.addEventListener("drop", event => PF2ETokenBar.handleItemDrop(event, actor));

      const combatant = activeCombat?.combatants.find(c => c.tokenId === token.id);

      if (combatant) {
        const delayed = combatant.getFlag("pf2e-token-bar", "delayed");
        const isActive = activeCombat?.started && combatant.id === activeCombat.combatant?.id;
        if (isActive) wrapper.classList.add("active-turn");

        if (delayed) {
          const playIcon = document.createElement("i");
          playIcon.classList.add("fas", "fa-play", "pf2e-play-icon");
          const playTitle = game.i18n.localize("PF2ETokenBar.Play");
          playIcon.title = playTitle;
          playIcon.setAttribute("aria-label", playTitle);
          playIcon.addEventListener("click", () => PF2ETokenBar.resumeTurn(combatant));
          wrapper.appendChild(playIcon);
        } else if (isActive) {
          const delayIcon = document.createElement("i");
          delayIcon.classList.add("fas", "fa-hourglass", "pf2e-delay-icon");
          const delayTitle = game.i18n.localize("PF2ETokenBar.Delay");
          delayIcon.title = delayTitle;
          delayIcon.setAttribute("aria-label", delayTitle);
          delayIcon.addEventListener("click", () => PF2ETokenBar.delayTurn(combatant));
          wrapper.appendChild(delayIcon);
        }

        const init = document.createElement("div");
        init.classList.add("pf2e-initiative");
        if (combatant?.initiative == null) {
          init.innerHTML = "<strong>RFC!</strong>";
          init.classList.add("pf2e-roll-initiative");
          const rollTitle = game.i18n.localize("PF2ETokenBar.RollInitiative");
          init.title = rollTitle;
          init.setAttribute("aria-label", rollTitle);
          init.addEventListener("click", async () => {
            await combatant.actor?.initiative?.roll({ createMessage: true, dialog: true });
          });
        } else {
          init.innerText = `${combatant.initiative}`;
        }
        wrapper.appendChild(init);
      }

      const indicator = document.createElement("i");
      indicator.classList.add("fas", "fa-crosshairs", "target-indicator");
      indicator.style.display = game.user.targets.has(token) ? "block" : "none";
      wrapper.appendChild(indicator);

      const img = document.createElement("img");
      // Attempt to get the token's texture, falling back to the document's texture
      const imgSrc = token.texture?.src ?? token.document?.texture?.src ?? "";
      img.src = imgSrc;
      if (!imgSrc) console.warn("PF2ETokenBar | token has no texture src", token);
      img.title = actor.name;
      img.classList.add("pf2e-token-bar-token");
      img.addEventListener("click", () => actor.sheet.render(true));
      img.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
        PF2ERingMenu.open(token, { x: event.clientX, y: event.clientY });
      });
      wrapper.appendChild(img);

      const isCharacter = actor.isOfType?.("character") ?? actor.type === "character";
      const isNPC = actor.isOfType?.("npc") ?? actor.type === "npc";
      const showHpBar = true;
      const showHpNumeric = game.user.isGM || !isNPC;
      if (isCharacter) {
        const tabContainer = document.createElement("div");
        tabContainer.classList.add("pf2e-token-tabs");
        wrapper.appendChild(tabContainer);

        const actionTab = document.createElement("div");
        actionTab.classList.add("pf2e-token-tab");
        const actionGlyph = document.createElement("span");
        actionGlyph.classList.add("action-glyph");
        actionGlyph.textContent = "1";
        actionTab.appendChild(actionGlyph);
        const actionsTitle = game.i18n.localize("PF2ETokenBar.Actions");
        actionTab.title = actionsTitle;
        actionTab.setAttribute("aria-label", actionsTitle);
        actionTab.addEventListener("click", () => actor.sheet.render(true, { tab: "actions" }));
        tabContainer.appendChild(actionTab);

        const spellTab = document.createElement("div");
        spellTab.classList.add("pf2e-token-tab");
        spellTab.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
        const spellsTitle = game.i18n.localize("PF2ETokenBar.Spells");
        spellTab.title = spellsTitle;
        spellTab.setAttribute("aria-label", spellsTitle);
        spellTab.addEventListener("click", () => actor.sheet.render(true, { tab: "spellcasting" }));
        tabContainer.appendChild(spellTab);

        const inventoryTab = document.createElement("div");
        inventoryTab.classList.add("pf2e-token-tab");
        inventoryTab.innerHTML = '<i class="fas fa-treasure-chest"></i>';
        const inventoryTitle = game.i18n.localize("PF2ETokenBar.Inventory");
        inventoryTab.title = inventoryTitle;
        inventoryTab.setAttribute("aria-label", inventoryTitle);
        inventoryTab.addEventListener("click", () => actor.sheet.render(true, { tab: "inventory" }));
        tabContainer.appendChild(inventoryTab);

        const proficiencyTab = document.createElement("div");
        proficiencyTab.classList.add("pf2e-token-tab");
        proficiencyTab.innerHTML = '<i class="fas fa-hand-paper"></i>';
        const proficiencyTitle = game.i18n.localize("PF2ETokenBar.Proficiencies");
        proficiencyTab.title = proficiencyTitle;
        proficiencyTab.setAttribute("aria-label", proficiencyTitle);
        proficiencyTab.addEventListener("click", () => actor.sheet.render(true, { tab: "proficiencies" }));
        tabContainer.appendChild(proficiencyTab);
      }

      const hp = actor.system?.attributes?.hp ?? {};
      const hpValue = Number(hp.value) || 0;
      const hpMax = Number(hp.max) || 0;

      if (showHpNumeric) {
        const hpText = document.createElement("div");
        hpText.classList.add("pf2e-hp-text");
        hpText.innerText = `${hpValue}`;
        wrapper.appendChild(hpText);
      }

      if (showHpBar) {
        const barOuter = document.createElement("div");
        barOuter.classList.add("pf2e-hp-bar");
        const barInner = document.createElement("div");
        barInner.classList.add("pf2e-hp-bar-inner");
        const pct = hpMax > 0 ? Math.min(Math.max((hpValue / hpMax) * 100, 0), 100) : 0;
        const color =
          pct > 75 ? "green" :
          pct > 50 ? "yellow" :
          pct > 25 ? "orange" :
          "red";
        barInner.style.backgroundColor = color;
        barInner.style.width = `${pct}%`;
        barOuter.appendChild(barInner);
        wrapper.appendChild(barOuter);
      }

      if (isCharacter) {
        const heroPoints = actor.system?.resources?.heroPoints ?? {};
        const heroValue = Number(heroPoints.value) || 0;

        const heroWrapper = document.createElement("div");
        heroWrapper.classList.add("pf2e-hero-points");
        heroWrapper.title = game.i18n.localize("PF2ETokenBar.HeroPoints");

        for (let i = 1; i <= 3; i++) {
          const heroPoint = document.createElement("span");
          heroPoint.classList.add("pf2e-hero-point");
          if (i <= heroValue) heroPoint.classList.add("full");

          heroPoint.addEventListener("click", async () => {
            const current = Number(actor.system?.resources?.heroPoints?.value) || 0;
            const max = Number(actor.system?.resources?.heroPoints?.max ?? 3);
            await actor.update({ 'system.resources.heroPoints.value': Math.min(current + 1, max) });
          });

          heroPoint.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            const current = Number(actor.system?.resources?.heroPoints?.value) || 0;
            await actor.update({ 'system.resources.heroPoints.value': Math.max(current - 1, 0) });
          });

          heroWrapper.appendChild(heroPoint);
        }

        wrapper.appendChild(heroWrapper);
      }

      const effectBar = document.createElement("div");
      effectBar.classList.add("pf2e-effect-bar");
      const effects = [
        ...(actor.itemTypes?.effect ?? []),
        ...(actor.conditions?.active ?? [])
      ];
      for (const effect of effects.filter(e => !e.disabled && !e.isExpired)) {
        const effectWrapper = document.createElement("div");
        effectWrapper.classList.add("pf2e-effect");

        const img = document.createElement("img");
        img.classList.add("pf2e-effect-icon");
        img.src = effect.img;
        const uuid = effect.sourceId || effect.uuid;
        img.dataset.uuid = uuid;
        img.dataset.tooltip = effect.name;

        const stack = effect.badge?.value ?? effect.system?.badge?.value ?? effect.value;
        const canStack = typeof stack === "number";

        game.tooltip?.bind?.(img, {
          content: async () => {
            const doc = await fromUuid(uuid);
            if (!doc) return "";
            const description = doc._source?.system?.description?.value ?? doc.system?.description?.value ?? "";
            const enriched = await TextEditor.enrichHTML(description, {
              async: true,
              documents: true,
              rollData: doc.actor?.getRollData?.(),
            });
            const name = doc.name ?? effect.name;
            return `<strong>${name}</strong>${enriched}<i class="fas fa-comment pf2e-effect-chat"></i>`;
          },
          cssClass: "pf2e-token-bar-tooltip",
        });

        img.addEventListener("mouseenter", () => {
          setTimeout(() => {
            const icon = document.querySelector(".pf2e-token-bar-tooltip .pf2e-effect-chat");
            icon?.addEventListener("click", async ev => {
              ev.preventDefault();
              ev.stopPropagation();
              try {
                const doc = await fromUuid(uuid);
                const description = doc._source?.system?.description?.value ?? doc.system?.description?.value ?? "";
                const content = await TextEditor.enrichHTML(description, {
                  async: true,
                  documents: true,
                  rollData: doc.actor?.getRollData?.(),
                });
                ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: doc.actor }), content });
              } catch (err) {
                console.error("PF2ETokenBar | failed to send effect to chat", err);
              }
            }, { once: true });
          }, 50);
        });

        img.addEventListener("click", async event => {
          event.preventDefault();
          if (canStack) {
            try {
              if (typeof effect.increase === "function") {
                await effect.increase();
              } else {
                const newValue = (stack ?? 0) + 1;
                await effect.update?.({
                  "badge.value": newValue,
                  "system.badge.value": newValue,
                  value: newValue,
                });
              }
            } catch (err) {
              console.error("PF2ETokenBar | failed to increase effect stack", err);
            }
            PF2ETokenBar.render();
          } else {
            try {
              const doc = await fromUuid(uuid);
              doc?.sheet.render(true);
            } catch (err) {
              console.error("PF2ETokenBar | failed to open effect sheet", err);
            }
          }
        });

        img.addEventListener("contextmenu", async event => {
          event.preventDefault();
          event.stopPropagation();
          if (canStack && stack > 1) {
            try {
              if (typeof effect.decrease === "function") {
                await effect.decrease();
              } else {
                const newValue = stack - 1;
                await effect.update?.({
                  "badge.value": newValue,
                  "system.badge.value": newValue,
                  value: newValue,
                });
              }
            } catch (err) {
              console.error("PF2ETokenBar | failed to decrease effect stack", err);
            }
          } else {
            await actor.deleteEmbeddedDocuments("Item", [effect.id]);
          }
          PF2ETokenBar.render();
        });

        effectWrapper.appendChild(img);

        if (canStack && stack >= 1) {
          const badge = document.createElement("span");
          badge.classList.add("pf2e-effect-badge");
          badge.textContent = stack;
          effectWrapper.appendChild(badge);
        }

        effectBar.appendChild(effectWrapper);
      }
      wrapper.appendChild(effectBar);

      tokenContainer.appendChild(wrapper);
    });

    const controls = document.createElement("div");
    controls.classList.add("pf2e-token-bar-controls");
    bar.appendChild(controls);

    const orientationBtn = document.createElement("button");
    const updateOrientationBtn = () => {
      const current = game.settings.get("pf2e-token-bar", "orientation");
      orientationBtn.innerHTML =
        current === "vertical"
          ? '<i class="fas fa-arrows-alt-h"></i>'
          : '<i class="fas fa-arrows-alt-v"></i>';
      const key = current === "vertical" ? "PF2ETokenBar.Horizontal" : "PF2ETokenBar.Vertical";
      orientationBtn.title = game.i18n.localize(key);
      orientationBtn.setAttribute("aria-label", orientationBtn.title);
    };
    updateOrientationBtn();
    orientationBtn.addEventListener("click", async () => {
      const current = game.settings.get("pf2e-token-bar", "orientation");
      const next = current === "vertical" ? "horizontal" : "vertical";
      await game.settings.set("pf2e-token-bar", "orientation", next);
      PF2ETokenBar.render();
    });
    controls.appendChild(orientationBtn);

    const lockBtn = document.createElement("button");
    const updateLockBtn = () => {
      const locked = game.settings.get("pf2e-token-bar", "locked");
      lockBtn.innerHTML = locked
        ? '<i class="fas fa-lock"></i>'
        : '<i class="fas fa-lock-open"></i>';
      const key = locked ? "PF2ETokenBar.Unlock" : "PF2ETokenBar.Lock";
      lockBtn.title = game.i18n.localize(key);
      lockBtn.setAttribute("aria-label", lockBtn.title);
        bar.classList.toggle("locked", locked);
    };
    updateLockBtn();
    lockBtn.addEventListener("click", async () => {
      const current = game.settings.get("pf2e-token-bar", "locked");
      await game.settings.set("pf2e-token-bar", "locked", !current);
      updateLockBtn();
    });
    controls.appendChild(lockBtn);

    const requestRollBtn = document.createElement("button");
    requestRollBtn.innerText = game.i18n.localize("PF2ETokenBar.RequestRoll");
    requestRollBtn.addEventListener("click", () => this.requestRoll());

    const encounterBtn = document.createElement("button");
    const encounterKey = activeCombat?.started ? "PF2ETokenBar.EndEncounter" : "PF2ETokenBar.StartEncounter";
    encounterBtn.innerText = game.i18n.localize(encounterKey);
    encounterBtn.addEventListener("click", async () => {
      try {
        if (game.combat?.started) {
          if (game.user.isGM && game.settings.get("pf2e-token-bar", "quickLoot")) {
            const confirmed = await Dialog.confirm({
              title: game.i18n.localize("PF2ETokenBar.QuickLootConfirmTitle"),
              content: `<p>${game.i18n.localize("PF2ETokenBar.QuickLootConfirmContent")}</p>`
            });
            if (confirmed) {
              await PF2ETokenBar.transferDefeatedLoot();
              PF2ETokenBar.openLootActor("Loot");
            }
          }
          await game.combat.endCombat();
        } else {
          await game.combat.startCombat();
        }
      } catch (error) {
        console.error(error);
      }
    });

    if (!activeCombat?.started) {
        if (game.user.isGM) {
            const addBtn = document.createElement("button");
            addBtn.innerHTML = '<i class="fas fa-swords"></i>';
            addBtn.title = game.i18n.localize("PF2ETokenBar.AddPartyToEncounter");
            addBtn.addEventListener("click", () => this.addPartyToEncounter());
            controls.appendChild(addBtn);

            const healBtn = document.createElement("button");
            healBtn.innerText = game.i18n.localize("PF2ETokenBar.HealAll");
            healBtn.addEventListener("click", () => this.healAll());
            controls.appendChild(healBtn);

            const restBtn = document.createElement("button");
            restBtn.innerHTML = '<i class="fas fa-bed"></i>';
            restBtn.title = game.i18n.localize("PF2E.RestAll");
            restBtn.addEventListener("click", () => this.restAll());
            controls.appendChild(restBtn);

            controls.appendChild(requestRollBtn);
            controls.appendChild(encounterBtn);
        }

        const lootGroup = document.createElement("div");
        lootGroup.classList.add("pf2e-loot-controls");
        controls.appendChild(lootGroup);

        const partyStashBtn = document.createElement("button");
        partyStashBtn.classList.add("pf2e-inventory-action");
        partyStashBtn.innerHTML = `<i class="fas fa-people-group"></i><span>${game.i18n.localize("PF2ETokenBar.PartyStash")}</span>`;
        partyStashBtn.addEventListener("click", () => PF2ETokenBar.openPartyStash());
        partyStashBtn.addEventListener("dragover", PF2ETokenBar.handleDragOver);
        partyStashBtn.addEventListener("dragleave", PF2ETokenBar.handleDragLeave);
        partyStashBtn.addEventListener("drop", event => PF2ETokenBar.handleItemDrop(event, "party"));
        lootGroup.appendChild(partyStashBtn);

        const lootBtn = document.createElement("button");
        lootBtn.classList.add("pf2e-inventory-action");
        lootBtn.innerHTML = `<i class="fas fa-treasure-chest"></i><span>${game.i18n.localize("PF2ETokenBar.Loot")}</span>`;
        lootBtn.addEventListener("click", () => PF2ETokenBar.openLootActor("Loot"));
        lootBtn.addEventListener("dragover", PF2ETokenBar.handleDragOver);
        lootBtn.addEventListener("dragleave", PF2ETokenBar.handleDragLeave);
        lootBtn.addEventListener("drop", event => PF2ETokenBar.handleItemDrop(event, "Loot"));
        lootGroup.appendChild(lootBtn);

        const sellBtn = document.createElement("button");
        sellBtn.classList.add("pf2e-inventory-action");
        sellBtn.innerHTML = `<i class="fas fa-sack-dollar"></i><span>${game.i18n.localize("PF2ETokenBar.Sell")}</span>`;
        sellBtn.addEventListener("click", () => PF2ETokenBar.openLootActor("Sell"));
        sellBtn.addEventListener("dragover", PF2ETokenBar.handleDragOver);
        sellBtn.addEventListener("dragleave", PF2ETokenBar.handleDragLeave);
        sellBtn.addEventListener("drop", event => PF2ETokenBar.handleItemDrop(event, "Sell"));
        lootGroup.appendChild(sellBtn);
      } else {
        if (game.user.isGM) {
          controls.appendChild(requestRollBtn);
          controls.appendChild(encounterBtn);
        }
      }

    if (activeCombat) {
      const npcCombatants = activeCombat.combatants.filter(c => !c.actor?.hasPlayerOwner);
      const needsInit = npcCombatants.some(
        c => c.initiative === undefined || c.initiative === null
      );
      if (needsInit) {
        const npcInitBtn = document.createElement("button");
        npcInitBtn.innerText = game.i18n.localize("PF2ETokenBar.NPCInit");
        npcInitBtn.addEventListener("click", async () => {
          npcInitBtn.disabled = true;
          const ids = game.combat.combatants
            .filter(
              c =>
                !c.actor?.hasPlayerOwner &&
                (c.initiative === undefined || c.initiative === null)
            )
            .map(c => c.id);
          if (ids.length) await game.combat.rollInitiative(ids);
          PF2ETokenBar.render();
        });
        controls.appendChild(npcInitBtn);
      }
    }

    if (activeCombat?.started) {
      const prevBtn = document.createElement("button");
      prevBtn.classList.add("pf2e-prev-turn");
      prevBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
      const prevTitle = game.i18n.localize("PF2ETokenBar.Prev");
      prevBtn.title = prevTitle;
      prevBtn.setAttribute("aria-label", prevTitle);
      prevBtn.addEventListener("click", () => game.combat.previousTurn());
      controls.appendChild(prevBtn);

      const nextBtn = document.createElement("button");
      nextBtn.classList.add("pf2e-next-turn");
      nextBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
      const nextTitle = game.i18n.localize("PF2ETokenBar.Next");
      nextBtn.title = nextTitle;
      nextBtn.setAttribute("aria-label", nextTitle);
      nextBtn.addEventListener("click", () => game.combat.nextTurn());
      controls.appendChild(nextBtn);
    }

    const toggleBtn = document.createElement("button");
    toggleBtn.innerText = game.i18n.localize("PF2ETokenBar.Hide");
    toggleBtn.addEventListener("click", () => {
      bar.classList.toggle("collapsed");
      const key = bar.classList.contains("collapsed") ? "PF2ETokenBar.Show" : "PF2ETokenBar.Hide";
      toggleBtn.innerText = game.i18n.localize(key);
    });
    bar.appendChild(toggleBtn);

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseMove = event => {
      if (!dragging) return;
      bar.style.left = `${event.clientX - offsetX}px`;
      bar.style.top = `${event.clientY - offsetY}px`;
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      game.settings.set("pf2e-token-bar", "position", { top: bar.offsetTop, left: bar.offsetLeft });
    };
    bar.addEventListener("mousedown", event => {
      if (game.settings.get("pf2e-token-bar", "locked")) return;
      if (event.target.closest(".pf2e-token-bar-controls")) return;
      event.preventDefault();
      dragging = true;
      offsetX = event.clientX - bar.offsetLeft;
      offsetY = event.clientY - bar.offsetTop;
      bar.style.right = "";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    document.body.appendChild(bar);
  }

    static _partyTokens() {
      if (game.combat?.started) return [];
      let actors = game.actors.party?.members || [];
      if (game.settings.get("pf2e-token-bar", "partyOnlySelf") && !game.user.isGM) {
        const userChar = game.user.character;
        actors = actors.filter(a => (userChar && a.id === userChar.id) || a.isOwner);
      }
      this.debug(
        `PF2ETokenBar | _partyTokens found ${actors.length} actors`,
        actors.map(a => a.id)
      );
      return actors;
    }

    static _combatTokens() {
      let combatants = Array.from(game.combat?.combatants ?? []);
      combatants.sort((a, b) => {
        const diff = (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity);
        if (diff !== 0) return diff;
        const aIsPlayer = a.actor?.hasPlayerOwner ? 1 : 0;
        const bIsPlayer = b.actor?.hasPlayerOwner ? 1 : 0;
        return aIsPlayer - bIsPlayer;   // NPCs (0) vor PCs (1)
      });
      const tokens = combatants.map(c => canvas.tokens.get(c.tokenId)).filter(t => t);
      this.debug(
        `PF2ETokenBar | _combatTokens found ${tokens.length} tokens`,
        tokens.map(t => t.id)
      );
      return tokens;
    }

  static _activePlayerTokens() {
    const tokens = canvas.tokens.placeables.filter(t => t.actor?.hasPlayerOwner);
    this.debug(`PF2ETokenBar | _activePlayerTokens filtered ${tokens.length} tokens`, tokens.map(t => t.actor?.id));
    return tokens;
  }

  static openPartyStash() {
    const party = game.actors.party;
    if (party?.sheet) {
      party.sheet.render(true, { tab: "inventory" });
    } else {
      ui.notifications.error(game.i18n.localize("PF2ETokenBar.PartySheetMissing"));
    }
  }

  static openLootActor(name) {
    const actor = game.actors.getName(name);
    if (actor) {
      actor.sheet.render(true);
    } else {
      ui.notifications.error(game.i18n.format("PF2ETokenBar.TokenMissing", { name }));
    }
  }

  static async transferDefeatedLoot() {
    const lootActor = game.actors.getName("Loot");
    if (!lootActor) {
      ui.notifications.error(game.i18n.format("PF2ETokenBar.TokenMissing", { name: "Loot" }));
      return;
    }
    if (!lootActor.isOwner) {
      ui.notifications.error("You do not have permission to modify the Loot actor.");
      return;
    }

    const items = [];
    const currencies = {};

    for (const combatant of game.combat?.combatants ?? []) {
      const actor = combatant.actor;
      if (!actor || actor.hasPlayerOwner) continue;
      const hp = actor.system?.attributes?.hp?.value ?? 0;
      const dead = actor.hasCondition?.("dead");
      if (hp > 0 && !dead) continue;

      const actorItems = Array.from(actor.items.values()).filter(i =>
        i.isOfType?.("physical") &&
        !(i.type === "treasure" && i.system?.stackGroup === "coins")
      );
      items.push(...actorItems.map(i => i.toObject()));
      if (actorItems.length) {
        const ids = actorItems.map(i => i.id);
        await actor.deleteEmbeddedDocuments("Item", ids);
      }

      const actorCurrencies = foundry.utils.deepClone(actor.system?.currencies ?? {});
      for (const [type, data] of Object.entries(actorCurrencies)) {
        const amount = Number(data?.value ?? data) || 0;
        currencies[type] = (currencies[type] || 0) + amount;
        if (typeof data === "object") actorCurrencies[type].value = 0;
        else actorCurrencies[type] = 0;
      }

      if (Object.keys(actorCurrencies).length) {
        await actor.update({ "system.currencies": actorCurrencies });
      }
    }

    if (items.length) {
      for (const item of items) {
        try {
          await lootActor.createEmbeddedDocuments("Item", [item]);
        } catch (error) {
          console.error("PF2ETokenBar | Failed to create loot item", item, error);
        }
      }
    }

    if (Object.keys(currencies).length) {
      const updatedCurrencies = foundry.utils.deepClone(lootActor.system?.currencies ?? {});
      for (const [type, amount] of Object.entries(currencies)) {
        const existing = updatedCurrencies[type];
        if (existing === undefined) {
          updatedCurrencies[type] = { value: amount };
        } else if (typeof existing === "object") {
          updatedCurrencies[type].value = (existing.value ?? 0) + amount;
        } else {
          updatedCurrencies[type] = (existing ?? 0) + amount;
        }
      }
      await lootActor.update({ "system.currencies": updatedCurrencies });
    }
  }

  static handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("pf2e-drop-hover");
  }

  static handleDragLeave(event) {
    event.currentTarget.classList.remove("pf2e-drop-hover");
  }

  static async handleItemDrop(event, target) {
    event.preventDefault();
    event.currentTarget.classList.remove("pf2e-drop-hover");
    try {
      const data = event.dataTransfer?.getData("text/plain");
      if (!data) throw new Error("No data");
      const parsed = JSON.parse(data);
      if (parsed.type !== "Item" || !parsed.uuid) throw new Error("Invalid item data");

      const item = await fromUuid(parsed.uuid);
      if (!(item instanceof Item)) throw new Error("Item not found");

      const allowedTypes = CONFIG.PF2E?.physicalItemTypes ?? ["weapon", "armor", "shield", "equipment", "consumable", "treasure", "backpack"];
      if (!allowedTypes.includes(item.type)) {
        ui.notifications.warn(game.i18n.localize("PF2ETokenBar.InvalidItemType"));
        return;
      }

      const sourceActor = item.actor;

      const actor = target && typeof target === "object"
        ? target
        : target === "party"
          ? game.actors.party
          : game.actors.getName(target);
      if (!actor) throw new Error(game.i18n.format("PF2ETokenBar.TokenMissing", { name: target }));
      if (!actor.isOwner) throw new Error("You do not have permission to modify this actor.");

      if (sourceActor && sourceActor === actor) return;

      await actor.createEmbeddedDocuments("Item", [item.toObject()]);

      if (sourceActor && sourceActor !== actor) await item.delete();
    } catch (err) {
      console.error(err);
      ui.notifications.error(err.message || "Failed to drop item.");
    }
  }

  static async restAll() {
    const actors = this._partyTokens();
    if (!actors.length) return;
    await game.pf2e.actions.restForTheNight({ actors });
    this.render();
  }

  static async healAll() {
    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("PF2ETokenBar.HealAll"),
      content: `<p>${game.i18n.localize("PF2ETokenBar.HealAllConfirm")}</p>`
    });
    if (!confirmed) return;
    const updates = [];
    for (const actor of this._partyTokens()) {
      updates.push(
        actor.update({ 'system.attributes.hp.value': actor.system.attributes.hp.max })
          .then(() => this.debug("PF2ETokenBar | healAll", `healed ${actor.id}`))
          .catch(err => console.error("PF2ETokenBar | healAll", `failed to heal ${actor?.id}` , err))
      );
    }
    await Promise.all(updates);
    PF2ETokenBar.render();
  }

  static async endEncounter() {
    const combat = game.combat;
    if (!combat) return;
    if (game.combats.has(combat.id)) {
      await Combat.deleteDocuments([combat.id]);
    }
    PF2ETokenBar.render();
  }

  static async addPartyToEncounter() {
    const actors = this._partyTokens();
    if (!actors.length) return;

    let combat = game.combat;
    if (!combat || !game.combats.has(combat.id)) {
      try {
        combat = await Combat.create({ scene: canvas.scene });
        game.combat = combat;
      } catch (err) {
        console.error("PF2ETokenBar | addPartyToEncounter", "failed to create combat", err);
        return;
      }
    }

    for (const actor of actors) {
      const token = actor.getActiveTokens(true)[0];
      if (!token) continue;
      const exists = combat.combatants.find(c => c.tokenId === token.id);
      if (exists) continue;
      try {
        await combat.createEmbeddedDocuments("Combatant", [{
          tokenId: token.id,
          actorId: actor.id,
          sceneId: token.scene.id,
          alliance: "party"
        }]);
      } catch (err) {
        console.error("PF2ETokenBar | addPartyToEncounter", `failed to add ${actor.id}`, err);
      }
    }

    // Removed auto-starting combat; combat should be started manually via the Start Encounter button
    // if (!combat.started) await combat.startCombat();
    this.render();
  }

  static async delayTurn(combatant) {
    if (!combatant || !game.combat) return;
    try {
      await combatant.setFlag("pf2e-token-bar", "delayed", true);
      const token = combatant.token?.object;
      await token?.document.update({ overlayEffect: "icons/svg/hourglass.svg" });
      await game.combat.nextTurn();
    } catch (err) {
      console.error("PF2ETokenBar | delayTurn", err);
    }
    this.render();
  }

  static async resumeTurn(combatant) {
    if (!combatant || !game.combat) return;
    try {
      const current = game.combat.combatant;
      const init = current?.initiative;
      if (init !== undefined) await game.combat.setInitiative(combatant.id, init - 1);
      await combatant.unsetFlag("pf2e-token-bar", "delayed");
      const token = combatant.token?.object;
      await token?.document.update({ overlayEffect: null });
      const index = game.combat.turns.findIndex(c => c.id === combatant.id);
      if (index >= 0) await game.combat.update({ turn: index });
    } catch (err) {
      console.error("PF2ETokenBar | resumeTurn", err);
    }
    this.render();
  }

  static requestRoll() {
    const tokens = this._activePlayerTokens();
    const tokenOptions = tokens.map(t => `<div><input type="checkbox" name="token" value="${t.id}"/> ${t.name}</div>`).join("");
    const skills = CONFIG.PF2E?.skills || {};
    const skillOptions = Object.entries(skills)
      .map(([k, v]) => {
        const label = v.label ?? v;
        const localized = game.i18n?.localize(label) ?? label;
        return `<option value="${k}">${localized}</option>`;
      })
      .join("");
    const saves = ["fortitude", "reflex", "will"];
    const saveOptions = saves
      .map(s => {
        const label = game.i18n.localize(`PF2ETokenBar.${s.charAt(0).toUpperCase() + s.slice(1)}`);
        return `<option value="${s}">${label}</option>`;
      })
      .join("");
    const content = `<div><label>${game.i18n.localize("PF2ETokenBar.DC")} <input type="number" name="dc"/></label></div>
    <div class="flexrow">
      <div class="token-select">${tokenOptions}</div>
      <div class="skill-select">
        <select name="skill">${skillOptions}<optgroup label="${game.i18n.localize("PF2ETokenBar.Saves")}">${saveOptions}</optgroup></select>
      </div>
    </div>`;
    new Dialog({
      title: game.i18n.localize("PF2ETokenBar.RequestRoll"),
      content,
      buttons: {
        roll: {
          label: game.i18n.localize("PF2ETokenBar.Roll"),
          callback: html => {
            const form = html[0].querySelector("form") || html[0];
            const dc = Number(form.querySelector('input[name="dc"]').value) || undefined;
            const skill = form.querySelector('select[name="skill"]').value;
            const selected = Array.from(form.querySelectorAll('input[name="token"]:checked')).map(i => i.value);
            this.debug("PF2ETokenBar | requestRoll selection", { tokens: selected, skill, dc });
            selected.forEach(id => {
              const token = canvas.tokens.get(id);
              if (!token?.actor) return;
              const skillLabelKey = CONFIG.PF2E?.skills[skill]?.label ?? skill;
              const skillLabel = game.i18n?.localize(skillLabelKey) ?? skillLabelKey;
              const link = `<a class="pf2e-token-bar-roll" data-token-id="${id}" data-skill="${skill}" data-dc="${dc ?? ""}">${skillLabel}</a>`;
              const img = `<img class="pf2e-token-bar-chat-token" src="${token.texture?.src ?? ""}"/>`;
              const content = `${token.name ? token.name + ": " : ""}${img}${link}`;
              ChatMessage.create({ content });
            });
          }
        },
        cancel: { label: game.i18n.localize("PF2ETokenBar.Cancel") }
      },
      default: "roll"
    }).render(true);
  }

  static _handleRollClick(event) {
    event.preventDefault();
    const { tokenId, skill, dc } = event.currentTarget.dataset;
    const token = canvas.tokens.get(tokenId);
    const actor = token?.actor;
    if (!actor) return;
    const dcValue = dc ? Number(dc) : undefined;
    const rollOpts = dcValue ? { dc: { value: dcValue } } : {};
    if (["fortitude", "reflex", "will"].includes(skill)) {
      actor.saves[skill]?.check.roll(rollOpts);
    } else {
      actor.skills[skill]?.check.roll(rollOpts);
    }
  }
}

globalThis.PF2ETokenBar = PF2ETokenBar;

let keydownListener;

Hooks.once("ready", () => {
  keydownListener = event => {
    const target = event.target;
    const isEditable =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    if (event.defaultPrevented || isEditable) return;

    if (event.code === "KeyT" && PF2ETokenBar.hoveredToken) {
      const token = PF2ETokenBar.hoveredToken;
      token.setTarget(!token.isTargeted, { user: game.user });
    }
  };
  document.addEventListener("keydown", keydownListener);
});

Hooks.once("close", () => {
  if (keydownListener) document.removeEventListener("keydown", keydownListener);
});

Hooks.on("canvasReady", () => PF2ETokenBar.render());
Hooks.on("updateToken", () => PF2ETokenBar.render());
Hooks.on("createToken", () => PF2ETokenBar.render());
Hooks.on("deleteToken", () => PF2ETokenBar.render());
Hooks.on("createCombatant", () => PF2ETokenBar.render());
Hooks.on("deleteCombatant", () => PF2ETokenBar.render());
Hooks.on("updateActor", (_actor, data) => {
  if (data.system?.attributes?.hp || data.system?.resources?.heroPoints) PF2ETokenBar.render();
});
Hooks.on("createItem", item => {
  const isEffect = item.isOfType?.("effect") || item.type === "effect";
  const isCondition = item.isOfType?.("condition") || item.type === "condition";
  if (isEffect || isCondition) PF2ETokenBar.render();
});
Hooks.on("deleteItem", item => {
  const isEffect = item.isOfType?.("effect") || item.type === "effect";
  const isCondition = item.isOfType?.("condition") || item.type === "condition";
  if (isEffect || isCondition) PF2ETokenBar.render();
});
Hooks.on("updateItem", item => {
  const isEffect = item.isOfType?.("effect") || item.type === "effect";
  const isCondition = item.isOfType?.("condition") || item.type === "condition";
  if (isEffect || isCondition) PF2ETokenBar.render();
});
Hooks.on("updateCombat", () => PF2ETokenBar.render());
Hooks.on("combatStart", () => PF2ETokenBar.render());
Hooks.on("combatEnd", async () => {
  PF2ETokenBar.render();
});
Hooks.on("combatTurn", () => {
  PF2ETokenBar.render();
  document
    .querySelector("#pf2e-token-bar .active-turn")
    ?.scrollIntoView({ behavior: "smooth", inline: "center" });
});
Hooks.on("updateCombatant", () => PF2ETokenBar.render());
Hooks.on("renderChatMessage", (_message, html) => {
  const links = html[0]?.querySelectorAll("a.pf2e-token-bar-roll") ?? [];
  for (const link of links) {
    link.addEventListener("click", PF2ETokenBar._handleRollClick);
  }
});
Hooks.on("targetToken", () => PF2ETokenBar.render());
Hooks.on("deleteCombat", () => PF2ETokenBar.render());

