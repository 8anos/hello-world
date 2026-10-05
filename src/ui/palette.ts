/** ⌘K command palette: navigate, act, or ask the AI anything. */

export type Command = {
  label: string;
  group: 'Ask' | 'Go to' | 'Do';
  icon: string;
  hint?: string;
  keywords?: string;
  run: () => void;
};

export function initPalette(commands: Command[], askAI: (q: string) => void): { open: () => void } {
  const root = document.getElementById('palette') as HTMLElement;
  const input = document.getElementById('palette-input') as HTMLInputElement;
  const list = document.getElementById('palette-list') as HTMLUListElement;
  let items: Command[] = [];
  let active = 0;
  let lastFocus: HTMLElement | null = null;

  const filter = (q: string): Command[] => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = commands.filter((c) => {
      const hay = `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    if (q.trim()) {
      // Ask the AI comes first when nothing else matches, last otherwise.
      matches[matches.length ? 'push' : 'unshift']({
        label: `Ask the AI twin: “${q.trim()}”`,
        group: 'Ask',
        icon: '✦',
        hint: '↵',
        run: () => askAI(q.trim()),
      });
    }
    return matches;
  };

  const render = () => {
    items = filter(input.value);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.replaceChildren();
    let group = '';
    items.forEach((cmd, i) => {
      if (cmd.group !== group) {
        group = cmd.group;
        const g = document.createElement('li');
        g.className = 'palette__group';
        g.setAttribute('role', 'presentation');
        g.textContent = group;
        list.append(g);
      }
      const li = document.createElement('li');
      li.className = 'palette__item';
      li.id = `palette-item-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.innerHTML = '<span class="palette__icon" aria-hidden="true"></span><span class="palette__label"></span><span class="palette__hint"></span>';
      (li.children[0] as HTMLElement).textContent = cmd.icon;
      (li.children[1] as HTMLElement).textContent = cmd.label;
      (li.children[2] as HTMLElement).textContent = cmd.hint ?? '';
      li.addEventListener('pointermove', () => {
        if (active !== i) {
          active = i;
          syncActive();
        }
      });
      li.addEventListener('click', () => execute(i));
      list.append(li);
    });
    input.setAttribute('aria-activedescendant', items.length ? `palette-item-${active}` : '');
  };

  const syncActive = () => {
    list.querySelectorAll<HTMLElement>('.palette__item').forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === active));
      if (i === active) el.scrollIntoView({ block: 'nearest' });
    });
    input.setAttribute('aria-activedescendant', `palette-item-${active}`);
  };

  const execute = (i: number) => {
    const cmd = items[i];
    if (!cmd) return;
    close(false);
    setTimeout(cmd.run, 60);
  };

  const open = () => {
    if (!root.hidden) return;
    lastFocus = document.activeElement as HTMLElement | null;
    root.hidden = false;
    input.value = '';
    active = 0;
    render();
    input.focus();
  };

  const close = (restoreFocus = true) => {
    if (root.hidden) return;
    root.hidden = true;
    if (restoreFocus) lastFocus?.focus({ preventScroll: true });
  };

  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      syncActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  });
  root.querySelector('[data-palette-close]')?.addEventListener('click', () => close());

  document.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (root.hidden) open();
      else close();
    } else if (e.key === '/' && !typing && root.hidden) {
      e.preventDefault();
      open();
    }
  });

  return { open };
}
