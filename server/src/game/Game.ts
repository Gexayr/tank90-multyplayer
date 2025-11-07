import Score from '../models/Score';
import { EventEmitter } from 'events';

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

  constructor() {
    super();
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
    return player;
  }

  removePlayer(id: string) {
    this.players.delete(id);
  }

  movePlayer(id: string, x: number, y: number, rotation: number, direction?: 'forward' | 'backward') {
    const player = this.players.get(id);
    if (player) {
      player.rotation = rotation;
      const speed = 5;

      // If direction provided, compute proposed movement server-side
      if (direction) {
        const dirX = Math.sin(rotation);
        const dirY = -Math.cos(rotation);

        // Save original position
        const originalX = player.x;
        const originalY = player.y;

        // Compute proposed new position
        let proposedX = player.x;
        let proposedY = player.y;
        if (direction === 'forward') {
          proposedX += dirX * speed;
          proposedY += dirY * speed;
        } else {
          proposedX -= dirX * speed;
          proposedY -= dirY * speed;
        }

        // Keep within bounds first
        proposedX = Math.max(20, Math.min(proposedX, this.WORLD_WIDTH - 20));
        proposedY = Math.max(20, Math.min(proposedY, this.WORLD_HEIGHT - 20));

        // Tank-tank collision: prevent overlapping with other players (circle approx, radius 20)
        const minDistance = 40; // two radii
        let collides = false;
        this.players.forEach((other) => {
          if (other.id !== id && !collides) {
            const dx = other.x - proposedX;
            const dy = other.y - proposedY;
            const dist = Math.hypot(dx, dy);
            if (dist < minDistance) {
              collides = true;
            }
          }
        });

        if (!collides) {
          player.x = proposedX;
          player.y = proposedY;
        } else {
          // Reject movement; keep original position
          player.x = originalX;
          player.y = originalY;
        }
      } else {
        // No directional intent: accept provided position (used for rotation-only updates)
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
      speed: 10,
    };
    this.bullets.set(bullet.id, bullet);
    return bullet;
  }

  getGameState() {
    return {
      players: Array.from(this.players.values()),
      bullets: Array.from(this.bullets.values()),
    };
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
      }

      // Check for collisions
      this.players.forEach((player) => {
        if (player.id !== bullet.playerId) {
          const distance = Math.sqrt(Math.pow(player.x - bullet.x, 2) + Math.pow(player.y - bullet.y, 2));
          if (distance < 20) { // 20 is the radius of the tank
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
          }
        }
      });
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
