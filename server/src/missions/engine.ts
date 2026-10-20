import type {
  GameState, GamePhase, PlayerTank, EnemyTank, Bullet, Direction, Position, PlayerInput, Wall
} from '../../../shared/missions-types';
import {
  BOARD_WIDTH, BOARD_HEIGHT, TANK_SPEED, BULLET_SPEED,
  ENEMY_SPEED, ENEMY_FIRE_INTERVAL, ENEMY_MOVE_INTERVAL, ENEMY_DIR_CHANGE_INTERVAL,
  TANK_RESPAWN_TIME, FIRE_COOLDOWN, MAX_BULLETS_PER_PLAYER,
  TOTAL_ENEMIES_PER_LEVEL, MAX_ACTIVE_ENEMIES, SPAWN_POSITIONS, MAX_PLAYERS_PER_ROOM
} from './constants';
import { generateLevel } from './levelData';

let globalBulletId = 0;
let globalEnemyId = 0;

function dirToVec(dir: Direction): { dx: number; dz: number } {
  switch (dir) {
    case 'up':    return { dx: 0, dz: -1 };
    case 'down':  return { dx: 0, dz: 1 };
    case 'left':  return { dx: -1, dz: 0 };
    case 'right': return { dx: 1, dz: 0 };
  }
}

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

function vecToDir(dx: number, dz: number): Direction {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'right' : 'left';
  return dz > 0 ? 'down' : 'up';
}

function wallAt(walls: Wall[], x: number, z: number): Wall | undefined {
  const rx = Math.round(x);
  const rz = Math.round(z);
  return walls.find(w => w.position.x === rx && w.position.z === rz);
}

function collidesWall(walls: Wall[], pos: Position, size = 0.42): boolean {
  const corners = [
    { x: pos.x - size, z: pos.z - size },
    { x: pos.x + size, z: pos.z - size },
    { x: pos.x - size, z: pos.z + size },
    { x: pos.x + size, z: pos.z + size },
  ];
  return corners.some(c => wallAt(walls, c.x, c.z) !== undefined);
}

function oob(x: number, z: number): boolean {
  return x < 1 || x > BOARD_WIDTH - 2 || z < 1 || z > BOARD_HEIGHT - 2;
}

function tanksCollide(ax: number, az: number, bx: number, bz: number): boolean {
  return Math.abs(ax - bx) < 0.85 && Math.abs(az - bz) < 0.85;
}

function bulletHitsTank(bx: number, bz: number, tx: number, tz: number): boolean {
  return Math.abs(bx - tx) < 0.65 && Math.abs(bz - tz) < 0.65;
}

function randomDir(): Direction {
  return DIRS[Math.floor(Math.random() * DIRS.length)];
}

function spawnPlayerPosition(index: number): Position {
  const center = Math.floor(BOARD_WIDTH / 2);
  const positions: Position[] = [
    { x: center - 4, z: BOARD_HEIGHT - 2 },
    { x: center + 4, z: BOARD_HEIGHT - 2 },
    { x: center - 2, z: BOARD_HEIGHT - 2 },
    { x: center + 2, z: BOARD_HEIGHT - 2 },
  ];
  return { ...positions[index % positions.length] };
}

export function createGameState(level = 1): GameState {
  const { walls, powerUps } = generateLevel(level);

  return {
    phase: 'waiting',
    players: [],
    enemies: [],
    bullets: [],
    walls,
    powerUps,
    level,
    enemiesDefeated: 0,
    totalEnemies: TOTAL_ENEMIES_PER_LEVEL,
    baseDestroyed: false,
    winner: null,
    countdown: 3,
  };
}

function spawnEnemyTank(
  level: number,
  existingEnemies: EnemyTank[],
  existingPlayers: PlayerTank[]
): EnemyTank {
  // Shuffle spawn positions and pick the first one not occupied by another tank
  const shuffled = [...SPAWN_POSITIONS].sort(() => Math.random() - 0.5);
  let chosenPos = shuffled[0];

  for (const sp of shuffled) {
    const occupied =
      existingEnemies.some(e => e.isAlive && tanksCollide(sp.x, sp.z, e.position.x, e.position.z)) ||
      existingPlayers.some(p => p.isAlive && tanksCollide(sp.x, sp.z, p.position.x, p.position.z));
    if (!occupied) {
      chosenPos = sp;
      break;
    }
  }

  return {
    id: `enemy-${globalEnemyId++}`,
    position: { x: chosenPos.x, z: chosenPos.z },
    direction: 'down',
    speed: ENEMY_SPEED + level * 0.15,
    fireTimer: 0.5 + Math.random() * ENEMY_FIRE_INTERVAL,
    moveTimer: 0.1 + Math.random() * ENEMY_MOVE_INTERVAL,
    dirChangeTimer: 0.5 + Math.random() * ENEMY_DIR_CHANGE_INTERVAL,
    isAlive: true,
  };
}

