import { EventEmitter } from 'events';
import { MapObject, MapObjectType, generateMapLayout, circleCollidesWithMapObject, pointInMapObject } from './MapObject';
import { addScore } from '../db';

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  /** Joystick heading in radians (0 = up, clockwise); overrides the direction keys */
  angle: number | null;
  sequenceId: number;
}

const TWO_PI = Math.PI * 2;

/** Heading in radians (0 = up, clockwise) for the input, or null when idle. Keys give 8 directions */
function inputHeading(input: PlayerInput): number | null {
  if (input.angle !== null) return ((input.angle % TWO_PI) + TWO_PI) % TWO_PI;
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (x === 0 && y === 0) return null;
  return (Math.atan2(x, -y) + TWO_PI) % TWO_PI;
}

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  color: number;
  health: number;
  score: number;
  lastInputSequenceId: number;
  alive: boolean;
  respawnAt: number;
}

export interface Bullet {
  id: string;
  playerId: string;
  x: number;
  y: number;
  direction: { x: number; y: number };
  speed: number;
}

export class Game extends EventEmitter {
  private players = new Map<string, Player>();
  private bullets = new Map<string, Bullet>();
  private nextPlayerColor = 0xFFFF00;
  private colors = [0xFFFF00, 0x0000FF, 0xFF0000, 0x00FF00, 0xFF00FF, 0x00FFFF];
  private readonly WORLD_WIDTH = 4000;
  private readonly WORLD_HEIGHT = 4000;
  private readonly TANK_RADIUS = 20;
  private readonly RESPAWN_DELAY_MS = 3000;
  
  private mapObjects = new Map<string, MapObject>();
  
  // Input handling
  private playerInputs = new Map<string, PlayerInput>();
  private playerLastShootTime = new Map<string, number>();
  private currentTick = 0;
  private lastTickTime = Date.now();
  private readonly TICK_RATE = 25; // 25 Hz
  private readonly TICK_DURATION = 1000 / 25;

  // Constants (units per second)
  private readonly TANK_SPEED = 3.5 * 25 * 3.2; // ~140 units/sec
  private readonly BULLET_SPEED = 5 * 25 * 5; // ~312.5 units/sec

  constructor() {
    super();
    // Initialize map objects based on environment variable
    // ADD_MAP_OBJECTS defaults to true if not set (backward compatibility)
    const addMapObjects = process.env.ADD_MAP_OBJECTS !== undefined 
      ? process.env.ADD_MAP_OBJECTS.toLowerCase() === 'true'
      : true;

    const mapLayout = generateMapLayout(addMapObjects);
    mapLayout.forEach(obj => {
      this.mapObjects.set(obj.id, obj);
    });
    
    // Fixed server tick loop
    this.lastTickTime = Date.now();
    setInterval(() => {
      this.tick();
    }, this.TICK_DURATION);
  }

