import type { IncomingMessage } from 'http';
import type { Server } from 'socket.io';

export const NAME_MAX_LENGTH = 16;

/** Trim, drop control characters and cut to NAME_MAX_LENGTH; falls back to `fallback` */
export function sanitizeName(raw: unknown, fallback: string): string {
  const name = typeof raw === 'string'
    ? raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX_LENGTH)
    : '';
  return name || fallback;
}

/** Room codes: 3-12 characters A-Z / 0-9, upper-cased. Returns null if invalid */
export function sanitizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return code.length >= 3 ? code : null;
}

/**
 * Fixed-window rate limiter: returns a function that answers
 * "is this event allowed?" and allows at most `maxPerSecond` per second.
 */
export function createRateLimiter(maxPerSecond: number): () => boolean {
  let windowStart = Date.now();
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      count = 0;
    }
    count++;
    return count <= maxPerSecond;
  };
}

/** Client IP: X-Real-IP from nginx when TRUST_PROXY=1, otherwise the socket address */
export function getClientIp(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === '1') {
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp) return realIp;
  }
  return req.socket.remoteAddress || 'unknown';
}

export function parseAllowedOrigins(): string[] | null {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return null; // not configured: allow any origin (local development)
  return raw.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

/**
 * Engine-level guards shared by all namespaces:
 * - reject foreign Origin headers when ALLOWED_ORIGINS is set
 * - limit simultaneous connections per IP
 */
export function attachConnectionGuards(io: Server, maxConnectionsPerIp: number) {
  const allowedOrigins = parseAllowedOrigins();
  const connectionsPerIp = new Map<string, number>();

  io.engine.on('connection', (rawSocket: { request: IncomingMessage; on: (event: string, cb: () => void) => void }) => {
    const ip = getClientIp(rawSocket.request);
    connectionsPerIp.set(ip, (connectionsPerIp.get(ip) || 0) + 1);
    rawSocket.on('close', () => {
      const left = (connectionsPerIp.get(ip) || 1) - 1;
      if (left <= 0) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, left);
    });
  });

  return (req: IncomingMessage, callback: (err: string | null | undefined, success: boolean) => void) => {
    const origin = req.headers.origin;
    if (allowedOrigins && origin && !allowedOrigins.includes(origin)) {
      callback('origin not allowed', false);
      return;
    }
    if ((connectionsPerIp.get(getClientIp(req)) || 0) >= maxConnectionsPerIp) {
      callback('too many connections', false);
      return;
    }
    callback(null, true);
  };
}
