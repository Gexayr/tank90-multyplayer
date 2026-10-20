import type { Namespace, Socket } from 'socket.io';
import type { GameState, PlayerInput, NetGameState } from '../../../shared/missions-types';
import { createGameState, addPlayer, removePlayer, startGame, tick } from './engine';
import { TICK_RATE, MAX_PLAYERS_PER_ROOM, MAX_ROOMS } from './constants';
import { createRateLimiter, sanitizeName, sanitizeRoomCode } from '../security';
import { addScore } from '../db';

interface Room {
  id: string;
  state: GameState;
  inputs: Map<string, PlayerInput>;
  fireCooldowns: Map<string, number>;
  interval: NodeJS.Timeout | null;
  lastTick: number;
  scoresSaved: boolean;
}

// Largest simulated step: keeps fast bullets from skipping over a 1-unit wall
const MAX_STEP_SECONDS = 0.05;
// Never simulate more than this after a stall
const MAX_DELTA_SECONDS = 0.2;
const MAX_INPUTS_PER_SECOND = 60;
const MAX_CONTROL_EVENTS_PER_SECOND = 5;

const rooms = new Map<string, Room>();

const defaultInput: PlayerInput = { up: false, down: false, left: false, right: false, fire: false };

// Walls are sent once (`mission-init`) and then as deltas (`walls-removed`), not every tick
function withoutWalls(state: GameState): NetGameState {
  const { walls: _walls, ...rest } = state;
  return rest;
}

function emitFullState(target: { emit: (event: string, ...args: any[]) => boolean }, room: Room) {
  target.emit('mission-init', { walls: room.state.walls });
  target.emit('game-state', withoutWalls(room.state));
}

function playerList(room: Room) {
  return room.state.players.map(p => ({ id: p.id, name: p.name, colorIndex: p.colorIndex }));
}

function destroyRoom(room: Room) {
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = null;
  }
  rooms.delete(room.id);
}

function replaceState(room: Room, state: GameState) {
  room.state = state;
  room.fireCooldowns.clear();
  room.scoresSaved = false;
}

function saveScores(room: Room) {
  if (room.scoresSaved) return;
  room.scoresSaved = true;
  for (const p of room.state.players) {
    addScore(p.name, 'missions', p.score);
  }
}

function startRoomLoop(nsp: Namespace, room: Room) {
  if (room.interval) return;

  room.lastTick = Date.now();
  room.interval = setInterval(() => {
    const now = Date.now();
    const delta = Math.min((now - room.lastTick) / 1000, MAX_DELTA_SECONDS);
    room.lastTick = now;

    if (room.state.phase === 'playing') {
      const wallsBefore = room.state.walls;
      const steps = Math.max(1, Math.ceil(delta / MAX_STEP_SECONDS));
      for (let i = 0; i < steps && room.state.phase === 'playing'; i++) {
        room.state = tick(room.state, room.inputs, delta / steps, room.fireCooldowns).state;
      }

      if (room.state.walls.length !== wallsBefore.length) {
        const remaining = new Set(room.state.walls.map(w => w.id));
        const removed = wallsBefore.filter(w => !remaining.has(w.id)).map(w => w.id);
        nsp.to(room.id).emit('walls-removed', removed);
      }

      if (room.state.phase === 'gameover') saveScores(room);
    }

    nsp.to(room.id).emit('game-state', withoutWalls(room.state));
  }, 1000 / TICK_RATE);
}

export function missionStats() {
  let players = 0;
  rooms.forEach(room => { players += room.state.players.length; });
  return { rooms: rooms.size, players };
}

export function setupMissions(nsp: Namespace) {
  nsp.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;
    const inputAllowed = createRateLimiter(MAX_INPUTS_PER_SECOND);
    const controlAllowed = createRateLimiter(MAX_CONTROL_EVENTS_PER_SECOND);

    function leaveRoom() {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      socket.leave(currentRoomId);
      currentRoomId = null;
      if (!room) return;
      room.inputs.delete(socket.id);
      room.fireCooldowns.delete(socket.id);
      room.state = removePlayer(room.state, socket.id);
      if (room.state.players.length === 0) {
        destroyRoom(room);
        return;
      }
      nsp.to(room.id).emit('game-state', withoutWalls(room.state));
      nsp.to(room.id).emit('player-list', playerList(room));
    }

    socket.on('join-room', (payload: unknown) => {
      if (!controlAllowed()) return;
      const data = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
      const roomId = sanitizeRoomCode(data.roomId);
      if (!roomId) {
        socket.emit('join-error', { reason: 'invalid-room' });
        return;
      }
      const name = sanitizeName(data.name, 'Tank');

      leaveRoom();

      let room = rooms.get(roomId);
      if (!room) {
        if (rooms.size >= MAX_ROOMS) {
          socket.emit('join-error', { reason: 'server-full' });
          return;
        }
        room = {
          id: roomId,
          state: createGameState(1),
          inputs: new Map(),
          fireCooldowns: new Map(),
          interval: null,
          lastTick: Date.now(),
          scoresSaved: false,
        };
        rooms.set(roomId, room);
      } else if (room.state.players.length >= MAX_PLAYERS_PER_ROOM) {
        socket.emit('join-error', { reason: 'room-full' });
        return;
      }

      currentRoomId = roomId;
      socket.join(roomId);
      room.inputs.set(socket.id, { ...defaultInput });

      // Joining a finished game resets it so the room can be reused
      const resetRoom = room.state.phase === 'gameover';
      if (resetRoom) {
        let fresh = createGameState(1);
        for (const p of room.state.players) fresh = addPlayer(fresh, p.socketId, p.name);
        replaceState(room, fresh);
      }

      room.state = addPlayer(room.state, socket.id, name);

      socket.emit('joined', { socketId: socket.id, roomId });
      if (resetRoom) {
        emitFullState(nsp.to(roomId), room);
      } else {
        socket.emit('mission-init', { walls: room.state.walls });
        nsp.to(roomId).emit('game-state', withoutWalls(room.state));
      }
      nsp.to(roomId).emit('player-list', playerList(room));

      startRoomLoop(nsp, room);
    });

    socket.on('start-game', () => {
      if (!controlAllowed() || !currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.state.phase !== 'waiting') return;
      room.state = startGame(room.state);
      nsp.to(currentRoomId).emit('game-state', withoutWalls(room.state));
    });

    socket.on('player-input', (input: unknown) => {
      if (!inputAllowed() || !currentRoomId || typeof input !== 'object' || input === null) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;
      const i = input as Record<string, unknown>;
      room.inputs.set(socket.id, {
        up: !!i.up,
        down: !!i.down,
        left: !!i.left,
        right: !!i.right,
        fire: !!i.fire,
      });
    });

    socket.on('restart-game', () => {
      if (!controlAllowed() || !currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.state.phase !== 'gameover') return;

      // Keep everyone's nickname from the finished game
      const names = new Map(room.state.players.map(p => [p.socketId, p.name]));
      let fresh = createGameState(1);
      for (const sid of room.inputs.keys()) {
        fresh = addPlayer(fresh, sid, names.get(sid) ?? 'Tank');
      }
      replaceState(room, startGame(fresh));
      emitFullState(nsp.to(currentRoomId), room);
    });

    socket.on('leave-room', () => {
      leaveRoom();
    });

    socket.on('disconnect', () => {
      leaveRoom();
    });
  });
}
