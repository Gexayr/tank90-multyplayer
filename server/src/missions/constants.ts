export const GRID_SIZE = 1.0;
export const BOARD_WIDTH = 26;
export const BOARD_HEIGHT = 26;

export const TANK_SPEED = 4.5;
export const BULLET_SPEED = 12.0;
export const ENEMY_SPEED = 2.5;
export const ENEMY_FIRE_INTERVAL = 2.2;
export const ENEMY_MOVE_INTERVAL = 0.8;
export const ENEMY_DIR_CHANGE_INTERVAL = 1.2;
export const TANK_RESPAWN_TIME = 3.0;
export const FIRE_COOLDOWN = 0.35;
export const MAX_BULLETS_PER_PLAYER = 2;
export const TOTAL_ENEMIES_PER_LEVEL = 20;
export const MAX_ACTIVE_ENEMIES = 5;
export const TICK_RATE = 20;

export const MAX_PLAYERS_PER_ROOM = 4;
export const MAX_ROOMS = Number(process.env.MAX_ROOMS || 30);

export const SPAWN_POSITIONS = [
  { x: 2,  z: 2 },
  { x: 13, z: 2 },
  { x: 24, z: 2 },
  { x: 6,  z: 2 },
  { x: 19, z: 2 },
  { x: 9,  z: 2 },
  { x: 16, z: 2 },
];
