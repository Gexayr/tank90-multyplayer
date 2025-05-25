// Game Types

export type Direction = 'up' | 'right' | 'down' | 'left';

export interface Position {
  x: number;
  y: number;
}

// The Tank interface can represent the visual or enemy tanks, 
// while Player represents the controlled player entity.
export interface Tank {
  id: string;
  name?: string; // Name might be optional for enemy tanks
  position: Position;
  direction: Direction;
  color: string; // Tank color might differ from player color
  lives: number;
  hasShield: boolean;
  hasSpeedBoost: boolean;
  hasFirepowerBoost: boolean;
}

// Updated Player interface to include game-specific properties
export interface Player {
  id: string;
  name: string;
  score: number;
  lives: number;
  position: Position; // Player's tank position
  direction: Direction; // Player's tank direction
  color: string; // Player color (for UI representation)
  hasShield: boolean; // Player's active shield bonus
  hasSpeedBoost: boolean; // Player's active speed bonus
  hasFirepowerBoost: boolean; // Player's active firepower bonus
}

export type PowerUpType = 'star' | 'shield' | 'speed' | 'firepower';

export interface PowerUp {
  id: string;
  position: Position;
  type: PowerUpType;
  duration: number; // How long the power-up effect lasts
}

export interface Bullet {
  id: string;
  position: Position;
  direction: Direction;
  ownerId: string; // ID of the player or tank that fired the bullet
  damage: number;
  speed: number;
}

export interface Wall {
  id: string;
  position: Position;
  type: 'brick' | 'steel' | 'water' | 'forest'; // Assuming these are the wall types
  health: number; // Health for destructible walls
  damage: number; // Damage caused by the wall (e.g., water slows)
}