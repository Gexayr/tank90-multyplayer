import Score from '../models/Score';
import { EventEmitter } from 'events';
import { MapObject, MapObjectType, generateMapLayout, circleCollidesWithMapObject, pointInMapObject } from './MapObject';
import dotenv from 'dotenv';

dotenv.config();

export interface Player {
  id: string;
  x: number;
  y: number;
  rotation: number;
  color: number;
  health: number;
  score: number;
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
  
  // Map objects
  private mapObjects = new Map<string, MapObject>();
  
  // Command tracking for client-side prediction
  private playerCommandIds = new Map<string, number>(); // Latest confirmed command ID per player
  private playerPendingCommands = new Map<string, Array<{
    commandId: number;
    rotation: number;
    direction?: 'forward' | 'backward';
    timestamp: number;
  }>>(); // Pending commands queue per player

  constructor() {
    super();
    // Initialize map objects based on environment variable
    // ADD_MAP_OBJECTS defaults to true if not set (backward compatibility)
    const addMapObjects = process.env.ADD_MAP_OBJECTS !== undefined 
      ? process.env.ADD_MAP_OBJECTS.toLowerCase() === 'true'
      : true;

      console.log("process.env.ADD_MAP_OBJECTS")
      console.log(process.env.ADD_MAP_OBJECTS)
      console.log(addMapObjects)

    const mapLayout = generateMapLayout(addMapObjects);
    mapLayout.forEach(obj => {
      this.mapObjects.set(obj.id, obj);
    });
    
    // Game loop
    setInterval(() => {
      this.update();
    }, 1000 / 60); // 60 FPS
  }

  addPlayer(id: string): Player {
    const color = this.colors[this.players.size % this.colors.length];
    const player: Player = {
      id,
      x: Math.random() * (this.WORLD_WIDTH - 100) + 50,
      y: Math.random() * (this.WORLD_HEIGHT - 100) + 50,
      rotation: 0,
      color,
      health: 100,
      score: 0,
    };
    this.players.set(id, player);
    this.playerCommandIds.set(id, 0);
    this.playerPendingCommands.set(id, []);
    return player;
  }

  removePlayer(id: string) {
    this.players.delete(id);
    this.playerCommandIds.delete(id);
    this.playerPendingCommands.delete(id);
  }

  /**
   * Process player movement command with command ID
   * Commands are processed sequentially to maintain authoritative state
   */
  processPlayerCommand(
    id: string,
    commandId: number,
    rotation: number,
    direction?: 'forward' | 'backward'
  ): { success: boolean; collided: boolean } {
    const player = this.players.get(id);
    if (!player) {
      return { success: false, collided: false };
    }

    // Get pending commands queue
    const pendingCommands = this.playerPendingCommands.get(id) || [];
    const latestConfirmedId = this.playerCommandIds.get(id) || 0;

    // Ignore commands that are older than the latest confirmed (out of order)
    if (commandId <= latestConfirmedId) {
      return { success: false, collided: false };
    }

    // Add to pending queue if not already there
    const existingIndex = pendingCommands.findIndex(cmd => cmd.commandId === commandId);
    if (existingIndex === -1) {
      pendingCommands.push({
        commandId,
        rotation,
        direction,
        timestamp: Date.now(),
      });
      // Sort by command ID to process in order
      pendingCommands.sort((a, b) => a.commandId - b.commandId);
    }

    // Process commands sequentially
    let collided = false;
    while (pendingCommands.length > 0) {
      const nextCommand = pendingCommands[0];
      
      // Only process if this is the next expected command
      if (nextCommand.commandId !== latestConfirmedId + 1) {
        break;
      }

      // Apply the command
      player.rotation = nextCommand.rotation;
      const speed = 3.5; // Reduced from 5 (30% reduction for better control)
      let moved = false;

      if (nextCommand.direction) {
        const dirX = Math.sin(player.rotation);
        const dirY = -Math.cos(player.rotation);

        // Save original position
        const originalX = player.x;
        const originalY = player.y;

        // Compute proposed new position
        let proposedX = player.x;
        let proposedY = player.y;
        if (nextCommand.direction === 'forward') {
          proposedX += dirX * speed;
          proposedY += dirY * speed;
        } else {
          proposedX -= dirX * speed;
          proposedY -= dirY * speed;
        }

        // Keep within bounds
        proposedX = Math.max(20, Math.min(proposedX, this.WORLD_WIDTH - 20));
        proposedY = Math.max(20, Math.min(proposedY, this.WORLD_HEIGHT - 20));

        // Tank-tank collision check
        const minDistance = 40;
        let hasCollision = false;
        this.players.forEach((other) => {
          if (other.id !== id && !hasCollision) {
            const dx = other.x - proposedX;
            const dy = other.y - proposedY;
            const dist = Math.hypot(dx, dy);
            if (dist < minDistance) {
              hasCollision = true;
            }
          }
        });

        // Map object collision check
        if (!hasCollision) {
          this.mapObjects.forEach((mapObj) => {
            if (!hasCollision && circleCollidesWithMapObject(proposedX, proposedY, this.TANK_RADIUS, mapObj)) {
              // Water and concrete walls block movement
              if (mapObj.type === MapObjectType.WATER || mapObj.type === MapObjectType.CONCRETE_WALL) {
                hasCollision = true;
              }
              // Brick walls block movement (if not destroyed)
              if (mapObj.type === MapObjectType.BRICK_WALL && !mapObj.destroyed) {
                hasCollision = true;
              }
              // Trees don't block movement (only visual)
            }
          });
        }

        if (!hasCollision) {
          player.x = proposedX;
          player.y = proposedY;
          moved = true;
        } else {
          // Collision occurred - keep original position
          player.x = originalX;
          player.y = originalY;
          collided = true;
        }
      } else {
        // Rotation only, no movement
        moved = true;
      }

      // Mark command as confirmed
      this.playerCommandIds.set(id, nextCommand.commandId);
      pendingCommands.shift();

      // If collision occurred, stop processing further commands
      if (collided) {
        break;
      }
    }

    return { success: true, collided };
  }

