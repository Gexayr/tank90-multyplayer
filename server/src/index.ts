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
  }
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

  // Send current game state to the new player
  socket.emit('game-state', game.getGameState());

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

    // Broadcast movement to other players (without command confirmation)
    const player = game.getGameState().players.find(p => p.id === socket.id);
    if (player) {
      socket.broadcast.emit('player-move', {
        id: socket.id,
        x: player.x,
        y: player.y,
        rotation: player.rotation
      });
    }
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

// Periodic state updates with command confirmations
// Send state updates to all players at regular intervals
setInterval(() => {
  const gameState = game.getGameState();
  gameState.players.forEach((player) => {
    const stateUpdate = game.getStateUpdate(player.id, false); // Don't include full state unless needed
    io.to(player.id).emit('state-update', stateUpdate);
  });
}, 1000 / 20); // 20 updates per second (50ms interval)


httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 