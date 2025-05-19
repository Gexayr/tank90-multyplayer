// Game Configuration Constants

// Player settings
export const INITIAL_LIVES = 3;
export const MAX_PLAYERS = 4;

// Game board settings
export const GRID_SIZE = 13;
export const TILE_SIZE = 32;

// Tank settings
export const TANK_SPEED = {
  PLAYER: 0.1,
  AI_SLOW: 0.05,
  AI_MEDIUM: 0.075,
  AI_FAST: 0.1
};

export const TANK_HEALTH = {
  PLAYER: 3,
  AI_BASIC: 1,
  AI_ARMOR: 2,
  AI_HEAVY: 3
};

// Projectile settings
export const PROJECTILE_SPEED = 0.2;
export const FIRE_RATE = {
  SLOW: 0.33, // 3 shots per second
  MEDIUM: 0.5, // 2 shots per second
  FAST: 1 // 1 shot per second
};

// Power-up settings
export const POWERUP_DURATION = 10000; // 10 seconds
export const POWERUP_SPAWN_CHANCE = 0.005; // 0.5% chance per update

// Scoring
export const SCORE_VALUES = {
  TANK_DESTROYED: 100,
  LEVEL_COMPLETED: 1000
};