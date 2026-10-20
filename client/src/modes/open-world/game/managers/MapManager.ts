import * as PIXI from 'pixi.js';

// Brick colors as rendered on the Missions board
const BRICK_TOP = 0x9e421d;
const BRICK_FRONT = 0x5f200c;

// Map objects sit on a 40-unit grid
const TREE_CELL = 40;
const cellKey = (x: number, y: number) => `${Math.floor(x / TREE_CELL)},${Math.floor(y / TREE_CELL)}`;

export class MapManager {
  private mapObjects: Map<string, PIXI.Graphics>;
  private world: PIXI.Container;
  // World cells covered by trees, for O(1) "is this tank hidden" checks
  private treeCells = new Set<string>();

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
          // Looks like a Missions brick block: lit top face, dark front face, small gap around
          sprite.beginFill(BRICK_TOP);
          sprite.drawRect(1, 1, obj.width - 2, obj.height - 7);
          sprite.endFill();
          sprite.beginFill(BRICK_FRONT);
          sprite.drawRect(1, obj.height - 6, obj.width - 2, 5);
          sprite.endFill();
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

      case 'tree': {
        // Dense crown filling the whole cell, so neighbouring cells merge into one forest
        const w = obj.width, h = obj.height;
        sprite.beginFill(0x1a5c1a);
        sprite.drawRect(0, 0, w, h);
        sprite.endFill();
        sprite.beginFill(0x267a26);
        for (const [cx, cy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]]) {
          sprite.drawCircle(cx * w, cy * h, w * 0.27);
        }
        sprite.endFill();
        sprite.beginFill(0x3c9c3c);
        for (const [cx, cy] of [[0.18, 0.18], [0.68, 0.18], [0.18, 0.68], [0.68, 0.68]]) {
          sprite.drawCircle(cx * w, cy * h, w * 0.1);
        }
        sprite.endFill();
        // Above tanks and bullets: whatever drives into the forest is hidden
        sprite.zIndex = 10;
        for (let x = obj.x; x < obj.x + w; x += TREE_CELL) {
          for (let y = obj.y; y < obj.y + h; y += TREE_CELL) this.treeCells.add(cellKey(x, y));
        }
        break;
      }
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

  /** World coordinates (not screen bounds, which change with the camera) */
  isUnderTree(x: number, y: number): boolean {
    return this.treeCells.has(cellKey(x, y));
  }
}