  /**
   * Legacy method for backward compatibility (deprecated)
   */
  movePlayer(id: string, x: number, y: number, rotation: number, direction?: 'forward' | 'backward') {
    const player = this.players.get(id);
    if (player) {
      player.rotation = rotation;
      if (direction) {
        const speed = 3.5; // Reduced from 5 (30% reduction for better control)
        const dirX = Math.sin(rotation);
        const dirY = -Math.cos(rotation);
        let proposedX = player.x;
        let proposedY = player.y;
        if (direction === 'forward') {
          proposedX += dirX * speed;
          proposedY += dirY * speed;
        } else {
          proposedX -= dirX * speed;
          proposedY -= dirY * speed;
        }
        proposedX = Math.max(20, Math.min(proposedX, this.WORLD_WIDTH - 20));
        proposedY = Math.max(20, Math.min(proposedY, this.WORLD_HEIGHT - 20));
        player.x = proposedX;
        player.y = proposedY;
      } else {
        player.x = x;
        player.y = y;
      }
    }
  }

  createBullet(playerId: string, x: number, y: number, direction: { x: number; y: number }): Bullet {
    const bullet: Bullet = {
      id: `${playerId}-${Date.now()}`,
      playerId,
      x,
      y,
      direction,
      speed: 5, // Reduced from 10 (50% reduction for more visible bullet travel)
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

  /**
   * Get game state update with command confirmation for a specific player
   * @param playerId The player ID to get confirmation for
   * @param includeAuthoritativeState Whether to include full position (for collisions/events)
   */
  getStateUpdate(playerId: string, includeAuthoritativeState: boolean = false) {
    const latestConfirmedCommandId = this.playerCommandIds.get(playerId) || 0;
    const player = this.players.get(playerId);
    
    const state: any = {
      players: Array.from(this.players.values()),
      bullets: Array.from(this.bullets.values()),
      mapObjects: Array.from(this.mapObjects.values()),
      latestConfirmedCommandId,
    };

    // Include authoritative state if requested (collisions, events, etc.)
    if (includeAuthoritativeState && player) {
      state.authoritativeState = {
        x: player.x,
        y: player.y,
        rotation: player.rotation,
      };
    }

    return state;
  }

  /**
   * Get latest confirmed command ID for a player
   */
  getLatestConfirmedCommandId(playerId: string): number {
    return this.playerCommandIds.get(playerId) || 0;
  }

  private update() {
    // Update bullets
    this.bullets.forEach((bullet, bulletId) => {
      bullet.x += bullet.direction.x * bullet.speed;
      bullet.y += bullet.direction.y * bullet.speed;

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
          if (player.id !== bullet.playerId) {
            const distance = Math.sqrt(Math.pow(player.x - bullet.x, 2) + Math.pow(player.y - bullet.y, 2));
            if (distance < this.TANK_RADIUS) {
              this.bullets.delete(bulletId);
              this.emit('bullet-removed', bulletId);
              player.health -= 10;
              this.emit('health-update', { id: player.id, health: player.health });

              if (player.health <= 0) {
                const killer = this.players.get(bullet.playerId);
                if (killer) {
                  killer.score += 100;
                  this.saveScore(killer.id, killer.score);
                  this.emit('score-update', { playerId: killer.id, score: killer.score });
                }
                this.removePlayer(player.id);
                this.emit('player-removed', player.id);
              }
              bulletHit = true;
            }
          }
        });
      }
    });

    // Health regeneration: fully recover in ~40 seconds
    // Regen per tick (60 FPS): 100 HP / (40s * 60fps) = 0.041666... HP per tick
    const REGEN_PER_TICK = 100 / (40 * 60);
    this.players.forEach((player) => {
      if (player.health > 0 && player.health < 100) {
        const before = player.health;
        player.health = Math.min(100, player.health + REGEN_PER_TICK);
        // Emit only when integer value changes to reduce network traffic
        if (Math.floor(player.health) !== Math.floor(before) || player.health === 100) {
          this.emit('health-update', { id: player.id, health: Math.round(player.health) });
        }
      }
    });
  }

  private async saveScore(playerId: string, score: number) {
    try {
      // We can use updateOne with upsert to create or update the score
      await Score.updateOne({ playerId }, { score }, { upsert: true });
    } catch (error) {
      console.error('Error saving score:', error);
    }
  }
}