// First slot (color + spawn point) not taken by a player already in the room
function freeSlot(players: PlayerTank[]): number {
  for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
    if (!players.some(p => p.colorIndex === i)) return i;
  }
  return players.length % MAX_PLAYERS_PER_ROOM;
}

export function addPlayer(state: GameState, socketId: string, name: string): GameState {
  const slot = freeSlot(state.players);
  const player: PlayerTank = {
    id: socketId,
    socketId,
    name: name || 'Tank',
    position: spawnPlayerPosition(slot),
    direction: 'up',
    lives: 3,
    speed: TANK_SPEED,
    score: 0,
    hasShield: true,
    hasStar: false,
    isAlive: true,
    respawnTimer: 0,
    colorIndex: slot,
  };
  return { ...state, players: [...state.players, player] };
}

export function removePlayer(state: GameState, socketId: string): GameState {
  return { ...state, players: state.players.filter(p => p.socketId !== socketId) };
}

export function startGame(state: GameState): GameState {
  const initialEnemyCount = Math.min(MAX_ACTIVE_ENEMIES, 4);
  const enemies: EnemyTank[] = [];
  for (let i = 0; i < initialEnemyCount; i++) {
    enemies.push(spawnEnemyTank(state.level, enemies, state.players));
  }
  return { ...state, phase: 'playing', enemies, countdown: 0 };
}

/**
 * Advance the game by `delta` seconds.
 * `fireCooldowns` belongs to the room (per-player seconds until the next shot).
 */
