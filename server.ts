import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth, type AuthRequest } from './src/server/authMiddleware.ts';
import { fetchServerSideLinkPreview } from './src/server/linkPreviewService.ts';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function getAllowedOrigins(): Set<string> {
  const allowed = new Set<string>([
    'http://localhost:3000',
    'https://localhost',
    'capacitor://localhost',
  ]);
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      // Ignore malformed APP_URL
    }
  }
  return allowed;
}

async function startServer() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.set('trust proxy', 1);

  // Baseline security headers without restricting iframe preview embedding
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Strict origin-allowlist CORS for /api routes (no wildcard on authenticated endpoints)
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
    const isSameHostOrigin =
      Boolean(origin && hostHeader) &&
      (() => {
        try {
          return new URL(origin!).host === String(hostHeader).split(',')[0].trim();
        } catch {
          return false;
        }
      })();

    if (origin && (allowedOrigins.has(origin) || isSameHostOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json({ limit: '64kb' }));

  // Cloud backend health check
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'janax-cloud-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Authenticated WebRTC ICE/TURN server configuration endpoint
  app.get('/api/rtc-config', requireAuth, (_req: AuthRequest, res) => {
    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];

    const turnUrl = process.env.TURN_URL?.trim();
    const turnUsername = process.env.TURN_USERNAME?.trim();
    const turnCredential = process.env.TURN_CREDENTIAL?.trim();

    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    res.json({ iceServers });
  });

  // Authenticated server-side OpenGraph link metadata preview endpoint
  app.post('/api/link-preview', requireAuth, async (req: AuthRequest, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl || rawUrl.length > 2048) {
      res.status(400).json({ error: 'Valid URL is required' });
      return;
    }

    try {
      const preview = await fetchServerSideLinkPreview(rawUrl);
      if (!preview) {
        res.status(422).json({ error: 'Unable to extract preview metadata' });
        return;
      }
      res.json({ preview });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PREVIEW_FAILED';
      const clientErrors = new Set([
        'INVALID_URL',
        'UNSUPPORTED_PROTOCOL',
        'CREDENTIALS_NOT_ALLOWED',
        'PORT_NOT_ALLOWED',
        'DISALLOWED_HOST',
        'DISALLOWED_IP',
        'DISALLOWED_RESOLVED_IP',
      ]);
      if (clientErrors.has(msg)) {
        res.status(400).json({ error: 'Invalid or disallowed URL' });
        return;
      }
      res.status(502).json({ error: 'Failed to fetch link preview' });
    }
  });

  // Ensure unknown API routes always return JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (isProduction && existsSync(distDir)) {
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '7d',
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`JanaX cloud backend listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start JanaX cloud backend:', err);
  process.exit(1);
});
