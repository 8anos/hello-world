/** Illustrative terminal runs for the Lab cards. They type out while visible, then loop. */

type Segment = [text: string, cls?: string];
type Line = Segment[];

const SCRIPTS: Record<string, { command: string; lines: Line[] }> = {
  engine: {
    command: 'seo-ai run --markets de,fr,es,it,nl --seed "business travel"',
    lines: [
      [['› ', 't-dim'], ['expanding seed keywords ........ '], ['12,480 found', 't-info']],
      [['› ', 't-dim'], ['clustering by intent (Claude) .. '], ['214 clusters', 't-info']],
      [['› ', 't-dim'], ['writing content briefs ......... '], ['214/214', 't-info']],
      [['› ', 't-dim'], ['brand & compliance check ....... '], ['3 flags → fixed', 't-warn']],
      [['› ', 't-dim'], ['localizing de · fr · es · it · nl '], ['done', 't-info']],
      [['✓ ', 't-ok'], ['ready for human review. ', 't-ok'], ['coffee still warm ☕', 't-dim']],
    ],
  },
  audit: {
    command: 'python audit.py --site example.com',
    lines: [
      [['› ', 't-dim'], ['crawled '], ['18,203', 't-info'], [' urls']],
      [['› ', 't-dim'], ['41', 't-warn'], [' redirect chains · '], ['7', 't-warn'], [' orphan pages']],
      [['✓ ', 't-ok'], ['report sent. no spreadsheets were opened.', 't-ok']],
    ],
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function span(text: string, cls?: string): HTMLSpanElement {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  s.textContent = text;
  return s;
}

async function play(body: HTMLElement, script: (typeof SCRIPTS)[string], alive: () => boolean): Promise<void> {
  body.replaceChildren();
  body.append(span('$ ', 't-prompt'));
  const cmd = span('');
  const caret = span('', 't-caret');
  body.append(cmd, caret);
  for (const ch of script.command) {
    if (!alive()) return;
    cmd.textContent += ch;
    await sleep(22 + Math.random() * 40);
  }
  await sleep(350);
  caret.remove();
  for (const line of script.lines) {
    if (!alive()) return;
    body.append('\n');
    for (const [text, cls] of line) body.append(span(text, cls));
    await sleep(420 + Math.random() * 380);
  }
  body.append('\n', span('$ ', 't-prompt'), caret);
}

export function initTerminals(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLElement>('[data-terminal]').forEach((term) => {
    const script = SCRIPTS[term.dataset.terminal ?? ''];
    const body = term.querySelector<HTMLElement>('.terminal__body');
    if (!script || !body) return;

    if (reduced) {
      body.textContent = `$ ${script.command}\n${script.lines.map((l) => l.map(([t]) => t).join('')).join('\n')}`;
      return;
    }

    let visible = false;
    let running = false;
    const loop = async () => {
      if (running) return;
      running = true;
      while (visible) {
        await play(body, script, () => visible);
        for (let i = 0; i < 50 && visible; i++) await sleep(100);
      }
      running = false;
    };
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) void loop();
      },
      { threshold: 0.35 },
    ).observe(term);
  });
}
