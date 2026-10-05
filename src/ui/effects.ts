const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fade/slide elements in as they enter the viewport; also fires counters and scrambles. */
export function initReveal(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal], .bench');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add('is-visible');
        el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
        if (el.matches('[data-count]')) countUp(el);
        el.querySelectorAll<HTMLElement>('[data-scramble]').forEach((s) => scramble(s));
        io.unobserve(el);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

function countUp(el: HTMLElement): void {
  if (el.dataset.counted) return;
  el.dataset.counted = '1';
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target) || reduced()) return;
  const start = performance.now();
  const duration = 1400;
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / duration);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz#%&*+=?<>/';

/** Decode-style text effect. */
export function scramble(el: HTMLElement, duration = 900): void {
  if (reduced() || el.dataset.scrambling) return;
  const final = el.dataset.text ?? el.textContent ?? '';
  el.dataset.text = final;
  el.dataset.scrambling = '1';
  const start = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - start) / duration);
    const settled = Math.floor(k * final.length);
    let out = final.slice(0, settled);
    for (let i = settled; i < final.length; i++) {
      out += final[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    el.textContent = out;
    if (k < 1) requestAnimationFrame(tick);
    else {
      el.textContent = final;
      delete el.dataset.scrambling;
    }
  };
  requestAnimationFrame(tick);
}

/** Mouse-following light on cards. */
export function initSpotlight(): void {
  document.addEventListener(
    'pointermove',
    (e) => {
      const card = (e.target as Element | null)?.closest?.('.card') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
    { passive: true },
  );
}

/** Nav background on scroll + active section link. */
export function initNav(): void {
  const nav = document.getElementById('nav');
  const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const links = new Map<string, HTMLAnchorElement>();
  document.querySelectorAll<HTMLAnchorElement>('.nav__links a').forEach((a) => links.set(a.hash.slice(1), a));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a, id) => a.classList.toggle('is-active', id === entry.target.id));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  links.forEach((_a, id) => {
    const section = document.getElementById(id);
    if (section) io.observe(section);
  });
}

let toastTimer = 0;
export function toast(message: string, ms = 3800): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.remove('is-on');
    toastTimer = window.setTimeout(() => (el.hidden = true), 400);
  }, ms);
}

export const EMAIL = 'thanos.ntakos@gmail.com';

export async function copyEmail(): Promise<void> {
  try {
    await navigator.clipboard.writeText(EMAIL);
    toast('Email copied. You are now one step closer to the real Thanos. ✉️');
  } catch {
    toast(`Here it is: ${EMAIL}`);
  }
}

export function scrollToSection(id: string): void {
  const target = id === 'top' ? document.body : document.getElementById(id);
  if (!target) return;
  if (id === 'top') window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
}
