Hooks.once("init", () => {
  game.settings.register("pf2e-token-bar", "position", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
});

class PF2ETokenBar {
  static render() {
    if (!canvas?.ready) return;

    console.log("PF2ETokenBar | fetching party tokens");
    const tokens = this._partyTokens();
    console.log("PF2ETokenBar | found tokens", tokens.map(t => t.id));
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
    tokens.forEach(t => {
      const img = document.createElement("img");
      img.src = t.document.texture.src;
      img.title = t.document.name;
      img.classList.add("pf2e-token-bar-token");
      img.addEventListener("click", () => t.actor?.sheet.render(true));
      bar.appendChild(img);
    });
    const btn = document.createElement("button");
    btn.innerText = game.i18n?.localize("PF2E.Roll") || "Request Roll";
    btn.addEventListener("click", () => this.requestRoll());
    bar.appendChild(btn);

    const restBtn = document.createElement("button");
    restBtn.innerHTML = '<i class="fas fa-bed"></i>';
    restBtn.title = game.i18n?.localize("PF2E.RestAll") || "Rest All";
    restBtn.addEventListener("click", () => this.restAll());
    bar.appendChild(restBtn);

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
      if (event.target !== bar) return;
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
    const partyMembers = game.actors.party?.members || [];
    const tokens = canvas.tokens.placeables.filter(t => t.actor && partyMembers.includes(t.actor));
    console.log(`PF2ETokenBar | _partyTokens filtered ${tokens.length} tokens`, tokens.map(t => t.actor.id));
    return tokens;
    const partyIds = (game.actors.party?.members ?? []).map(a => a.id);
    if (!partyIds.length) return this._activePlayerTokens();
    return canvas.tokens.placeables.filter(t => t.actor && partyIds.includes(t.actor.id));
  }

  static _activePlayerTokens() {
    const tokens = canvas.tokens.placeables.filter(t => t.actor?.hasPlayerOwner);
    console.log(`PF2ETokenBar | _activePlayerTokens filtered ${tokens.length} tokens`, tokens.map(t => t.actor?.id));
    return tokens;
  }

  static async restAll() {
    const actors = this._partyTokens().map(t => t.actor).filter(a => a);
    if (!actors.length) return;
    await game.pf2e.actions.restForTheNight({ actors });
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
    const saveOptions = ["fortitude","reflex","will"].map(s => `<option value="${s}">${s}</option>`).join("");
    const content = `<div><label>DC <input type="number" name="dc"/></label></div>
    <div class="flexrow">
      <div class="token-select">${tokenOptions}</div>
      <div class="skill-select">
        <select name="skill">${skillOptions}<optgroup label="Saves">${saveOptions}</optgroup></select>
      </div>
    </div>`;
    new Dialog({
      title: "Request Roll",
      content,
      buttons: {
        roll: {
          label: "Roll",
          callback: html => {
            const form = html[0].querySelector("form") || html[0];
            const dc = Number(form.querySelector('input[name="dc"]').value) || undefined;
            const skill = form.querySelector('select[name="skill"]').value;
            const selected = Array.from(form.querySelectorAll('input[name="token"]:checked')).map(i => i.value);
            console.log("PF2ETokenBar | requestRoll selection", { tokens: selected, skill, dc });
            selected.forEach(id => {
              const token = canvas.tokens.get(id);
              if (!token?.actor) return;
              const skillLabelKey = CONFIG.PF2E?.skills[skill]?.label ?? skill;
              const skillLabel = game.i18n?.localize(skillLabelKey) ?? skillLabelKey;
              const link = `<a class="pf2e-token-bar-roll" data-token-id="${id}" data-skill="${skill}" data-dc="${dc ?? ""}">${skillLabel}</a>`;
              const img = `<img class="pf2e-token-bar-chat-token" src="${token.document.texture.src}"/>`;
              const content = `${token.name ? token.name + ": " : ""}${img}${link}`;
              ChatMessage.create({ content });
            });
          }
        },
        cancel: { label: "Cancel" }
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

Hooks.on("canvasReady", () => PF2ETokenBar.render());
Hooks.on("updateToken", () => PF2ETokenBar.render());
Hooks.on("createToken", () => PF2ETokenBar.render());
Hooks.on("deleteToken", () => PF2ETokenBar.render());
Hooks.on("renderChatMessage", (_message, html) => {
  const links = html[0]?.querySelectorAll("a.pf2e-token-bar-roll") ?? [];
  for (const link of links) {
    link.addEventListener("click", PF2ETokenBar._handleRollClick);
  }
});

