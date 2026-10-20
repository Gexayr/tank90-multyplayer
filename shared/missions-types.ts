// Missions mode types shared by server and client
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  z: number;
}

export interface PlayerTank {
  id: string;
  socketId: string;
  name: string;
  position: Position;
  direction: Direction;
  lives: number;
  speed: number;
  score: number;
  hasShield: boolean;
  hasStar: boolean;
  isAlive: boolean;
  respawnTimer: number;
  colorIndex: number;
}

export interface EnemyTank {
  id: string;
  position: Position;
  direction: Direction;
  speed: number;
  fireTimer: number;
  moveTimer: number;
  dirChangeTimer: number;
  isAlive: boolean;
}

export interface Bullet {
  id: string;
  ownerId: string;
  isEnemyBullet: boolean;
  position: Position;
  direction: Direction;
  speed: number;
}

export type WallType = 'brick' | 'metal' | 'base';

export interface Wall {
  id: string;
  position: Position;
  type: WallType;
}

export type PowerUpType = 'star' | 'speed' | 'shield' | 'life';

export interface PowerUp {
  id: string;
  position: Position;
  type: PowerUpType;
}

export type GamePhase = 'waiting' | 'playing' | 'gameover';

export interface GameState {
  phase: GamePhase;
  players: PlayerTank[];
  enemies: EnemyTank[];
  bullets: Bullet[];
  walls: Wall[];
  powerUps: PowerUp[];
  level: number;
  enemiesDefeated: number;
  totalEnemies: number;
  baseDestroyed: boolean;
  winner: string | null;
  countdown: number;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

/** Per-tick state on the wire: walls come separately (`mission-init` + `walls-removed`) */
export type NetGameState = Omit<GameState, 'walls'>;