  private tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    this.currentTick++;
    this.respawnDeadPlayers(now);
    this.processInputs(dt);
    this.update(dt);
    this.emit('tick', this.getSnapshot());
  }

  private processInputs(dt: number) {
    this.players.forEach((player, id) => {
      if (!player.alive) return;
      const input = this.playerInputs.get(id);
      if (!input) return;

      // The tank turns to the requested heading and drives that way (any angle)
      const heading = inputHeading(input);
      if (heading !== null) {
        player.rotation = heading;
        const dx = Math.sin(heading) * this.TANK_SPEED * dt;
        const dy = -Math.cos(heading) * this.TANK_SPEED * dt;
        // Slide along obstacles: try the full move, then each axis on its own
        if (!this.tryMove(player, dx, dy) && !this.tryMove(player, dx, 0)) {
          this.tryMove(player, 0, dy);
        }
      }

      // Handle shooting
      if (input.shoot) {
        // Simple rate limiting for shooting (e.g., once every 500ms / 12-13 ticks)
        // track last shoot time per player to enforce server-side
        const now = Date.now();
        const lastShootTime = this.playerLastShootTime.get(id) || 0;
        if (now - lastShootTime >= 500) {
          this.createBullet(id, player.x, player.y, {
            x: Math.sin(player.rotation),
            y: -Math.cos(player.rotation)
          });
          this.playerLastShootTime.set(id, now);
        }
        // Reset shoot input to avoid multiple bullets per single press if not throttled
        input.shoot = false;
      }

      player.lastInputSequenceId = input.sequenceId;
      // Clear input after processing to only process it once unless a new one arrives
      // Actually, we might want to keep movement inputs but clear shoot
      // But requirement says "Server processes only the latest input per player per tick"
      // If client stops sending input, player should stop moving.
      // So we should probably clear or mark as processed.
      // If we clear, and client sends 10 inputs/sec but server ticks at 25Hz, some ticks will have no input.
      // Requirement says "Throttle client input messages to 10–20 per second".
      // So we should probably keep the last state and only update it when new message arrives.
      // For movement, we keep it. For shooting, we must be careful.
    });
  }

  /** Moves the tank by (dx, dy) unless it would hit a tank or a solid map object */
  private tryMove(player: Player, dx: number, dy: number): boolean {
    if (dx === 0 && dy === 0) return false;
    const r = this.TANK_RADIUS;
    const x = Math.max(r, Math.min(player.x + dx, this.WORLD_WIDTH - r));
    const y = Math.max(r, Math.min(player.y + dy, this.WORLD_HEIGHT - r));
    if (x === player.x && y === player.y) return false;

    for (const other of this.players.values()) {
      if (other.id === player.id || !other.alive) continue;
      const dist = Math.hypot(other.x - x, other.y - y);
      // Tanks that already overlap may still drive apart
      if (dist < r * 2 && dist < Math.hypot(other.x - player.x, other.y - player.y)) return false;
    }

    for (const mapObj of this.mapObjects.values()) {
      const solid = mapObj.type === MapObjectType.WATER || mapObj.type === MapObjectType.CONCRETE_WALL ||
        (mapObj.type === MapObjectType.BRICK_WALL && !mapObj.destroyed);
      if (solid && circleCollidesWithMapObject(x, y, r, mapObj)) return false;
    }

    player.x = x;
    player.y = y;
    return true;
  }

  handleInput(playerId: string, input: PlayerInput) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;

    // Sequence ID validation: only accept newer inputs
    if (input.sequenceId <= player.lastInputSequenceId) return;

    this.playerInputs.set(playerId, input);
  }

  private getSnapshot() {
    return {
      t: this.currentTick,
      p: Array.from(this.players.values()).filter(p => p.alive).map(p => ({
        id: p.id,
        x: Math.round(p.x),
        y: Math.round(p.y),
        r: Math.round(p.rotation * 100),
        h: Math.round(p.health),
        s: p.score,
        sid: p.lastInputSequenceId
      })),
      b: Array.from(this.bullets.values()).map(b => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        dx: Math.round(b.direction.x * 100),
        dy: Math.round(b.direction.y * 100),
        sp: Math.round(b.speed)
      }))
    };
  }

  addPlayer(id: string, name: string): Player {
    const color = this.colors[this.players.size % this.colors.length];
    const spawn = this.findSpawnPoint();
    const player: Player = {
      id,
      name,
      x: spawn.x,
      y: spawn.y,
      rotation: 0,
      color,
      health: 100,
      score: 0,
      lastInputSequenceId: 0,
      alive: true,
      respawnAt: 0,
    };
    this.players.set(id, player);
    return player;
  }

  /**
   * Pick a random point that is not inside a blocking map object or another tank
   */
  private findSpawnPoint(): { x: number; y: number } {
    const margin = 60;
    let x = this.WORLD_WIDTH / 2;
    let y = this.WORLD_HEIGHT / 2;
    for (let attempt = 0; attempt < 100; attempt++) {
      x = Math.random() * (this.WORLD_WIDTH - margin * 2) + margin;
      y = Math.random() * (this.WORLD_HEIGHT - margin * 2) + margin;

      let blocked = false;
      for (const mapObj of this.mapObjects.values()) {
        const blocks = mapObj.type === MapObjectType.WATER || mapObj.type === MapObjectType.CONCRETE_WALL || (mapObj.type === MapObjectType.BRICK_WALL && !mapObj.destroyed);
        if (blocks && circleCollidesWithMapObject(x, y, this.TANK_RADIUS + 5, mapObj)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        for (const other of this.players.values()) {
          if (other.alive && Math.hypot(other.x - x, other.y - y) < this.TANK_RADIUS * 3) {
            blocked = true;
            break;
          }
        }
      }
      if (!blocked) break;
    }
    return { x, y };
  }

  private killPlayer(player: Player, killerId: string) {
    player.alive = false;
    player.health = 0;
    player.respawnAt = Date.now() + this.RESPAWN_DELAY_MS;
    this.playerInputs.delete(player.id);
    const killer = this.players.get(killerId);
    this.emit('player-removed', player.id);
    this.emit('player-died', {
      id: player.id,
      killerName: killer ? killer.name : null,
      respawnIn: this.RESPAWN_DELAY_MS,
    });
  }

  private respawnDeadPlayers(now: number) {
    this.players.forEach((player) => {
      if (player.alive || now < player.respawnAt) return;
      const spawn = this.findSpawnPoint();
      player.x = spawn.x;
      player.y = spawn.y;
      player.rotation = 0;
      player.health = 100;
      player.alive = true;
    });
  }

  playerCount(): number {
    return this.players.size;
  }

  removePlayer(id: string) {
    this.players.delete(id);
    this.playerInputs.delete(id);
    this.playerLastShootTime.delete(id);
  }

  createBullet(playerId: string, x: number, y: number, direction: { x: number; y: number }): Bullet {
    const bullet: Bullet = {
      id: `${playerId}-${Date.now()}`,
      playerId,
      x,
      y,
      direction,
      speed: this.BULLET_SPEED,
    };
    this.bullets.set(bullet.id, bullet);
    return bullet;
  }

  getGameState() {
    return {
      players: Array.from(this.players.values()),
      bullets: Array.from(this.bullets.values()),
      mapObjects: Array.from(this.mapObjects.values()),
    };
  }

  getMapObjects(): MapObject[] {
    return Array.from(this.mapObjects.values());
  }

  private update(dt: number) {
    // Update bullets
    const subSteps = 2;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      this.bullets.forEach((bullet, bulletId) => {
        bullet.x += bullet.direction.x * bullet.speed * subDt;
        bullet.y += bullet.direction.y * bullet.speed * subDt;

        // Remove bullets that are out of bounds
        if (bullet.x < 0 || bullet.x > this.WORLD_WIDTH || bullet.y < 0 || bullet.y > this.WORLD_HEIGHT) {
          this.bullets.delete(bulletId);
          this.emit('bullet-removed', bulletId);
          return;
        }

        // Check bullet collision with map objects (except water and trees)
        let bulletHit = false;
        this.mapObjects.forEach((mapObj) => {
          if (!bulletHit && pointInMapObject(bullet.x, bullet.y, mapObj)) {
            // Bullets fly over water (no collision)
            if (mapObj.type === MapObjectType.WATER || mapObj.type === MapObjectType.TREE) {
              return;
            }

            // Bullets hit concrete walls (blocked, no destruction)
            if (mapObj.type === MapObjectType.CONCRETE_WALL) {
              this.bullets.delete(bulletId);
              this.emit('bullet-removed', bulletId);
              bulletHit = true;
              return;
            }

            // Bullets destroy brick walls
            if (mapObj.type === MapObjectType.BRICK_WALL && !mapObj.destroyed) {
              mapObj.destroyed = true;
              this.bullets.delete(bulletId);
              this.emit('bullet-removed', bulletId);
              this.emit('map-update', { objectId: mapObj.id, destroyed: true });
              bulletHit = true;
              return;
            }
          }
        });

        // Check for collisions with players (only if bullet didn't hit a wall)
        if (!bulletHit) {
          this.players.forEach((player) => {
            if (!bulletHit && player.alive && player.id !== bullet.playerId) {
              const distance = Math.sqrt(Math.pow(player.x - bullet.x, 2) + Math.pow(player.y - bullet.y, 2));
              if (distance < this.TANK_RADIUS) {
                this.bullets.delete(bulletId);
                this.emit('bullet-removed', bulletId);
                player.health -= 10;

                if (player.health <= 0) {
                  const killer = this.players.get(bullet.playerId);
                  if (killer) {
                    killer.score += 100;
                    addScore(killer.name, 'open-world', 100);
                  }
                  this.killPlayer(player, bullet.playerId);
                }
                bulletHit = true;
              }
            }
          });
        }
      });
    }

    // Health regeneration: fully recover in ~40 seconds
    // Regen per second: 100 HP / 40s = 2.5 HP per second
    const REGEN_PER_SECOND = 100 / 40;
    this.players.forEach((player) => {
      if (player.alive && player.health < 100) {
        player.health = Math.min(100, player.health + REGEN_PER_SECOND * dt);
      }
    });
  }
}
