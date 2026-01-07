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
  transports: ['websocket'],
  pingInterval: 2000,
  pingTimeout: 5000
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

  // Handle player input
  socket.on('player-input', (input: any) => {
    game.handleInput(socket.id, input);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    game.removePlayer(socket.id);
    io.emit('player-leave', socket.id);
  });
});

// Broadcast snapshots to all players
game.on('tick', (snapshot) => {
  io.emit('s', snapshot);
});

// Game event handling
game.on('health-update', (data) => {
  io.emit('health-update', data);
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

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 