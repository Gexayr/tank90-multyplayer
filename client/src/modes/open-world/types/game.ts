import * as PIXI from 'pixi.js';
import { NetworkInterpolation } from '../game/NetworkInterpolation';

export interface Bullet {
  sprite: PIXI.Graphics;
  id: string;
  playerId: string;
  direction: { x: number; y: number };
  speed: number;
}

export interface Tank {
  sprite: PIXI.Sprite;
  rotation: number;
  id: string;
  health: number;
  maxHealth: number;
  healthBar: PIXI.Graphics;
  score: number;
  color: number;
  highlight?: PIXI.Graphics;
  interpolation?: NetworkInterpolation; // For remote tanks only
}

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  players: any[];
  bullets: any[];
  mapObjects?: any[];
}
