import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import Score from './models/Score';
import dotenv from 'dotenv';
import { Game } from './game/Game';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONT_URI || "http://localhost:5173",
    methods: ["GET", "POST"]
  },
  // Configure Socket.IO to prefer WebSocket but allow polling fallback
  // This ensures connections work even if WebSocket is blocked by proxies/firewalls
  transports: ['websocket', 'polling'], // Allow both, prefer WebSocket
  allowEIO3: true, // Allow Engine.IO v3 clients for compatibility
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  // Connection settings for better reliability
  connectTimeout: 45000, // 45 seconds connection timeout
  maxHttpBufferSize: 1e6, // 1MB max message size
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/tank90';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Tank 90 Backend API' });
});

// Leaderboard route
app.get('/leaderboard', async (req, res) => {
  try {
    const scores = await Score.find().sort({ score: -1 }).limit(10);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

const game = new Game();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const player = game.addPlayer(socket.id);

  // Send current game state to the new player (includes map objects)
  socket.emit('game-state', game.getGameState());
  
  // Also send map objects separately for initial load
  socket.emit('map-objects', game.getMapObjects());

  // Notify other players about the new player
  socket.broadcast.emit('player-join', player);

  // Handle player movement with command ID
  socket.on('player-move', (data: { commandId: number; rotation: number; direction?: 'forward' | 'backward' }) => {
    const result = game.processPlayerCommand(
      socket.id,
      data.commandId,
      data.rotation,
      data.direction
    );

    // If collision occurred, send authoritative state update to the player
    if (result.collided) {
      const stateUpdate = game.getStateUpdate(socket.id, true); // Include authoritative state
      socket.emit('state-update', stateUpdate);
    }

    // REMOVED: Per-command player-move broadcast
    // This was causing excessive network traffic (potentially 60+ broadcasts per second)
    // Remote players now receive updates only through the periodic state-update broadcasts
    // which are throttled to 20-30 Hz and include all players' positions efficiently
  });

  // Handle player shooting
  socket.on('player-shoot', (data: { x: number; y: number; direction: { x: number; y: number } }) => {
    const bullet = game.createBullet(socket.id, data.x, data.y, data.direction);
    io.emit('bullet-create', bullet);
    
    // Shooting is a significant event, send authoritative state update
    const stateUpdate = game.getStateUpdate(socket.id, true);
    socket.emit('state-update', stateUpdate);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    game.removePlayer(socket.id);
    io.emit('player-leave', socket.id);
  });
});

// Game event handling
game.on('bullet-removed', (bulletId) => {
  io.emit('bullet-remove', bulletId);
});

game.on('health-update', (data) => {
  io.emit('health-update', data);
  
  // Send authoritative state update to the affected player (health change is significant event)
  const stateUpdate = game.getStateUpdate(data.id, true);
  io.to(data.id).emit('state-update', stateUpdate);
});

game.on('score-update', (data) => {
  io.emit('score-update', data);
});

game.on('player-removed', (playerId) => {
  io.emit('player-leave', playerId);
});

game.on('map-update', (data) => {
  io.emit('map-update', data);
});

// Periodic state updates with command confirmations
// Send state updates to all players at a controlled rate (20-30 Hz)
// This is the primary mechanism for synchronizing game state to clients
// All players receive the same state update, reducing redundant broadcasts
const STATE_UPDATE_FREQUENCY = 20; // 20 Hz (50ms interval) - balanced between smoothness and network efficiency
let lastStateUpdate = 0;
const stateUpdateInterval = 1000 / STATE_UPDATE_FREQUENCY; // 50ms

setInterval(() => {
  const now = Date.now();
  // Throttle to ensure we don't exceed target frequency
  if (now - lastStateUpdate >= stateUpdateInterval) {
    const gameState = game.getGameState();
    
    // Send a single state update to all players (more efficient than per-player)
    // Each player's state update includes their command confirmation
    gameState.players.forEach((player) => {
      const stateUpdate = game.getStateUpdate(player.id, false); // Don't include full state unless needed
      io.to(player.id).emit('state-update', stateUpdate);
    });
    
    lastStateUpdate = now;
  }
}, 16); // Check every 16ms (60 FPS), but only send at 20 Hz


httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 