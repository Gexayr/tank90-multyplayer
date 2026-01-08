import * as PIXI from 'pixi.js';
import { Tank } from '../../types/game';
import { NetworkInterpolation } from '../NetworkInterpolation';

export class TankManager {
  private tanks: Map<string, Tank>;
  private world: PIXI.Container;
  private tankTexture: PIXI.Texture;
  private socketId: string | null = null;

  constructor(world: PIXI.Container) {
    this.tanks = new Map();
    this.world = world;
    this.tankTexture = PIXI.Texture.from('/tank.svg');
  }

  setSocketId(id: string | null) {
    this.socketId = id;
  }

  getTanks() {
    return this.tanks;
  }

  createTank(id: string, x: number, y: number, color: number, health: number, score: number) {
    if (this.tanks.has(id)) return this.tanks.get(id)!;

    const sprite = new PIXI.Sprite(this.tankTexture);
    sprite.anchor.set(0.5);
    sprite.width = 40;
    sprite.height = 40;
    sprite.x = x;
    sprite.y = y;
    sprite.zIndex = 1;
    this.world.addChild(sprite);

    const isLocal = this.socketId && id === this.socketId;

    const healthBar = new PIXI.Graphics();
    this.world.addChild(healthBar);
    healthBar.zIndex = 0;

    const tank: Tank = {
      sprite,
      rotation: 0,
      id,
      health,
      maxHealth: 100,
      healthBar,
      score,
      color,
      interpolation: isLocal ? undefined : new NetworkInterpolation(100),
    };

    this.tanks.set(id, tank);
    this.updateHealthBar(tank);
    this.ensureHighlightState(tank);
    return tank;
  }

  removeTank(id: string) {
    const tank = this.tanks.get(id);
    if (tank) {
      this.world.removeChild(tank.sprite);
      this.world.removeChild(tank.healthBar);
      if (tank.highlight) {
        this.world.removeChild(tank.highlight);
        tank.highlight.destroy();
      }
      this.tanks.delete(id);
    }
  }

  updateHealthBar(tank: Tank) {
    const healthPercentage = tank.health / tank.maxHealth;
    tank.healthBar.clear();
    tank.healthBar.beginFill(0x006600);
    tank.healthBar.drawRect(-20, 30, 40 * healthPercentage, 5);
    tank.healthBar.endFill();

    tank.healthBar.x = tank.sprite.x;
    tank.healthBar.y = tank.sprite.y;
    tank.healthBar.rotation = tank.sprite.rotation;
  }

  ensureHighlightState(tank: Tank) {
    const isLocal = this.socketId && tank.id === this.socketId;
    if (isLocal) {
      if (!tank.highlight) {
        const hl = new PIXI.Graphics();
        hl.lineStyle(0.8, 0xffff00, 0.5);
        hl.drawRoundedRect(-23, -23, 46, 46, 8);
        hl.zIndex = 0.75;
        this.world.addChild(hl);
        tank.highlight = hl;
      }
    } else {
      if (tank.highlight) {
        this.world.removeChild(tank.highlight);
        tank.highlight.destroy();
        delete tank.highlight;
      }
    }
    if (tank.highlight) {
      tank.highlight.x = tank.sprite.x;
      tank.highlight.y = tank.sprite.y;
      tank.highlight.rotation = tank.sprite.rotation;
    }
  }

  updateTankAlpha(tank: Tank, underTree: boolean) {
    const alpha = underTree ? 0.5 : 1.0;
    tank.sprite.alpha = alpha;
    if (tank.highlight) {
        tank.highlight.alpha = alpha;
    }
  }
}
