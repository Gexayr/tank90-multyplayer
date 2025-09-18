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
      x: Math.random() * 700 + 50,
      y: Math.random() * 500 + 50,
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
      if (direction) {
        const dirX = Math.sin(rotation);
        const dirY = -Math.cos(rotation);
        if (direction === 'forward') {
          player.x += dirX * speed;
          player.y += dirY * speed;
        } else {
          player.x -= dirX * speed;
          player.y -= dirY * speed;
        }
        // Keep player within bounds
        player.x = Math.max(20, Math.min(player.x, 780));
        player.y = Math.max(20, Math.min(player.y, 580));
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
      if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
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
