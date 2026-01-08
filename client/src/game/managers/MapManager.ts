import * as PIXI from 'pixi.js';

export class MapManager {
  private mapObjects: Map<string, PIXI.Graphics>;
  private world: PIXI.Container;

  constructor(world: PIXI.Container) {
    this.mapObjects = new Map();
    this.world = world;
  }

  getMapObjects() {
    return this.mapObjects;
  }

  createMapObject(obj: any) {
    if (this.mapObjects.has(obj.id)) {
      return;
    }

    const sprite = new PIXI.Graphics();
    sprite.x = obj.x;
    sprite.y = obj.y;
    sprite.zIndex = -5;

    switch (obj.type) {
      case 'brick_wall':
        if (!obj.destroyed) {
          sprite.beginFill(0x8B4513);
          sprite.drawRect(0, 0, obj.width, obj.height);
          sprite.endFill();
          sprite.lineStyle(1, 0x654321, 0.5);
          sprite.moveTo(obj.width / 2, 0);
          sprite.lineTo(obj.width / 2, obj.height);
          sprite.moveTo(0, obj.height / 2);
          sprite.lineTo(obj.width, obj.height / 2);
          sprite.lineStyle(0);
        }
        break;

      case 'concrete_wall':
        sprite.beginFill(0x808080);
        sprite.drawRect(0, 0, obj.width, obj.height);
        sprite.endFill();
        sprite.lineStyle(1, 0x606060, 0.3);
        for (let i = 0; i < 4; i++) {
          sprite.moveTo((i * obj.width) / 4, 0);
          sprite.lineTo((i * obj.width) / 4, obj.height);
        }
        sprite.lineStyle(0);
        break;

      case 'water':
        sprite.beginFill(0x4169E1);
        sprite.drawRect(0, 0, obj.width, obj.height);
        sprite.endFill();
        sprite.lineStyle(1, 0x1E90FF, 0.4);
        for (let i = 0; i < 3; i++) {
          const waveY = (obj.height / 3) * (i + 1);
          sprite.moveTo(0, waveY);
          for (let x = 0; x <= obj.width; x += 5) {
            const waveOffset = Math.sin((x / obj.width) * Math.PI * 2) * 2;
            sprite.lineTo(x, waveY + waveOffset);
          }
        }
        sprite.lineStyle(0);
        break;

      case 'tree':
        sprite.beginFill(0x228B22);
        sprite.drawCircle(obj.width / 2, obj.height / 2, obj.width / 2 - 2);
        sprite.endFill();
        sprite.beginFill(0x8B4513);
        sprite.drawRect(obj.width / 2 - 4, obj.height / 2, 8, obj.height / 2);
        sprite.endFill();
        sprite.zIndex = 0.5;
        break;
    }

    if (obj.type === 'brick_wall' && obj.destroyed) {
      return;
    }

    this.world.addChild(sprite);
    this.mapObjects.set(obj.id, sprite);
  }

  updateMapObject(objId: string, destroyed: boolean) {
    const sprite = this.mapObjects.get(objId);
    if (sprite) {
      if (destroyed) {
        sprite.visible = false;
      }
    }
  }

  isUnderTree(x: number, y: number): boolean {
    let underTree = false;
    this.mapObjects.forEach((treeSprite, objId) => {
      if (objId.startsWith('tree') && treeSprite.visible) {
        const treeBounds = treeSprite.getBounds();
        if (x >= treeBounds.x && x < treeBounds.x + treeBounds.width &&
            y >= treeBounds.y && y < treeBounds.y + treeBounds.height) {
          underTree = true;
        }
      }
    });
    return underTree;
  }
}
