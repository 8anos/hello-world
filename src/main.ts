import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono';
import './styles/main.css';

import type { Entity } from './entity/Entity';
import { Chat, type ChatAction } from './chat/chat';
import { copyEmail, EMAIL, initNav, initReveal, initSpotlight, scramble, scrollToSection, toast } from './ui/effects';
import { initPalette } from './ui/palette';
import { listenForSnapWord, snap } from './ui/snap';
import { initTerminals } from './ui/terminal';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

// ---------- The entity (Three.js is loaded lazily so the page is interactive first) ----------
type EntityLike = Pick<Entity, 'setAnchor' | 'setMood' | 'pulse' | 'setHover' | 'lookAtElement' | 'snap'>;
let realEntity: Entity | null = null;
const entity: EntityLike = {
  setAnchor: (...a) => realEntity?.setAnchor(...a),
  setMood: (...a) => realEntity?.setMood(...a),
  pulse: (...a) => realEntity?.pulse(...a),
  setHover: (...a) => realEntity?.setHover(...a),
  lookAtElement: (...a) => realEntity?.lookAtElement(...a),
  snap: () => realEntity?.snap(),
};
const canvas = $<HTMLCanvasElement>('#entity')!;
const noWebGL = () => {
  document.documentElement.classList.add('no-webgl');
  canvas.remove();
};
import('./entity/Entity')
  .then(({ Entity }) => {
    realEntity = Entity.create(canvas);
    if (realEntity) updateAnchor();
    else noWebGL();
  })
  .catch(noWebGL);

const heroAnchor = $('[data-orb-anchor="hero"]')!;
const dockAnchor = $('[data-orb-anchor="dock"]')!;
const chatAnchor = $('[data-orb-anchor="chat"]')!;

// ---------- Chat ----------
const chat = new Chat(entity, {
  onToggle: () => updateAnchor(),
  onAction: (action: ChatAction) => {
    if (action.type === 'snap') runSnap();
    else {
      if (window.matchMedia('(max-width: 640px)').matches) chat.close();
      scrollToSection(action.target);
    }
  },
});

$$('[data-open-chat]').forEach((el) => el.addEventListener('click', () => chat.show(el)));
$$<HTMLButtonElement>('[data-ask]').forEach((el) =>
  el.addEventListener('click', () => chat.ask(el.dataset.ask ?? el.textContent ?? '', el)),
);

// ---------- Where should the orb live right now? ----------
let dockNudged = false;
function updateAnchor(): void {
  let target: 'hero' | 'dock' | 'chat';
  if (chat.open) target = 'chat';
  else {
    const r = heroAnchor.getBoundingClientRect();
    const heroInView = r.bottom > window.innerHeight * 0.3 && r.top < window.innerHeight * 0.72;
    target = heroInView ? 'hero' : 'dock';
  }
  document.body.classList.toggle('dock-active', target === 'dock');
  if (target === 'dock' && !dockNudged) {
    dockNudged = true;
    dockAnchor.classList.add('is-nudging');
    setTimeout(() => dockAnchor.classList.remove('is-nudging'), 2600);
  }
  speech.setActive(target === 'hero');
  entity?.setAnchor(
    target === 'chat' ? chatAnchor : target === 'dock' ? dockAnchor : heroAnchor,
    target === 'hero' ? 'full' : 'body',
  );
}

let scrollQueued = false;
window.addEventListener(
  'scroll',
  () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      updateAnchor();
    });
  },
  { passive: true },
);
window.addEventListener('resize', () => updateAnchor());

for (const el of [heroAnchor, dockAnchor]) {
  el.addEventListener('pointerenter', () => entity?.setHover(true));
  el.addEventListener('pointerleave', () => entity?.setHover(false));
  el.addEventListener('focus', () => entity?.setHover(true));
  el.addEventListener('blur', () => entity?.setHover(false));
}

