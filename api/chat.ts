import Anthropic from '@anthropic-ai/sdk';
import { ERROR_LINES, SYSTEM_PROMPT } from './_knowledge';

/**
 * POST /api/chat: streams the AI twin's reply as plain text.
 * GET  /api/chat: tells the page whether the live brain is configured.
 *
 * Body: { messages: [{ role: "user" | "assistant", content: string }, ...] } (last one from the user)
 * Without ANTHROPIC_API_KEY it answers 503 and the page falls back to its offline brain.
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
// Models that accept server-side refusal fallbacks in the "default" form.
const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

const MAX_BODY_CHARS = 40_000;
const MAX_MESSAGES = 16;
const MAX_USER_CHARS = 800;
const MAX_ASSISTANT_CHARS = 3_000;

// Best-effort, per-instance rate limit. For hard limits add a Vercel Firewall rule on /api/chat.
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

type ChatTurn = { role: 'user' | 'assistant'; content: string };

export function GET(): Response {
  return json(200, { live: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
}

export async function POST(request: Request): Promise<Response> {
  if (!originAllowed(request)) return json(403, { error: 'forbidden' });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'offline' });
  if (isRateLimited(clientIp(request))) return json(429, { error: 'rate_limited', message: ERROR_LINES.rateLimited });

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return json(413, { error: 'too_large' });
  const messages = parseMessages(raw);
  if (!messages) return json(400, { error: 'bad_request' });

  const client = new Anthropic();
  const params: Anthropic.Beta.Messages.MessageCreateParamsStreaming = {
    model: MODEL,
    // Thinking counts toward max_tokens; replies themselves are kept short by the prompt.
    max_tokens: 4096,
    stream: true,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  };
  if (!MODEL.startsWith('claude-haiku')) params.output_config = { effort: 'low' };
  if (FALLBACK_MODELS.has(MODEL)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  const stream = client.beta.messages.stream(params);
  const events = stream[Symbol.asyncIterator]();

  // Wait for the first event so auth / rate-limit problems become real HTTP statuses.
  let first: IteratorResult<Anthropic.Beta.Messages.BetaRawMessageStreamEvent>;
  try {
    first = await events.next();
  } catch (error) {
    return upstreamError(error);
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentText = false;
      const send = (text: string) => {
        sentText = true;
        controller.enqueue(encoder.encode(text));
      };
      try {
        for (let next = first; !next.done; next = await events.next()) {
          const event = next.value;
          if (event.type === 'content_block_start' && event.content_block.type === 'fallback') {
            // A safety classifier declined mid-answer and another model took over: drop the partial text.
            controller.enqueue(encoder.encode('[[reset]]'));
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send(event.delta.text);
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('[[reset]]'));
          send(ERROR_LINES.refusal);
        }
        const u = final.usage;
        console.log(
          `chat ok model=${final.model} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} ` +
            `cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens} stop=${final.stop_reason}`,
        );
      } catch (error) {
        console.error('chat stream error', error);
        send((sentText ? '\n\n' : '') + ERROR_LINES.upstream);
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function upstreamError(error: unknown): Response {
  console.error('chat upstream error', error);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return json(503, { error: 'offline' });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return json(429, { error: 'rate_limited', message: ERROR_LINES.rateLimited });
  }
  return json(502, { error: 'upstream', message: ERROR_LINES.upstream });
}

function parseMessages(raw: string): ChatTurn[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const list = (data as { messages?: unknown })?.messages;
  if (!Array.isArray(list) || list.length === 0) return null;

  const turns: ChatTurn[] = [];
  for (const item of list.slice(-MAX_MESSAGES)) {
    const role = (item as ChatTurn)?.role;
    const content = (item as ChatTurn)?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const text = content.trim().slice(0, role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS);
    if (!text) continue;
    // Merge accidental same-role neighbours so roles always alternate.
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content += `\n\n${text}`;
    else turns.push({ role, content: text });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null;
  return turns;
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const ownHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host;
    if (originHost === ownHost) return true;
    const extra = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return extra.includes(origin);
  } catch {
    return false;
  }
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
