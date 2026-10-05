import { defineConfig, loadEnv, type Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';

/**
 * Runs the Vercel function in api/chat.ts inside the Vite dev server,
 * so `npm run dev` behaves like production (streaming included).
 */
function vercelApiInDev(): Plugin {
  return {
    name: 'vercel-api-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/chat.ts');
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end();
          }
          const body = req.method === 'POST' ? await readBody(req) : undefined;
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
          }
          const request = new Request(`http://${req.headers.host ?? 'localhost'}/api/chat`, {
            method: req.method,
            headers,
            body,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          if (!response.body) return res.end();
          const reader = response.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (error) {
          server.config.logger.error(String(error));
          res.statusCode = 500;
          res.end('Dev API error');
        }
      });
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default defineConfig(({ mode }) => {
  // Expose ANTHROPIC_* and friends from .env files to the dev API (never to the client bundle).
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL', 'ALLOWED_ORIGINS']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [vercelApiInDev()],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 900,
    },
  };
});
