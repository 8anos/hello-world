# thanos.cv

The personal site of **Thanos Ntakos**: AI search, GEO and growth.

Visitors meet **Thanos, the AI twin**: a 3D orb with blinking eyes that follows the cursor, flies to the corner as you scroll, docks in the chat when you talk to it, and answers questions about Thanos's career and his field. It's funny, and it stays polite.

## What's inside

| | |
|---|---|
| **3D entity** | Three.js orb with a custom shader (noise-displaced, iridescent Aegean-blue/gold rim), eyes that blink and track the cursor, a particle ring, and voice bars that move while it talks. It thinks (spins faster, turns gold), listens (looks at the input) and squints happily after answering. Loaded lazily, so the page is interactive first. |
| **AI twin** | `api/chat.ts` streams answers from the Claude API. The persona and every fact it may use are in `api/_knowledge.ts`. The model can trigger page actions: it can scroll to a section (`[[goto:lab]]`) or snap its fingers (`[[snap]]`). |
| **Offline brain** | With no API key (or if the API is unreachable), the chat switches to hand-written, keyword-matched answers in `src/chat/offline.ts`, so the site always works. |
| **Sections** | The shift · The Lab (AI projects with animated terminals) · Benchmarks (results as an eval chart) · Training log (career as epochs) · Model card (skills, tools, "known limitations") · Handshake. |
| **Extras** | ⌘K / Ctrl+K command palette (it can also ask the AI), and the snap easter egg: type `snap`, or ask the twin about infinity stones. |
| **SEO / GEO** | All content is static HTML. Includes JSON-LD (`Person` + `ProfilePage`), OG/Twitter cards, a sitemap, `robots.txt` that welcomes AI crawlers, and `/llms.txt`. Fonts are self-hosted, with no third-party requests. |

## Run it locally

```bash
npm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY for the live AI twin
npm run dev                    # http://localhost:5173 (the API route runs inside Vite)
```

Without a key, the twin runs on its offline brain, and the chat header says so.

```bash
npm run build     # type-checks site + API, builds to dist/
npm run preview
```

## Deploy (Vercel + thanos.cv)

1. Import the repo in Vercel. It picks up `vercel.json`: Vite build, and `api/chat.ts` as a streaming function.
2. In **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`).
3. In **Settings → Domains**, add `thanos.cv` and `www.thanos.cv`, then point DNS at Vercel as instructed.
4. Recommended: add a Vercel Firewall rate-limit rule on `/api/chat` (for example 20 requests per minute per IP). The function has its own best-effort per-instance limit, but the firewall rule is the real guard against abuse.

### Model & cost

- The default model is `claude-opus-5-5` at low effort. The system prompt is prompt-cached, so a typical answer costs about a cent. Set `ANTHROPIC_MODEL=claude-sonnet-5-5` to roughly halve that.
- Refusal fallbacks are on (`fallbacks: "default"`): if a safety classifier declines mid-answer, another model finishes, and the page discards the partial text.
- Every request is logged with its token usage (`chat ok … cache_read=…`), so you can confirm caching in the Vercel logs.

## Editing content

| What | Where |
|---|---|
| Page copy | `index.html` (plain semantic HTML) |
| What the AI twin knows and how it behaves | `api/_knowledge.ts` |
| Offline answers | `src/chat/offline.ts` |
| AI-crawler summary | `public/llms.txt` |
| Colors and type | CSS variables at the top of `src/styles/main.css` |
| Social image | `public/og.png` (1200×630) |

When facts change, update `index.html`, `api/_knowledge.ts` and `public/llms.txt` together so people, crawlers and the twin all say the same thing.

## Stack

Vite · TypeScript · Three.js · Claude API (`@anthropic-ai/sdk`) · Vercel Functions. No UI framework: the page is static HTML enhanced by small modules in `src/`.
