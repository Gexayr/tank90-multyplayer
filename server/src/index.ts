import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const allowedOriginsEnv = process.env.FRONT_URI || '*';
const allowedOrigins = allowedOriginsEnv.split(',').map(s => s.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST']
    },
    // CRITICAL: Performance settings
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6, // 1MB max message size
    transports: ['websocket', 'polling'], // Prefer WebSocket
});

type PlayerState = {
    id: string;
    x: number;
    y: number;
    rotation: number;
    lastUpdate: number;
    lastMoveReceived: number; // For rate limiting
};

const players: Record<string, PlayerState> = {};

// Configurable tick rate
const BROADCAST_INTERVAL_MS = Number(process.env.BROADCAST_INTERVAL_MS || 100); // 10Hz
const MOVE_RATE_LIMIT_MS = 30; // Accept moves max 33 times/sec per player

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on('player-join', (payload: { id?: string; x?: number; y?: number; rotation?: number }) => {
        const id = payload?.id || socket.id;
        const now = Date.now();
        players[socket.id] = {
            id,
            x: payload?.x ?? 0,
            y: payload?.y ?? 0,
            rotation: payload?.rotation ?? 0,
            lastUpdate: now,
            lastMoveReceived: 0
        };
        socket.join('game');

        // Send initial state to new player
        socket.emit('joined', {
            id,
            serverTime: now,
            players: Object.values(players).map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                rotation: p.rotation
            }))
        });

        // Notify others about new player
        socket.to('game').emit('player-join', {
            id,
            x: players[socket.id].x,
            y: players[socket.id].y,
            rotation: players[socket.id].rotation
        });

        console.log(`player-join ${id} (${socket.id})`);
    });

    socket.on('player-move', (data: { x: number; y: number; rotation: number; direction?: string }) => {
        const state = players[socket.id];
        const now = Date.now();

        if (!state) {
            // Create state if doesn't exist
            players[socket.id] = {
                id: socket.id,
                x: data.x,
                y: data.y,
                rotation: data.rotation,
                lastUpdate: now,
                lastMoveReceived: now
            };
            return;
        }

        // Rate limiting: ignore moves that come too quickly
        if (now - state.lastMoveReceived < MOVE_RATE_LIMIT_MS) {
            return; // Silently drop (client is sending too fast)
        }

        // Basic validation (prevent teleporting)
        const distanceMoved = Math.sqrt(
            Math.pow(data.x - state.x, 2) +
            Math.pow(data.y - state.y, 2)
        );

        const MAX_MOVE_DISTANCE = 100; // pixels per move
        if (distanceMoved > MAX_MOVE_DISTANCE) {
            console.warn(`Player ${socket.id} tried to move ${distanceMoved}px (possible cheat)`);
            // Reject the move, keep old position
            return;
        }

        // Update authoritative state
        state.x = data.x;
        state.y = data.y;
        state.rotation = data.rotation;
        state.lastUpdate = now;
        state.lastMoveReceived = now;
    });

    socket.on('fire', (payload) => {
        const state = players[socket.id];
        if (!state) return;

        // Broadcast to other players only (sender already knows they shot)
        socket.to('game').emit('fire', {
            id: state.id,
            ...payload
        });
    });

    socket.on('disconnect', () => {
        console.log('disconnect', socket.id);
        const disconnectedPlayer = players[socket.id];
        delete players[socket.id];

        if (disconnectedPlayer) {
            io.to('game').emit('player-disconnect', {
                id: disconnectedPlayer.id
            });
        }
    });
});

/**
 * Broadcast game state at fixed tick rate
 * Only send data that has changed since last broadcast
 */
let lastBroadcastState: Record<string, { x: number; y: number; rotation: number }> = {};

setInterval(() => {
    const playersList = Object.values(players);

    if (playersList.length === 0) return; // No players, skip broadcast

    // Only send players that have moved since last broadcast
    const changedPlayers = playersList.filter(p => {
        const last = lastBroadcastState[p.id];
        if (!last) return true; // New player

        // Check if position/rotation changed significantly
        return (
            Math.abs(p.x - last.x) > 0.1 ||
            Math.abs(p.y - last.y) > 0.1 ||
            Math.abs(p.rotation - last.rotation) > 0.01
        );
    });

    if (changedPlayers.length === 0) return; // No changes, skip broadcast

    const snapshot = changedPlayers.map(p => ({
        id: p.id,
        x: Math.round(p.x * 10) / 10, // Round to reduce payload size
        y: Math.round(p.y * 10) / 10,
        rotation: Math.round(p.rotation * 100) / 100,
        lastUpdate: p.lastUpdate
    }));

    // Update last broadcast state
    snapshot.forEach(p => {
        lastBroadcastState[p.id] = { x: p.x, y: p.y, rotation: p.rotation };
    });

    io.to('game').emit('state-update', {
        serverTime: Date.now(),
        players: snapshot
    });
}, BROADCAST_INTERVAL_MS);

// Clean up disconnected players from lastBroadcastState every 30 seconds
setInterval(() => {
    const currentPlayerIds = new Set(Object.values(players).map(p => p.id));
    Object.keys(lastBroadcastState).forEach(id => {
        if (!currentPlayerIds.has(id)) {
            delete lastBroadcastState[id];
        }
    });
}, 30000);

app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) => res.json({
    status: 'ok',
    players: Object.keys(players).length,
    uptime: process.uptime()
}));

const PORT = Number(process.env.PORT || 3000);
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Broadcast interval: ${BROADCAST_INTERVAL_MS}ms`);
    console.log(`Move rate limit: ${MOVE_RATE_LIMIT_MS}ms`);
});