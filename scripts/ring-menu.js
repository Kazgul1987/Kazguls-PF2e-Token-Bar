export class PF2ERingMenu {
  static element = null;
  static token = null;

  static open(token, { x, y }) {
    this.close();
    this.token = token;

    const menu = document.createElement('div');
    menu.id = 'pf2e-ring-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [];

    // Condition icon
    const condition = document.createElement('div');
    condition.classList.add('pf2e-ring-item');
    condition.title = game.i18n?.localize('PF2ETokenBar.Condition') || 'Condition';
    condition.innerHTML = '<i class="fas fa-list"></i>';
    condition.addEventListener('click', async evt => {
      evt.stopPropagation();
      await PF2ERingMenu._openConditionMenu(token);
      PF2ERingMenu.close();
    });
    menu.appendChild(condition);
    items.push(condition);

    // Visibility icon
    const visibility = document.createElement('div');
    visibility.classList.add('pf2e-ring-item');
    visibility.title = game.i18n?.localize('PF2ETokenBar.Visibility') || 'Visibility';
    const setVisIcon = () => {
      visibility.innerHTML = token.document.hidden
        ? '<i class="fas fa-eye-slash"></i>'
        : '<i class="fas fa-eye"></i>';
    };
    setVisIcon();
    visibility.addEventListener('click', async evt => {
      evt.stopPropagation();
      await token.document.update({ hidden: !token.document.hidden });
      setVisIcon();
    });
    menu.appendChild(visibility);
    items.push(visibility);

    // Ping icon
    const ping = document.createElement('div');
    ping.classList.add('pf2e-ring-item');
    ping.title = game.i18n?.localize('PF2ETokenBar.Ping') || 'Ping';
    ping.innerHTML = '<i class="fas fa-bullseye"></i>';
    ping.addEventListener('click', evt => {
      evt.stopPropagation();
      canvas.ping(token.center, { user: game.user });
    });
    menu.appendChild(ping);
    items.push(ping);

    const combatant = game.combat?.combatants.find(c => c.tokenId === token.id);
    if (combatant) {
      const delayed = combatant.getFlag("pf2e-token-bar", "delayed");
      const delay = document.createElement('div');
      delay.classList.add('pf2e-ring-item');
      const delayKey = delayed ? 'PF2ETokenBar.Play' : 'PF2ETokenBar.Delay';
      delay.title = game.i18n?.localize(delayKey) || (delayed ? 'Play' : 'Delay');
      delay.innerHTML = delayed ? '<i class="fas fa-play"></i>' : '<i class="fas fa-hourglass"></i>';
      delay.addEventListener('click', async evt => {
        evt.stopPropagation();
        if (delayed) {
          await PF2ETokenBar.resumeTurn(combatant);
        } else {
          await PF2ETokenBar.delayTurn(combatant);
        }
      });
      menu.appendChild(delay);
      items.push(delay);
    }

    // Initiative icon
    if (combatant && combatant.initiative == null) {
      const initiative = document.createElement('div');
      initiative.classList.add('pf2e-ring-item');
      initiative.title = game.i18n?.localize('PF2ETokenBar.Initiative') || 'Initiative';
      initiative.innerHTML = '<i class="fas fa-dice-d20"></i>';
      initiative.addEventListener('click', async evt => {
        evt.stopPropagation();
        await combatant.actor.initiative.roll({ createMessage: true, dialog: true });
      });
      menu.appendChild(initiative);
      items.push(initiative);
    }

    document.body.appendChild(menu);

    // radial placement
    const radius = 40;
    const angleStep = (2 * Math.PI) / items.length;
    items.forEach((item, index) => {
      const angle = index * angleStep;
      const size = 32;
      const left = Math.cos(angle) * radius - size / 2;
      const top = Math.sin(angle) * radius - size / 2;
      item.style.left = `${left}px`;
      item.style.top = `${top}px`;
    });

    this.element = menu;
    setTimeout(() => document.addEventListener('mousedown', this._handleOutside, true));
  }

  static close() {
    if (this.element) {
      document.removeEventListener('mousedown', this._handleOutside, true);
      this.element.remove();
      this.element = null;
      this.token = null;
    }
  }

  static _handleOutside(event) {
    if (!PF2ERingMenu.element) return;
    if (!PF2ERingMenu.element.contains(event.target)) {
      PF2ERingMenu.close();
    }
  }

  static async _openConditionMenu(token) {
    try {
      const manager = game.pf2e?.ConditionManager;
      if (manager) {
        const conditions = Array.from(manager.conditions.values())
          .map(c => ({ slug: c.slug, name: game.i18n.localize(c.name) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const options = conditions
          .map(c => `<option value="${c.slug}">${c.name}</option>`)
          .join('');
        const content = `<form><select name="condition">${options}</select></form>`;
        const slug = await Dialog.prompt({
          title: game.i18n?.localize('PF2ETokenBar.Condition') || 'Condition',
          content,
          label: 'OK',
          callback: html => html[0].querySelector('[name=condition]').value,
        });
        if (slug) await token.actor?.toggleCondition(slug);
      } else if (token?.hud?.render) {
        await token.hud.render(true);
        token.hud.element.find('.status-effects').click();
      }
    } catch (err) {
      console.error('PF2ERingMenu | condition menu error', err);
    }
  }
}
