import type { Entity } from '../entity/Entity';

type EntityLike = Pick<Entity, 'setMood' | 'pulse' | 'lookAtElement'>;
import { renderMarkdown } from './markdown';
import { offlineAnswer } from './offline';

type Turn = { role: 'user' | 'assistant'; content: string };
type Mode = 'unknown' | 'live' | 'offline';

const STORAGE_KEY = 'thanos-chat-v1';
const HISTORY_FOR_API = 12;

const WELCOME =
  "Γεια σου! 👋 I'm **Thanos**, the digital one. I've read his CV more times than any recruiter. Ask me about his work in AI and search, what GEO is, or request a joke. I'm funny. Allegedly.";

const SUGGESTIONS = [
  "What's he building with AI?",
  "Explain GEO like I'm five",
  "What's his biggest win?",
  'Tell me an SEO joke',
  'Are you THAT Thanos?',
  'What tools does he use?',
  'Why work with him?',
  'Show me his career',
  'How do I contact him?',
  'Μιλάς ελληνικά;',
];

const THINKING_LINES = [
  'Thinking… consulting the training log',
  'Clustering thoughts by intent…',
  'Running an A/B test on this answer…',
  'Asking the real Thanos… kidding',
  'Optimizing for the featured snippet…',
  'Checking the benchmarks…',
];

const STATUS = {
  live: 'Online · mildly caffeinated',
  offline: 'Offline brain · still charming',
  talking: 'Typing… with feeling',
};

export type ChatAction = { type: 'goto'; target: string } | { type: 'snap' };

/** Pulls [[action]] tokens out of a text stream, even when they arrive split across chunks. */
class TokenFilter {
  private buffer = '';
  constructor(
    private readonly onAction: (action: ChatAction) => void,
    private readonly onReset: () => void,
  ) {}

  push(chunk: string): string {
    this.buffer += chunk;
    let out = '';
    for (;;) {
      const start = this.buffer.indexOf('[[');
      if (start === -1) {
        const keep = this.buffer.endsWith('[') ? 1 : 0;
        out += this.buffer.slice(0, this.buffer.length - keep);
        this.buffer = this.buffer.slice(this.buffer.length - keep);
        return out;
      }
      out += this.buffer.slice(0, start);
      const end = this.buffer.indexOf(']]', start + 2);
      if (end === -1) {
        if (this.buffer.length - start > 40) {
          out += '[[';
          this.buffer = this.buffer.slice(start + 2);
          continue;
        }
        this.buffer = this.buffer.slice(start);
        return out;
      }
      const token = this.buffer.slice(start + 2, end).trim().toLowerCase();
      this.buffer = this.buffer.slice(end + 2);
      if (token === 'reset') {
        out = '';
        this.onReset();
      } else if (token === 'snap') this.onAction({ type: 'snap' });
      else if (token.startsWith('goto:')) this.onAction({ type: 'goto', target: token.slice(5) });
    }
  }

