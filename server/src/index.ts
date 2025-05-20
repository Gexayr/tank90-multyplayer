import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

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

// Game state
interface Player {
  id: string;
  x: number;
  y: number;
  rotation: number;
  color: number;
  health: number;
}

interface Bullet {
  id: string;
  playerId: string;
  x: number;
  y: number;
  direction: { x: number; y: number };
}

const gameState = {
  players: new Map<string, Player>(),
  bullets: new Map<string, Bullet>(),
  nextPlayerColor: 0xFFFF00, // Start with yellow
  colors: [0xFFFF00, 0x0000FF, 0xFF0000, 0x00FF00, 0xFF00FF, 0x00FFFF] // Available colors
};

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Tank 90 Backend API' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Assign a color to the new player
  const color = gameState.colors[gameState.nextPlayerColor % gameState.colors.length];
  gameState.nextPlayerColor++;

  // Create new player
  const player: Player = {
    id: socket.id,
    x: Math.random() * 700 + 50, // Random position
    y: Math.random() * 500 + 50,
    rotation: 0,
    color,
    health: 100
  };

  // Add player to game state
  gameState.players.set(socket.id, player);

  // Send current game state to the new player
  socket.emit('game-state', {
    players: Array.from(gameState.players.values()),
    bullets: Array.from(gameState.bullets.values())
  });

  // Notify other players about the new player
  socket.broadcast.emit('player-join', player);

  // Handle player movement
  socket.on('player-move', (data: { x: number; y: number; rotation: number }) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      player.rotation = data.rotation;
      socket.broadcast.emit('player-move', {
        id: socket.id,
        x: data.x,
        y: data.y,
        rotation: data.rotation
      });
    }
  });

  // Handle health updates
  socket.on('health-update', (data: { id: string; health: number }) => {
    const player = gameState.players.get(data.id);
    if (player) {
      player.health = data.health;
      socket.broadcast.emit('health-update', {
        id: data.id,
        health: data.health
      });
    }
  });

  // Handle player shooting
  socket.on('player-shoot', (data: { x: number; y: number; direction: { x: number; y: number } }) => {
    const bullet: Bullet = {
      id: `${socket.id}-${Date.now()}`,
      playerId: socket.id,
      x: data.x,
      y: data.y,
      direction: data.direction
    };

    gameState.bullets.set(bullet.id, bullet);
    io.emit('bullet-create', bullet);

    // Remove bullet after 2 seconds
    setTimeout(() => {
      gameState.bullets.delete(bullet.id);
      io.emit('bullet-remove', bullet.id);
    }, 2000);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    gameState.players.delete(socket.id);
    io.emit('player-leave', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 