// ---------- Speech bubble next to the hero orb ----------
const speech = (() => {
  const el = $('#speech')!;
  const lines = [
    "Hi! I'm Thanos 👋 the AI one.",
    "Click me. I don't bite. I don't even have teeth.",
    'Psst… I know all his metrics.',
    'Not the purple one. Promise.',
    'Ask me what GEO is. I dare you.',
    "I've read his CV 10,000 times. Recruiter record.",
  ];
  let i = 0;
  let active = true;
  let timer = 0;
  const cycle = () => {
    clearTimeout(timer);
    if (!active || document.hidden) {
      el.classList.remove('is-on');
      timer = window.setTimeout(cycle, 2000);
      return;
    }
    el.textContent = lines[i++ % lines.length];
    el.classList.add('is-on');
    timer = window.setTimeout(() => {
      el.classList.remove('is-on');
      timer = window.setTimeout(cycle, 2600);
    }, 4400);
  };
  timer = window.setTimeout(cycle, 1900);
  return {
    setActive(on: boolean) {
      if (on === active) return;
      active = on;
      if (!on) el.classList.remove('is-on');
    },
  };
})();

// ---------- Snap ----------
function runSnap(): void {
  if (chat.open && window.matchMedia('(max-width: 640px)').matches) chat.close();
  snap(entity);
}
listenForSnapWord(runSnap);

// ---------- Command palette ----------
const palette = initPalette(
  [
    { group: 'Do', icon: '✦', label: 'Talk to the AI twin', keywords: 'chat ask thanos ai', run: () => chat.show() },
    { group: 'Go to', icon: '↑', label: 'Top', keywords: 'home hero start', run: () => scrollToSection('top') },
    { group: 'Go to', icon: '⚗', label: 'The Lab', keywords: 'projects tools ai build', run: () => scrollToSection('lab') },
    { group: 'Go to', icon: '▮', label: 'Benchmarks', keywords: 'results metrics numbers', run: () => scrollToSection('benchmarks') },
    { group: 'Go to', icon: '⌁', label: 'Training log', keywords: 'experience career jobs cv timeline education', run: () => scrollToSection('log') },
    { group: 'Go to', icon: '▤', label: 'Model card', keywords: 'skills tools languages certificates', run: () => scrollToSection('model-card') },
    { group: 'Go to', icon: '✉', label: 'Contact', keywords: 'email hire handshake', run: () => scrollToSection('contact') },
    { group: 'Do', icon: '⧉', label: 'Copy email address', hint: EMAIL, keywords: 'mail contact', run: () => void copyEmail() },
    { group: 'Do', icon: '✉', label: 'Write an email', keywords: 'mail contact hire', run: () => (window.location.href = `mailto:${EMAIL}`) },
    { group: 'Do', icon: 'in', label: 'Open LinkedIn', keywords: 'profile social', run: () => window.open('https://www.linkedin.com/in/thanosntakos/', '_blank', 'noopener') },
    { group: 'Do', icon: '≡', label: 'Read llms.txt', keywords: 'geo ai llm summary', run: () => window.open('/llms.txt', '_blank', 'noopener') },
    { group: 'Do', icon: '🫰', label: 'Snap fingers', keywords: 'easter egg marvel infinity', run: runSnap },
  ],
  (q) => chat.ask(q),
);
$$('[data-open-palette]').forEach((el) => el.addEventListener('click', () => palette.open()));

// ---------- Small things ----------
$$('[data-copy-email]').forEach((el) => el.addEventListener('click', () => void copyEmail()));
$$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
  $$('[data-mod-key]').forEach((el) => (el.textContent = 'Ctrl'));
}
const heroWord = $('[data-scramble]');
heroWord?.addEventListener('pointerenter', () => scramble(heroWord, 700));

initNav();
initReveal();
initSpotlight();
initTerminals();
updateAnchor();

// Show the hero immediately (no waiting on the observer for above-the-fold content).
requestAnimationFrame(() => $$('.hero [data-reveal]').forEach((el) => el.classList.add('is-visible')));
if (heroWord) setTimeout(() => scramble(heroWord), 500);

if (new URLSearchParams(location.search).has('chat')) chat.show();
if (location.hash === '#snap') setTimeout(runSnap, 1200);

console.log(
  '%c👋 Hey, fellow curious human.',
  'font: 600 14px system-ui; color: #f4c76b',
  `\nThe AI twin lives at /api/chat. The real one lives at ${EMAIL}.\nType "snap" on the page if you're feeling Marvel-ous.`,
);

// Friendly heads-up the first time someone copies text from the page.
let copyJoked = false;
document.addEventListener('copy', () => {
  if (copyJoked) return;
  copyJoked = true;
  toast('Copying the CV? Smart. The original is available at ' + EMAIL + ' 😉', 3200);
});
