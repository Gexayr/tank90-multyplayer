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
const deadPlayers: Set<string> = new Set();

// Configurable tick rate
const BROADCAST_INTERVAL_MS = Number(process.env.BROADCAST_INTERVAL_MS || 100); // 10Hz
const MOVE_RATE_LIMIT_MS = 30; // Accept moves max 33 times/sec per player

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on('player-join', (payload: { id?: string; x?: number; y?: number; rotation?: number }) => {
        const id = payload?.id || socket.id;
        const now = Date.now();
        // Random spawn within world bounds (match client 800x600), keep margin for tank size
        const WORLD_WIDTH = 800;
        const WORLD_HEIGHT = 600;
        const MARGIN = 20;
        const randX = Math.floor(Math.random() * (WORLD_WIDTH - 2 * MARGIN)) + MARGIN;
        const randY = Math.floor(Math.random() * (WORLD_HEIGHT - 2 * MARGIN)) + MARGIN;

        players[socket.id] = {
            id,
            x: payload?.x ?? randX,
            y: payload?.y ?? randY,
            rotation: payload?.rotation ?? 0,
            lastUpdate: now,
            lastMoveReceived: 0
        };
        socket.join('game');
        deadPlayers.delete(socket.id);

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

    // Allow dead player to restart and respawn
    socket.on('restart', () => {
        const now2 = Date.now();
        const WORLD_WIDTH2 = 800;
        const WORLD_HEIGHT2 = 600;
        const MARGIN2 = 20;
        const randX2 = Math.floor(Math.random() * (WORLD_WIDTH2 - 2 * MARGIN2)) + MARGIN2;
        const randY2 = Math.floor(Math.random() * (WORLD_HEIGHT2 - 2 * MARGIN2)) + MARGIN2;

        const id2 = socket.id; // logical id equals socket
        // Re-add player state
        players[socket.id] = {
            id: id2,
            x: randX2,
            y: randY2,
            rotation: 0,
            lastUpdate: now2,
            lastMoveReceived: 0,
        };
        deadPlayers.delete(socket.id);
        socket.join('game');

        // Send snapshot to restarting player
        socket.emit('joined', {
            id: id2,
            serverTime: now2,
            players: Object.values(players).map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                rotation: p.rotation
            }))
        });

        // Notify others of new spawn
        socket.to('game').emit('player-join', {
            id: id2,
            x: players[socket.id].x,
            y: players[socket.id].y,
            rotation: players[socket.id].rotation,
        });
    });

    // Tank dimensions (AABB) for collision
        const TANK_HALF = 20;

        socket.on('player-move', (data: { x: number; y: number; rotation: number; direction?: string }) => {
        const state = players[socket.id];
        const now = Date.now();

        if (!state) {
            // If player has not joined or is dead, ignore moves
            return;
        }

        // Ignore moves for dead players
        if (deadPlayers.has(socket.id)) {
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

        // Tank-vs-tank collision: reject position if overlapping any other tank
        let newX = data.x;
        let newY = data.y;
        let blocked = false;
        for (const other of Object.values(players)) {
            if (other.id === state.id) continue;
            const overlapX = Math.abs(newX - other.x) < TANK_HALF * 2;
            const overlapY = Math.abs(newY - other.y) < TANK_HALF * 2;
            if (overlapX && overlapY) {
                blocked = true;
                break;
            }
        }

        if (!blocked) {
            state.x = newX;
            state.y = newY;
        }
        // Always allow rotation update
        state.rotation = data.rotation;
        state.lastUpdate = now;
        state.lastMoveReceived = now;
    });

    socket.on('fire', (payload) => {
        const state = players[socket.id];
        if (!state) return;

        // Broadcast to other players only (sender already knows they shot)
        socket.to('game').emit('fire', {
            playerId: state.id,
            id: payload.id,
            x: payload.x,
            y: payload.y,
            direction: payload.direction,
            speed: payload.speed,
        });
    });

    // Relay simple gameplay events across clients
    socket.on('health-update', (data: { id: string; health: number }) => {
        const targetId = data.id;
        // Forward the health update first
        io.to('game').emit('health-update', data);

        // If player died, handle removal and notify
        if (data.health <= 0) {
            // Find socket id for the target player (targetId is logical id, equals socket.id at join)
            const victimEntry = Object.entries(players).find(([sid, p]) => p.id === targetId);
            const victimSocketId = victimEntry ? victimEntry[0] : undefined;

            if (victimSocketId) {
                // Mark dead, remove from players so it's no longer broadcasted
                deadPlayers.add(victimSocketId);
                const victimState = players[victimSocketId];
                delete players[victimSocketId];
                // Remove from last broadcast cache to stop ghosting
                delete lastBroadcastState[targetId];

                // Inform everyone to remove that tank
                io.to('game').emit('player-dead', { id: targetId });

                // Tell the victim client
                io.to(victimSocketId).emit('game-over', { id: targetId });
            }
        }
    });

    socket.on('score-update', (data: { playerId: string; score: number }) => {
        io.to('game').emit('score-update', data);
    });

    socket.on('bullet-remove', (data: { id: string }) => {
        io.to('game').emit('bullet-remove', data.id);
    });

    socket.on('disconnect', () => {
        console.log('disconnect', socket.id);
        const disconnectedPlayer = players[socket.id];
        delete players[socket.id];
        deadPlayers.delete(socket.id);

        if (disconnectedPlayer) {
            const payload = { id: disconnectedPlayer.id };
            // Emit both for backward compatibility
            io.to('game').emit('player-disconnect', payload);
            io.to('game').emit('player-leave', disconnectedPlayer.id);
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

// Simple leaderboard endpoint (in-memory)
// Returns list of connected players with a placeholder score (0)
app.get('/leaderboard', (_req, res) => {
    const leaderboard = Object.values(players)
        .map(p => ({ playerId: p.id, score: 0 }))
        .sort((a, b) => b.score - a.score);
    res.json(leaderboard);
});

const PORT = Number(process.env.PORT || 3000);
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Broadcast interval: ${BROADCAST_INTERVAL_MS}ms`);
    console.log(`Move rate limit: ${MOVE_RATE_LIMIT_MS}ms`);
});