export function tick(
  state: GameState,
  inputs: Map<string, PlayerInput>,
  delta: number,
  fireCooldowns: Map<string, number>
): { state: GameState; newBullets: Bullet[] } {
  if (state.phase !== 'playing') return { state, newBullets: [] };

  let walls = [...state.walls];
  let players = state.players.map(p => ({ ...p }));
  let enemies = state.enemies.map(e => ({ ...e }));
  let bullets = state.bullets.map(b => ({ ...b, position: { ...b.position } }));
  let powerUps = [...state.powerUps];
  let enemiesDefeated = state.enemiesDefeated;
  const newBullets: Bullet[] = [];

  // ── Update player fire cooldowns ──
  fireCooldowns.forEach((cd, id) => {
    if (cd > 0) fireCooldowns.set(id, cd - delta);
  });

  // ── Move players ──
  for (let i = 0; i < players.length; i++) {
    const p = players[i];

    if (!p.isAlive) {
      p.respawnTimer -= delta;
      if (p.respawnTimer <= 0 && p.lives > 0) {
        p.position = spawnPlayerPosition(p.colorIndex);
        p.direction = 'up';
        p.isAlive = true;
        p.hasShield = true;
      }
      continue;
    }

    const input = inputs.get(p.socketId) ?? { up: false, down: false, left: false, right: false, fire: false };

    let moved = false;
    let newDir = p.direction;
    if (input.up)    { newDir = 'up';    moved = true; }
    if (input.down)  { newDir = 'down';  moved = true; }
    if (input.left)  { newDir = 'left';  moved = true; }
    if (input.right) { newDir = 'right'; moved = true; }

    if (moved) {
      p.direction = newDir;
      const { dx, dz } = dirToVec(newDir);
      const nx = p.position.x + dx * p.speed * delta;
      const nz = p.position.z + dz * p.speed * delta;

      if (!oob(nx, nz) && !collidesWall(walls, { x: nx, z: nz })) {
        let blocked = false;
        for (const other of players) {
          if (other.id !== p.id && other.isAlive && tanksCollide(nx, nz, other.position.x, other.position.z)) {
            blocked = true; break;
          }
        }
        for (const e of enemies) {
          if (e.isAlive && tanksCollide(nx, nz, e.position.x, e.position.z)) {
            blocked = true; break;
          }
        }
        if (!blocked) { p.position.x = nx; p.position.z = nz; }
      }
    }

    // Fire
    if (input.fire) {
      const cd = fireCooldowns.get(p.id) ?? 0;
      if (cd <= 0) {
        const playerBullets = bullets.filter(b => b.ownerId === p.id);
        if (playerBullets.length < MAX_BULLETS_PER_PLAYER) {
          const { dx, dz } = dirToVec(p.direction);
          const b: Bullet = {
            id: `b-${globalBulletId++}`,
            ownerId: p.id,
            isEnemyBullet: false,
            position: { x: p.position.x + dx * 0.6, z: p.position.z + dz * 0.6 },
            direction: p.direction,
            speed: BULLET_SPEED * (p.hasStar ? 1.4 : 1),
          };
          bullets.push(b);
          newBullets.push(b);
          fireCooldowns.set(p.id, FIRE_COOLDOWN);
        }
      }
    }
  }

  // ── Update enemies ──
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.isAlive) continue;

    // Direction change timer (periodic repick toward base or random)
    e.dirChangeTimer -= delta;
    if (e.dirChangeTimer <= 0) {
      const baseTile = walls.find(w => w.type === 'base');
      if (baseTile && Math.random() < 0.5) {
        const dx = baseTile.position.x - e.position.x;
        const dz = baseTile.position.z - e.position.z;
        e.direction = vecToDir(dx, dz);
      } else {
        e.direction = randomDir();
      }
      e.dirChangeTimer = ENEMY_DIR_CHANGE_INTERVAL * (0.5 + Math.random());
    }

    // Try to move in current direction; if blocked, scan all 4 dirs for a free one
    const tryMove = (dir: Direction): boolean => {
      const { dx, dz } = dirToVec(dir);
      const nx = e.position.x + dx * e.speed * delta;
      const nz = e.position.z + dz * e.speed * delta;
      if (oob(nx, nz) || collidesWall(walls, { x: nx, z: nz })) return false;
      for (const other of enemies) {
        if (other.id !== e.id && other.isAlive && tanksCollide(nx, nz, other.position.x, other.position.z)) return false;
      }
      for (const p of players) {
        if (p.isAlive && tanksCollide(nx, nz, p.position.x, p.position.z)) return false;
      }
      e.position.x = nx;
      e.position.z = nz;
      return true;
    };

    if (!tryMove(e.direction)) {
      // Shuffle all 4 directions and try each one
      const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
      let moved = false;
      for (const dir of shuffled) {
        if (dir !== e.direction) {
          if (tryMove(dir)) {
            e.direction = dir;
            e.dirChangeTimer = ENEMY_DIR_CHANGE_INTERVAL * (0.3 + Math.random() * 0.7);
            moved = true;
            break;
          }
        }
      }
      // If totally surrounded, just update facing so the tank doesn't freeze visually
      if (!moved) {
        e.direction = shuffled[0];
        e.dirChangeTimer = 0.15;
      }
    }

    // Fire
    e.fireTimer -= delta;
    if (e.fireTimer <= 0) {
      e.fireTimer = ENEMY_FIRE_INTERVAL * (0.6 + Math.random() * 0.8);
      const { dx, dz } = dirToVec(e.direction);
      const b: Bullet = {
        id: `b-${globalBulletId++}`,
        ownerId: e.id,
        isEnemyBullet: true,
        position: { x: e.position.x + dx * 0.6, z: e.position.z + dz * 0.6 },
        direction: e.direction,
        speed: BULLET_SPEED * 0.85,
      };
      bullets.push(b);
      newBullets.push(b);
    }
  }

  // ── Move bullets ──
  const bulletsToRemove = new Set<string>();

  for (const b of bullets) {
    const { dx, dz } = dirToVec(b.direction);
    b.position.x += dx * b.speed * delta;
    b.position.z += dz * b.speed * delta;

    // OOB
    if (b.position.x < 0.5 || b.position.x > BOARD_WIDTH - 1.5 || b.position.z < 0.5 || b.position.z > BOARD_HEIGHT - 1.5) {
      bulletsToRemove.add(b.id);
      continue;
    }

    // Hit wall
    const hitWall = wallAt(walls, b.position.x, b.position.z);
    if (hitWall) {
      if (hitWall.type === 'brick') {
        walls = walls.filter(w => w.id !== hitWall.id);
      } else if (hitWall.type === 'base') {
        walls = walls.filter(w => w.id !== hitWall.id);
        // base destroyed will be detected below
      }
      bulletsToRemove.add(b.id);
      continue;
    }

    // Enemy bullet hits player
    if (b.isEnemyBullet) {
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.isAlive) continue;
        if (bulletHitsTank(b.position.x, b.position.z, p.position.x, p.position.z)) {
          bulletsToRemove.add(b.id);
          if (p.hasShield) {
            players[i] = { ...p, hasShield: false };
          } else {
            players[i] = { ...p, isAlive: false, lives: p.lives - 1, respawnTimer: TANK_RESPAWN_TIME, hasStar: false };
          }
          break;
        }
      }
    } else {
      // Player bullet hits enemy
      let hitEnemy = false;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.isAlive) continue;
        if (bulletHitsTank(b.position.x, b.position.z, e.position.x, e.position.z)) {
          bulletsToRemove.add(b.id);
          enemies[i] = { ...e, isAlive: false };
          enemiesDefeated++;
          // Award score
          const shooterIdx = players.findIndex(p => p.id === b.ownerId);
          if (shooterIdx !== -1) {
            players[shooterIdx] = { ...players[shooterIdx], score: players[shooterIdx].score + 100 };
          }
          hitEnemy = true;
          break;
        }
      }
      // Player bullet hits other player (friendly fire off — just remove bullet)
      if (!hitEnemy) {
        for (const p of players) {
          if (p.id !== b.ownerId && p.isAlive && bulletHitsTank(b.position.x, b.position.z, p.position.x, p.position.z)) {
            bulletsToRemove.add(b.id);
            break;
          }
        }
      }
    }
  }

  bullets = bullets.filter(b => !bulletsToRemove.has(b.id));

  // ── Power-up collection ──
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p.isAlive) continue;
    for (let j = powerUps.length - 1; j >= 0; j--) {
      const pu = powerUps[j];
      if (Math.abs(p.position.x - pu.position.x) < 0.8 && Math.abs(p.position.z - pu.position.z) < 0.8) {
        powerUps.splice(j, 1);
        if (pu.type === 'star')   players[i] = { ...players[i], hasStar: true };
        if (pu.type === 'speed')  players[i] = { ...players[i], speed: TANK_SPEED * 1.6 };
        if (pu.type === 'shield') players[i] = { ...players[i], hasShield: true };
        if (pu.type === 'life')   players[i] = { ...players[i], lives: players[i].lives + 1 };
      }
    }
  }

  // ── Spawn new enemies ──
  const activeEnemies = enemies.filter(e => e.isAlive);
  const remainingToSpawn = TOTAL_ENEMIES_PER_LEVEL - enemiesDefeated - activeEnemies.length;
  if (activeEnemies.length < MAX_ACTIVE_ENEMIES && remainingToSpawn > 0) {
    enemies.push(spawnEnemyTank(state.level, activeEnemies, players));
  }

  // ── Check win/loss ──
  const baseDestroyed = !walls.some(w => w.type === 'base');
  let phase: GamePhase = state.phase;
  let winner: string | null = state.winner;

  if (baseDestroyed && !state.baseDestroyed) {
    phase = 'gameover';
    const best = [...players].sort((a, b) => b.score - a.score)[0];
    winner = best ? best.name : null;
  }

  if (players.length > 0 && players.every(p => p.lives <= 0 && !p.isAlive)) {
    phase = 'gameover';
    const best = [...players].sort((a, b) => b.score - a.score)[0];
    winner = best && best.score > 0 ? best.name : null;
  }

  if (enemiesDefeated >= TOTAL_ENEMIES_PER_LEVEL && activeEnemies.length === 0) {
    phase = 'gameover';
    const best = [...players].sort((a, b) => b.score - a.score)[0];
    winner = best ? best.name : 'Players';
  }

  return {
    state: {
      ...state,
      phase,
      players,
      enemies,
      bullets,
      walls,
      powerUps,
      enemiesDefeated,
      baseDestroyed,
      winner,
    },
    newBullets,
  };
}
