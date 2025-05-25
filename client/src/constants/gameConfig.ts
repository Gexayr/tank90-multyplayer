// Game Configuration Constants

// Player settings
export const INITIAL_LIVES = 3;
export const MAX_PLAYERS = 4;

// Game field configuration
export const MAP_SIZE = 500; // 1000x1000 tiles
export const TILE_SIZE = 32; // 32px per tile
export const GRID_SIZE = 5000; // Размер сетки 5000x5000

// Game mechanics
export const TANK_SPEED = 2; // pixels per frame
export const BULLET_SPEED = 5; // pixels per frame
export const TANK_SIZE = TILE_SIZE; // Tank size in pixels
export const BULLET_SIZE = 10; // Bullet size in pixels

// Tank settings
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

// Power-ups
export const POWER_UP_TYPES = {
  STAR: 'star',
  SHIELD: 'shield',
  SPEED: 'speed',
  FIREPOWER: 'firepower'
} as const;

export const POWER_UP_DURATION = 10000; // 10 seconds in milliseconds
export const POWER_UP_COUNT = 10; // Number of power-ups on the map at any time

// Walls
export const WALL_TYPES = {
  BRICK: 'brick',
  STEEL: 'steel',
  WATER: 'water',
  FOREST: 'forest'
} as const;

export const WALL_COUNT = 100; // Number of destructible walls on the map at any time

// Camera
export const CAMERA_THRESHOLD = 0.25; // 25% of viewport
export const CAMERA_SPEED = 0.1; // Camera movement speed

// Minimap
export const MINIMAP_SCALE = 0.1; // 10% of original size

// Scoring
export const SCORE_VALUES = {
  TANK_DESTROYED: 100,
  LEVEL_COMPLETED: 1000
};