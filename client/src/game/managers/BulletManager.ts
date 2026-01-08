import * as PIXI from 'pixi.js';
import { Bullet } from '../../types/game';

export class BulletManager {
  private bullets: Map<string, Bullet>;
  private world: PIXI.Container;

  constructor(world: PIXI.Container) {
    this.bullets = new Map();
    this.world = world;
  }

  getBullets() {
    return this.bullets;
  }

  createBullet(id: string, x: number, y: number, color: number, playerId: string, direction: { x: number; y: number }, speed: number) {
    if (this.bullets.has(id)) return;

    const sprite = new PIXI.Graphics();
    sprite.beginFill(color);
    sprite.drawCircle(0, 0, 4);
    sprite.endFill();
    sprite.x = x;
    sprite.y = y;
    sprite.zIndex = 2;
    this.world.addChild(sprite);

    this.bullets.set(id, {
      sprite,
      id,
      playerId,
      direction,
      speed: speed || 5,
    });
  }

  removeBullet(id: string) {
    const bullet = this.bullets.get(id);
    if (bullet) {
      this.world.removeChild(bullet.sprite);
      this.bullets.delete(id);
    }
  }

  updateBullets() {
    this.bullets.forEach((b) => {
      b.sprite.x += b.direction.x * b.speed;
      b.sprite.y += b.direction.y * b.speed;
    });
  }
}
