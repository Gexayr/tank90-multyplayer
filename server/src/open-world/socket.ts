import type { Namespace } from 'socket.io';
import { Game } from './Game';
import { createRateLimiter, sanitizeName } from '../security';

const MAX_PLAYERS = Number(process.env.OPEN_WORLD_MAX_PLAYERS || 64);
// Client sends ~20 inputs/s; anything far above that is dropped
const MAX_INPUTS_PER_SECOND = 60;

export function setupOpenWorld(nsp: Namespace): Game {
  const game = new Game();

  nsp.on('connection', (socket) => {
    if (game.playerCount() >= MAX_PLAYERS) {
      socket.emit('server-full');
      socket.disconnect(true);
      return;
    }

    const player = game.addPlayer(socket.id, sanitizeName(socket.handshake.auth?.name, `Player-${socket.id.slice(0, 4)}`));

    // Send current game state to the new player (includes map objects)
    socket.emit('game-state', game.getGameState());

    // Also send map objects separately for initial load
    socket.emit('map-objects', game.getMapObjects());

    // Notify other players about the new player
    socket.broadcast.emit('player-join', player);

    const inputAllowed = createRateLimiter(MAX_INPUTS_PER_SECOND);
    socket.on('player-input', (input: unknown) => {
      if (!inputAllowed() || typeof input !== 'object' || input === null) return;
      const i = input as Record<string, unknown>;
      if (typeof i.sequenceId !== 'number' || !Number.isFinite(i.sequenceId)) return;
      game.handleInput(socket.id, {
        up: !!i.up,
        down: !!i.down,
        left: !!i.left,
        right: !!i.right,
        shoot: !!i.shoot,
        angle: typeof i.angle === 'number' && Number.isFinite(i.angle) ? i.angle : null,
        sequenceId: i.sequenceId,
      });
    });

    socket.on('disconnect', () => {
      game.removePlayer(socket.id);
      nsp.emit('player-leave', socket.id);
    });
  });

  // Broadcast snapshots to all players
  game.on('tick', (snapshot) => {
    nsp.emit('s', snapshot);
  });

  game.on('player-died', (data) => {
    nsp.emit('player-died', data);
  });

  game.on('player-removed', (playerId) => {
    nsp.emit('player-leave', playerId);
  });

  game.on('map-update', (data) => {
    nsp.emit('map-update', data);
  });

  return game;
}