  flush(): string {
    const rest = this.buffer;
    this.buffer = '';
    return rest;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export class Chat {
  private readonly root = document.getElementById('chat') as HTMLElement;
  private readonly log = document.getElementById('chat-log') as HTMLElement;
  private readonly form = document.getElementById('chat-form') as HTMLFormElement;
  private readonly input = document.getElementById('chat-input') as HTMLTextAreaElement;
  private readonly status = document.getElementById('chat-status') as HTMLElement;
  private readonly suggest = document.getElementById('chat-suggest') as HTMLElement;
  private readonly send = this.form.querySelector('button[type="submit"]') as HTMLButtonElement;

  private history: Turn[] = [];
  private asked = new Set<string>();
  private mode: Mode = 'unknown';
  private busy = false;
  private opener: HTMLElement | null = null;
  private abort: AbortController | null = null;
  private offlineNoted = false;
  open = false;

  constructor(
    private readonly entity: EntityLike | null,
    private readonly hooks: { onToggle: (open: boolean) => void; onAction: (action: ChatAction) => void },
  ) {
    this.restore();
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit(this.input.value);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.submit(this.input.value);
      }
    });
    this.input.addEventListener('input', () => {
      this.autosize();
      this.updateSendState();
      if (!this.busy) this.entity?.setMood(this.input.value.trim() ? 'listening' : 'idle');
      this.entity?.lookAtElement(this.input.value.trim() ? this.input : null);
    });
    this.input.addEventListener('blur', () => {
      if (!this.busy) this.entity?.setMood('idle');
      this.entity?.lookAtElement(null);
    });
    this.root.querySelector('[data-chat-close]')?.addEventListener('click', () => this.close());
    this.root.querySelector('[data-chat-reset]')?.addEventListener('click', () => this.reset());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open && !document.querySelector('.palette:not([hidden])')) this.close();
    });
    this.updateSendState();
  }

  show(opener?: HTMLElement | null): void {
    if (this.open) {
      this.input.focus();
      return;
    }
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
    this.open = true;
    this.root.hidden = false;
    void this.root.offsetWidth;
    this.root.classList.add('is-open');
    document.body.classList.add('chat-open');
    this.hooks.onToggle(true);
    if (!this.log.childElementCount) this.renderAll();
    this.renderSuggestions();
    this.scrollToEnd();
    if (window.matchMedia('(pointer: fine)').matches) setTimeout(() => this.input.focus(), 250);
    void this.detectMode();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('is-open');
    document.body.classList.remove('chat-open');
    this.entity?.lookAtElement(null);
    this.hooks.onToggle(false);
    setTimeout(() => {
      if (!this.open) this.root.hidden = true;
    }, 380);
    this.opener?.focus({ preventScroll: true });
  }

  /** Open the chat and ask a question right away. */
  ask(question: string, opener?: HTMLElement | null): void {
    this.show(opener);
    setTimeout(() => this.submit(question), 320);
  }

  // ---------- Sending ----------

  private async submit(raw: string): Promise<void> {
    const text = raw.trim().slice(0, 600);
    if (!text || this.busy) return;
    this.busy = true;
    this.root.dataset.busy = 'true';
    this.input.value = '';
    this.autosize();
    this.updateSendState();
    this.asked.add(text.toLowerCase());
    this.suggest.replaceChildren();

    this.history.push({ role: 'user', content: text });
    this.appendMessage('user', text);
    this.persist();

    this.entity?.lookAtElement(null);
    this.entity?.setMood('thinking');
    this.status.textContent = pick(THINKING_LINES);
    const typing = this.appendTyping();

    const actions: ChatAction[] = [];
    let bubble: HTMLElement | null = null;
    let answer = '';
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (bubble) bubble.innerHTML = renderMarkdown(answer.trim());
      this.scrollToEnd();
    };
    const filter = new TokenFilter(
      (action) => actions.push(action),
      () => (answer = ''),
    );
    const onText = (chunk: string) => {
      const clean = filter.push(chunk);
      if (!clean && !answer) return;
      if (!bubble) {
        typing.remove();
        bubble = this.appendMessage('assistant', '');
        bubble.classList.add('is-streaming');
        this.entity?.setMood('talking');
        this.status.textContent = STATUS.talking;
      }
      answer += clean;
      this.entity?.pulse(Math.min(1.5, clean.length / 12));
      if (!frame) frame = requestAnimationFrame(paint);
    };

    try {
      if (this.mode === 'unknown') await this.detectMode();
      if (this.mode === 'live') {
        const ok = await this.streamLive(onText);
        if (!ok) await this.streamOffline(text, onText);
      } else {
        await this.streamOffline(text, onText);
      }
    } catch (error) {
      console.warn('Chat failed, using the offline brain.', error);
      if (!answer) await this.streamOffline(text, onText);
    }

    answer += filter.flush();
    if (!bubble) {
      typing.remove();
      bubble = this.appendMessage('assistant', '');
    }
    if (frame) cancelAnimationFrame(frame);
    const finalBubble = bubble as HTMLElement;
    answer = answer.trim() || "I lost my train of thought. Could you ask that again?";
    finalBubble.innerHTML = renderMarkdown(answer);
    finalBubble.classList.remove('is-streaming');
    if (this.mode === 'offline' && !this.offlineNoted) {
      this.offlineNoted = true;
      const note = document.createElement('span');
      note.className = 'msg__note';
      note.textContent = 'Running on my offline brain. The live AI is on a coffee break.';
      finalBubble.append(note);
    }
    this.scrollToEnd();

    this.history.push({ role: 'assistant', content: answer });
    this.persist();
    this.busy = false;
    this.root.dataset.busy = 'false';
    this.entity?.setMood('idle');
    this.status.textContent = this.mode === 'offline' ? STATUS.offline : STATUS.live;
    this.updateSendState();
    this.renderSuggestions();

    actions.slice(0, 2).forEach((action, i) => setTimeout(() => this.hooks.onAction(action), 700 + i * 400));
  }

  /** Returns false when the live brain is unavailable and the caller should fall back. */
  private async streamLive(onText: (chunk: string) => void): Promise<boolean> {
    this.abort?.abort();
    this.abort = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: this.history.slice(-HISTORY_FOR_API) }),
      signal: this.abort.signal,
    });
    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      onText(data.message ?? 'Whoa, slow down! Give me a minute to catch my breath.');
      return true;
    }
    if (!response.ok || !response.body) {
      if (response.status === 503 || response.status === 404) this.setMode('offline');
      return false;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onText(decoder.decode(value, { stream: true }));
    }
    onText(decoder.decode());
    return true;
  }

  /** Types the offline answer out so the orb still gets to "talk". */
  private async streamOffline(question: string, onText: (chunk: string) => void): Promise<void> {
    await sleep(500 + Math.random() * 600);
    const answer = offlineAnswer(question);
    for (let i = 0; i < answer.length; ) {
      const step = 2 + Math.floor(Math.random() * 4);
      onText(answer.slice(i, i + step));
      i += step;
      await sleep(14 + Math.random() * 16);
    }
  }

  private async detectMode(): Promise<void> {
    if (this.mode !== 'unknown') return;
    try {
      const res = await fetch('/api/chat', { method: 'GET', headers: { Accept: 'application/json' } });
      const data = res.ok ? await res.json() : null;
      this.setMode(data?.live ? 'live' : 'offline');
    } catch {
      this.setMode('offline');
    }
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.root.dataset.mode = mode;
    if (!this.busy) this.status.textContent = mode === 'offline' ? STATUS.offline : STATUS.live;
  }

  // ---------- Rendering ----------

  private renderAll(): void {
    this.log.replaceChildren();
    this.appendMessage('assistant', WELCOME);
    for (const turn of this.history) this.appendMessage(turn.role, turn.content);
  }

  private appendMessage(role: Turn['role'], text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `msg msg--${role === 'user' ? 'user' : 'bot'}`;
    if (role === 'user') el.textContent = text;
    else el.innerHTML = renderMarkdown(text);
    this.log.append(el);
    this.scrollToEnd();
    return el;
  }

  private appendTyping(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'msg msg--bot msg--typing';
    el.setAttribute('aria-label', 'Thanos is typing');
    el.innerHTML = '<i></i><i></i><i></i>';
    this.log.append(el);
    this.scrollToEnd();
    return el;
  }

  private renderSuggestions(): void {
    const fresh = SUGGESTIONS.filter((s) => !this.asked.has(s.toLowerCase()));
    const count = this.history.length ? 3 : 5;
    const list = this.history.length ? fresh.sort(() => Math.random() - 0.5).slice(0, count) : fresh.slice(0, count);
    this.suggest.replaceChildren(
      ...list.map((s) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = s;
        b.addEventListener('click', () => this.submit(s));
        return b;
      }),
    );
  }

  private scrollToEnd(): void {
    this.log.scrollTop = this.log.scrollHeight;
  }

  private autosize(): void {
    if (!this.input.value) {
      this.input.style.height = '';
      return;
    }
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, 140)}px`;
  }

  private updateSendState(): void {
    this.send.disabled = this.busy || !this.input.value.trim();
  }

  private reset(): void {
    if (this.busy) return;
    this.history = [];
    this.asked.clear();
    this.persist();
    this.renderAll();
    this.renderSuggestions();
    this.input.focus();
  }

  // ---------- Persistence (per tab, best effort) ----------

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(-30)));
    } catch {
      /* storage unavailable: fine */
    }
  }

  private restore(): void {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(saved)) {
        this.history = saved.filter(
          (t): t is Turn => (t?.role === 'user' || t?.role === 'assistant') && typeof t.content === 'string',
        );
        this.history.filter((t) => t.role === 'user').forEach((t) => this.asked.add(t.content.toLowerCase()));
      }
    } catch {
      this.history = [];
    }
  }
}
