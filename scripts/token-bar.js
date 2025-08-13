class PF2ETokenBar {
  static render() {
    if (!canvas?.ready) return;

    const tokens = this._partyTokens(); 
    if (!tokens.length) return;
    let bar = document.getElementById("pf2e-token-bar");
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.id = "pf2e-token-bar";
    tokens.forEach(t => {
      const img = document.createElement("img");
      img.src = t.document.texture.src;
      img.title = t.document.name;
      img.src = t.texture.src;
      img.title = t.name;
      img.classList.add("pf2e-token-bar-token");
      img.addEventListener("click", () => t.actor?.sheet.render(true));
      bar.appendChild(img);
    });
    const btn = document.createElement("button");
    btn.innerText = game.i18n?.localize("PF2E.Roll") || "Request Roll";
    btn.addEventListener("click", () => this.requestRoll());
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  static _partyTokens() {
    const partyMembers = game.actors.party?.members || [];
    return canvas.tokens.placeables.filter(t => t.actor && partyMembers.includes(t.actor));
  }

  static _activePlayerTokens() {
    return canvas.tokens.placeables.filter(t => t.actor?.hasPlayerOwner);
  }

  static requestRoll() {
    const tokens = this._activePlayerTokens();
    const tokenOptions = tokens.map(t => `<div><input type="checkbox" name="token" value="${t.id}"/> ${t.name}</div>`).join("");
    const skills = CONFIG.PF2E?.skills || {};
    const skillOptions = Object.entries(skills).map(([k,v]) => `<option value="${k}">${v.label ?? v}</option>`).join("");
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
            selected.forEach(id => {
              const token = canvas.tokens.get(id);
              const actor = token?.actor;
              if (!actor) return;
              if (["fortitude","reflex","will"].includes(skill)) {
                actor.saves[skill]?.check.roll({dc: dc ? {value: dc} : undefined});
              } else {
                actor.skills[skill]?.check.roll({dc: dc ? {value: dc} : undefined});
              }
            });
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "roll"
    }).render(true);
  }
}

Hooks.on("canvasReady", () => PF2ETokenBar.render());
Hooks.on("updateToken", () => PF2ETokenBar.render());
Hooks.on("createToken", () => PF2ETokenBar.render());
Hooks.on("deleteToken", () => PF2ETokenBar.render());

