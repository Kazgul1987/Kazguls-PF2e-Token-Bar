Hooks.once("init", () => {
  game.settings.register("pf2e-token-bar", "position", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
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
    const content = document.createElement("div");
    content.classList.add("pf2e-token-bar-content");
    bar.appendChild(content);
    if (game.combat?.round > 0) {
      const roundDisplay = document.createElement("div");
      roundDisplay.classList.add("pf2e-round-display");
      roundDisplay.innerText = game.i18n.format("PF2ETokenBar.Round", { round: game.combat.round });
      content.prepend(roundDisplay);
    }

    tokens.forEach(token => {
      const actor = token.actor;
      const wrapper = document.createElement("div");
      wrapper.classList.add("pf2e-token-wrapper");
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
        if (game.combat?.started && combatant.id === game.combat.combatant?.id) {
          wrapper.classList.add("active-turn");
        }
        const init = document.createElement("div");
        init.classList.add("pf2e-initiative");
        if (combatant.initiative !== undefined && combatant.initiative !== null) {
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
      img.addEventListener("contextmenu", async event => {
        event.preventDefault();
        event.stopPropagation();
        let elem;
        if (token?.hud?.render) {
          await token.hud.render(true); // shows the standard Token HUD
          elem = token.hud.element;
        } else if (canvas.tokens?.hud?.bind) {
          await canvas.tokens.hud.bind(token);
          elem = canvas.tokens.hud.element;
        } else {
          await canvas.hud?.token?.bind(token);
          elem = canvas.hud?.token?.element;
        }

        if (elem?.css) {
          elem.css({ left: event.clientX, top: event.clientY });
        } else if (elem?.style) {
          elem.style.left = `${event.clientX}px`;
          elem.style.top = `${event.clientY}px`;
        }
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

      content.appendChild(wrapper);
    });

    const controls = document.createElement("div");
    controls.classList.add("pf2e-token-bar-controls");
    content.appendChild(controls);

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
        await game.combat?.startCombat();
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
      const combatants = Array.from(game.combat?.turns ?? []);
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

    if (!combat.started) await combat.startCombat();
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

document.addEventListener("keydown", event => {
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
});

Hooks.on("canvasReady", () => PF2ETokenBar.render());
Hooks.on("updateToken", () => PF2ETokenBar.render());
Hooks.on("createToken", () => PF2ETokenBar.render());
Hooks.on("deleteToken", () => PF2ETokenBar.render());
Hooks.on("createCombatant", () => PF2ETokenBar.render());
Hooks.on("deleteCombatant", () => PF2ETokenBar.render());
Hooks.on("updateActor", (_actor, data) => {
  if (data.system?.attributes?.hp) PF2ETokenBar.render();
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

