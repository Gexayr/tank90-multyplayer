// Game Types

export type Direction = 'up' | 'right' | 'down' | 'left' | 'space';

export interface Position {
  x: number;
  y: number;
}

export type TankType = 'player' | 'ai';

export interface Tank {
  id: number;
  type: TankType;
  position: Position;
  direction: Direction;
  speed: number;
  health: number;
  firepower: number;
  fireRate: number;
  lastFired: number;
  shield: boolean;
  color: string;
}

export interface Player {
  id: number;
  name: string;
  lives: number;
  color: string;
}

export type PowerUpType = 'shield' | 'speed' | 'firepower';

export interface Tile {
  type: 'empty' | 'brick' | 'steel' | 'water' | 'forest' | 'ice' | 'spawn';
  position: Position;
}