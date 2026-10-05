import type { Entity } from '../entity/Entity';
import { toast } from './effects';

/**
 * The easter egg. Different Thanos, same finger snap: half of what's on screen turns to dust,
 * then comes right back. Triggered by typing "snap", the ⌘K palette, or the AI twin.
 */

const LINES = [
  'Relax: wrong Thanos. The only thing I wipe out is 50% of wasted ad spend.',
  'Perfectly balanced, as all A/B tests should be. Everything is back. 🫰',
  'No infinity stones were used. Just CSS. Your content is safe.',
];

let busy = false;
let lineIndex = 0;

const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

export function snap(entity: Pick<Entity, 'snap'> | null): void {
  if (busy) return;
  busy = true;
  entity?.snap();
  const line = LINES[lineIndex++ % LINES.length];

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visible = [...document.querySelectorAll<HTMLElement>('[data-snap]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  });

  if (reduced || !visible.length) {
    toast(line);
    setTimeout(() => (busy = false), 1200);
    return;
  }

  const victims = visible.sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.ceil(visible.length / 2)));
  const useFilter = !isSafari;
  victims.forEach((el, i) => {
    el.style.setProperty('--dust-delay', `${i * 70}ms`);
    el.classList.add('is-dusting', useFilter ? 'dust-filter' : 'dust-soft');
  });

  // Grow the displacement on the shared SVG filter for that grainy, dusty dissolve.
  const disp = document.querySelector<SVGFEDisplacementMapElement>('#dust feDisplacementMap');
  const start = performance.now();
  const total = 1500 + victims.length * 70;
  const grow = (now: number) => {
    const k = Math.min(1, (now - start) / total);
    disp?.setAttribute('scale', String(Math.round(140 * k * k)));
    if (k < 1) requestAnimationFrame(grow);
  };
  if (useFilter) requestAnimationFrame(grow);

  setTimeout(() => toast(line, 3400), 900);
  setTimeout(() => {
    disp?.setAttribute('scale', '0');
    victims.forEach((el) => {
      el.classList.remove('is-dusting', 'dust-filter', 'dust-soft');
      el.classList.add('is-restoring');
    });
    setTimeout(() => {
      victims.forEach((el) => {
        el.classList.remove('is-restoring');
        el.style.removeProperty('--dust-delay');
      });
      busy = false;
    }, 900 + victims.length * 70);
  }, total + 1300);
}

/** Typing s-n-a-p anywhere (outside of inputs) triggers it. */
export function listenForSnapWord(trigger: () => void): void {
  let typed = '';
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]')) return;
    if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
    typed = (typed + e.key.toLowerCase()).slice(-4);
    if (typed === 'snap') {
      typed = '';
      trigger();
    }
  });
}
