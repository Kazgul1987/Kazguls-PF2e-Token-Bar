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
  game.settings.register("pf2e-token-bar", "debug", {
    name: "Debug Logging",
    hint: "Output additional debug information to the console",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
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
    if (!game.user.isGM) return;
    if (!game.settings.get("pf2e-token-bar", "enabled")) {
      document.getElementById("pf2e-token-bar")?.remove();
      return;
    }

    let tokens = [];
    if (game.combat?.combatants.size > 0) {
      this.debug("PF2ETokenBar | fetching combat tokens");
      tokens = this._combatTokens();
    } else {
      this.debug("PF2ETokenBar | fetching party actors");
      const actors = this._partyTokens();
      this.debug("PF2ETokenBar | found actors", actors.map(a => a.id));
      // getActiveTokens(true) returns Token objects (not TokenDocuments)
      tokens = actors
        .map(a => a.getActiveTokens(true)[0])
        .filter(t => t);
    }

    this.debug("PF2ETokenBar | found tokens", tokens.map(t => t.id));
    if (!tokens.length) return;
    let bar = document.getElementById("pf2e-token-bar");
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.id = "pf2e-token-bar";
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
    const handle = document.createElement("div");
    handle.classList.add("pf2e-bar-handle");
    handle.innerHTML = '<i class="fas fa-anchor"></i>';
    bar.appendChild(handle);

    const tokenContainer = document.createElement("div");
    tokenContainer.classList.add("pf2e-token-bar-content");
    if (orientation === "vertical") {
      tokenContainer.style.overflowY = "auto";
      tokenContainer.style.overflowX = "hidden";
      tokenContainer.style.maxHeight = "80vh";
    } else {
      tokenContainer.style.overflowX = "auto";
      tokenContainer.style.overflowY = "hidden";
      tokenContainer.style.maxWidth = "80vw";
    }
    bar.appendChild(tokenContainer);

    const threat = game.combat?.metrics?.threat ?? game.combat?.analyze()?.threat;
    if (threat) {
      const difficultyDisplay = document.createElement("div");
      const capThreat = threat.charAt(0).toUpperCase() + threat.slice(1);
      difficultyDisplay.classList.add("pf2e-encounter-difficulty", `pf2e-encounter-${threat}`);
      difficultyDisplay.innerText = game.i18n.localize(`PF2ETokenBar.Difficulties.${capThreat}`);
      tokenContainer.prepend(difficultyDisplay);
    }

    if (game.combat?.round > 0) {
      const roundDisplay = document.createElement("div");
      roundDisplay.classList.add("pf2e-round-display");
      roundDisplay.innerText = game.i18n.format("PF2ETokenBar.Round", { round: game.combat.round });
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

      const combatant = game.combat?.combatants.find(c => c.tokenId === token.id);
      if (combatant && combatant.initiative == null) {
        const rollIcon = document.createElement("i");
        rollIcon.classList.add("fas", "fa-dice-d20", "pf2e-d20-icon");
        rollIcon.addEventListener("click", async () => {
          await combatant.actor.initiative?.roll({ createMessage: true, dialog: true });
          PF2ETokenBar.render();
        });
        wrapper.appendChild(rollIcon);
      }

      if (combatant) {
        const delayed = combatant.getFlag("pf2e-token-bar", "delayed");
        const isActive = game.combat?.started && combatant.id === game.combat.combatant?.id;
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
        if (combatant.initiative !== undefined && combatant.initiative !== null) {
          init.innerText = `${combatant.initiative}`;
        }
        wrapper.appendChild(init);
      }

      const visibilityIcon = document.createElement("i");
      visibilityIcon.classList.add(
        "fas",
        token.document.hidden ? "fa-eye-slash" : "fa-eye",
        "pf2e-visibility-icon"
      );
      const visibilityTitle = game.i18n.localize("PF2ETokenBar.Visibility");
      visibilityIcon.title = visibilityTitle;
      visibilityIcon.setAttribute("aria-label", visibilityTitle);
      visibilityIcon.addEventListener("click", async () => {
        await token.document.update({ hidden: !token.document.hidden });
        wrapper.classList.toggle("pf2e-token-hidden", token.document.hidden);
        visibilityIcon.classList.toggle("fa-eye", !token.document.hidden);
        visibilityIcon.classList.toggle("fa-eye-slash", token.document.hidden);
      });
      wrapper.appendChild(visibilityIcon);

      const indicator = document.createElement("i");
      indicator.classList.add("fas", "fa-crosshairs", "target-indicator");
      indicator.style.display = game.user.targets.has(token) ? "block" : "none";
      wrapper.appendChild(indicator);

      const pingIcon = document.createElement("i");
      pingIcon.classList.add("fas", "fa-bullseye", "pf2e-ping-icon");
      const pingTitle = game.i18n.localize("PF2ETokenBar.Ping");
      pingIcon.title = pingTitle;
      pingIcon.setAttribute("aria-label", pingTitle);
      pingIcon.addEventListener("click", () => canvas.ping(token.center, { user: game.user }));
      wrapper.appendChild(pingIcon);

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

      const hp = actor.system?.attributes?.hp ?? {};
      const hpValue = Number(hp.value) || 0;
      const hpMax = Number(hp.max) || 0;

      const hpText = document.createElement("div");
      hpText.classList.add("pf2e-hp-text");
      hpText.innerText = `${hpValue}`;
      wrapper.appendChild(hpText);

      const barOuter = document.createElement("div");
      barOuter.classList.add("pf2e-hp-bar");
      const barInner = document.createElement("div");
      barInner.classList.add("pf2e-hp-bar-inner");
      const pct = hpMax > 0 ? Math.min(Math.max((hpValue / hpMax) * 100, 0), 100) : 0;
      barInner.style.width = `${pct}%`;
      barOuter.appendChild(barInner);
      wrapper.appendChild(barOuter);

      const heroPoints = actor.system?.resources?.heroPoints ?? {};
      const heroValue = Number(heroPoints.value) || 0;
      const heroMax = Number(heroPoints.max) || 0;

      const heroWrapper = document.createElement("div");
      heroWrapper.classList.add("pf2e-hero-points");
      heroWrapper.title = game.i18n.localize("PF2ETokenBar.HeroPoints");

      const heroMinus = document.createElement("button");
      heroMinus.innerHTML = '<i class="fas fa-minus"></i>';
      heroMinus.addEventListener("click", async () => {
        const current = Number(actor.system?.resources?.heroPoints?.value) || 0;
        const newValue = Math.max(current - 1, 0);
        await actor.update({ 'system.resources.heroPoints.value': newValue });
      });
      heroWrapper.appendChild(heroMinus);

      const heroText = document.createElement("span");
      heroText.classList.add("pf2e-hero-points-value");
      heroText.innerText = heroMax ? `${heroValue}/${heroMax}` : `${heroValue}`;
      heroWrapper.appendChild(heroText);

      const heroPlus = document.createElement("button");
      heroPlus.innerHTML = '<i class="fas fa-plus"></i>';
      heroPlus.addEventListener("click", async () => {
        const current = Number(actor.system?.resources?.heroPoints?.value) || 0;
        const max = Number(actor.system?.resources?.heroPoints?.max ?? 3);
        const newValue = Math.min(current + 1, max);
        await actor.update({ 'system.resources.heroPoints.value': newValue });
      });
      heroWrapper.appendChild(heroPlus);

      wrapper.appendChild(heroWrapper);

      const effectBar = document.createElement("div");
      effectBar.classList.add("pf2e-effect-bar");
      const effects = [
        ...(actor.itemTypes?.effect ?? []),
        ...(actor.conditions?.active ?? [])
      ];
      for (const effect of effects.filter(e => !e.disabled && !e.isExpired)) {
        const icon = document.createElement("img");
        icon.classList.add("pf2e-effect-icon");
        icon.src = effect.img;
        const uuid = effect.sourceId || effect.uuid;
        icon.dataset.uuid = uuid; // Fallback to effect.uuid when sourceId is missing
        icon.title = effect.name;
        icon.addEventListener("mouseenter", async event => {
          const doc = await fromUuid(uuid);
          if (!doc) return;
          const description = doc.system?.description?.value ?? "";
          const html = await TextEditor.enrichHTML(description, { async: true, documents: true, rollData: doc.actor?.getRollData?.() });
          if (TooltipManager?.shared) {
            TooltipManager.shared.show(event.currentTarget, { html });
          } else {
            game.tooltip.activate(event.currentTarget, html);
          }
        });
        icon.addEventListener("mouseleave", event => {
          if (TooltipManager?.shared) {
            TooltipManager.shared.hide(event.currentTarget);
          } else {
            game.tooltip.deactivate();
          }
        });
        icon.addEventListener("click", async () => {
          try {
            const doc = await fromUuid(uuid);
            doc?.sheet.render(true);
          } catch (err) {
            console.error("PF2ETokenBar | failed to open effect sheet", err);
          }
        });
        icon.addEventListener("contextmenu", async event => {
          event.preventDefault();
          event.stopPropagation();
          await actor.deleteEmbeddedDocuments("Item", [effect.id]);
          PF2ETokenBar.render();
        });
        effectBar.appendChild(icon);
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
      handle.style.pointerEvents = locked ? "none" : "auto";
    };
    updateLockBtn();
    lockBtn.addEventListener("click", async () => {
      const current = game.settings.get("pf2e-token-bar", "locked");
      await game.settings.set("pf2e-token-bar", "locked", !current);
      updateLockBtn();
    });
    controls.appendChild(lockBtn);

      if (!game.combat?.started) {
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

        const partyStashBtn = document.createElement("button");
        partyStashBtn.innerText = game.i18n.localize("PF2ETokenBar.PartyStash");
        partyStashBtn.addEventListener("click", () => PF2ETokenBar.openLootActor("Party Stash"));
        controls.appendChild(partyStashBtn);

        const lootBtn = document.createElement("button");
        lootBtn.innerText = game.i18n.localize("PF2ETokenBar.Loot");
        lootBtn.addEventListener("click", () => PF2ETokenBar.openLootActor("Loot"));
        controls.appendChild(lootBtn);

        const sellBtn = document.createElement("button");
        sellBtn.innerText = game.i18n.localize("PF2ETokenBar.Sell");
        sellBtn.addEventListener("click", () => PF2ETokenBar.openLootActor("Sell"));
        controls.appendChild(sellBtn);
      }

      const btn = document.createElement("button");
      btn.innerText = game.i18n.localize("PF2ETokenBar.RequestRoll");
      btn.addEventListener("click", () => this.requestRoll());
      controls.appendChild(btn);

    const encounterBtn = document.createElement("button");
    const encounterKey = game.combat?.started ? "PF2ETokenBar.EndEncounter" : "PF2ETokenBar.StartEncounter";
    encounterBtn.innerText = game.i18n.localize(encounterKey);
    encounterBtn.addEventListener("click", async () => {
      if (game.combat?.started) {
        await game.combat.endCombat();
      } else {
        await game.combat.startCombat();
        if (game.settings.get("pf2e-token-bar", "closeCombatTracker")) ui.combat?.close(); // prevents automatic opening of the standard combat tracker
      }
      PF2ETokenBar.render();
    });
    controls.appendChild(encounterBtn);

    if (game.combat) {
      const npcCombatants = game.combat.combatants.filter(c => !c.actor?.hasPlayerOwner);
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

    if (game.combat?.started) {
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

    handle.addEventListener("mousedown", event => {
      if (game.settings.get("pf2e-token-bar", "locked")) return;
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
      const actors = game.actors.party?.members || [];
      this.debug(
        `PF2ETokenBar | _partyTokens found ${actors.length} actors`,
        actors.map(a => a.id)
      );
      return actors;
    }

    static _combatTokens() {
      let combatants = Array.from(game.combat?.combatants ?? []);
      combatants.sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
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

  static openLootActor(name) {
    const actor = game.actors.getName(name);
    if (actor) {
      actor.sheet.render(true);
    } else {
      ui.notifications.error(game.i18n.format("PF2ETokenBar.TokenMissing", { name }));
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

  static async addPartyToEncounter() {
    const actors = this._partyTokens();
    if (!actors.length) return;

    let combat = game.combat;
    if (!combat) {
      try {
        combat = await Combat.create({ scene: canvas.scene });
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
        await combat.createEmbeddedDocuments("Combatant", [
          { tokenId: token.id, scene: token.scene }
        ]);
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
      if (init !== undefined) await game.combat.setInitiative(combatant.id, init);
      await combatant.unsetFlag("pf2e-token-bar", "delayed");
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
Hooks.on("combatEnd", () => PF2ETokenBar.render());
Hooks.on("combatTurn", () => PF2ETokenBar.render());
Hooks.on("updateCombatant", () => PF2ETokenBar.render());
Hooks.on("renderChatMessage", (_message, html) => {
  const links = html[0]?.querySelectorAll("a.pf2e-token-bar-roll") ?? [];
  for (const link of links) {
    link.addEventListener("click", PF2ETokenBar._handleRollClick);
  }
});
Hooks.on("targetToken", () => PF2ETokenBar.render());

