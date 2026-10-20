import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { setupOpenWorld } from './open-world/socket';
import { setupMissions, missionStats } from './missions/room';
import { GAME_MODES, GameMode, topScores, closeDb } from './db';
import { attachConnectionGuards } from './security';

dotenv.config();

const PORT = Number(process.env.PORT || 3090);
const HOST = process.env.HOST || '0.0.0.0';
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || '../client/dist');
const MAX_CONNECTIONS_PER_IP = Number(process.env.MAX_CONNECTIONS_PER_IP || 8);

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 'loopback, uniquelocal');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  transports: ['websocket'],
  pingInterval: 10000,
  pingTimeout: 10000,
  maxHttpBufferSize: 4096,
  serveClient: false,
});
io.engine.opts.allowRequest = attachConnectionGuards(io, MAX_CONNECTIONS_PER_IP);

const openWorld = setupOpenWorld(io.of('/open-world'));
setupMissions(io.of('/missions'));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/leaderboard', (req, res) => {
  const mode = (GAME_MODES as string[]).includes(String(req.query.mode))
    ? (req.query.mode as GameMode)
    : 'open-world';
  try {
    res.json(topScores(mode));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

app.get('/api/stats', (_req, res) => {
  res.json({ openWorldPlayers: openWorld.playerCount(), missions: missionStats() });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Built client (production). Only files from the Vite build are served.
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, {
    dotfiles: 'ignore',
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  const indexHtml = path.join(STATIC_DIR, 'index.html');
  // Client-side routes (/, /open-world, /missions/<code>) all get index.html
  app.get('*', (req, res, next) => {
    // Files (anything with an extension) and dotfiles are never answered with index.html
    if (path.extname(req.path) || req.path.split('/').some((part) => part.startsWith('.'))) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

app.use((_req, res) => {
  res.status(404).send('Not found');
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});

function shutdown() {
  io.close();
  httpServer.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
