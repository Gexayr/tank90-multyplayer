/**
 * Map Object Types and Definitions
 */

export enum MapObjectType {
  BRICK_WALL = 'brick_wall',
  CONCRETE_WALL = 'concrete_wall',
  WATER = 'water',
  TREE = 'tree',
}

export interface MapObject {
  id: string;
  type: MapObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  destroyed?: boolean; // For brick walls
}

/**
 * Generate a default map layout
 */
export function generateMapLayout(): MapObject[] {
  const objects: MapObject[] = [];
  const WORLD_WIDTH = 4000;
  const WORLD_HEIGHT = 4000;
  const CELL_SIZE = 40;

  // Add border walls (concrete - indestructible)
  // Top and bottom borders
  for (let x = 0; x < WORLD_WIDTH; x += CELL_SIZE) {
    objects.push({
      id: `concrete-border-top-${x}`,
      type: MapObjectType.CONCRETE_WALL,
      x,
      y: 0,
      width: CELL_SIZE,
      height: CELL_SIZE,
    });
    objects.push({
      id: `concrete-border-bottom-${x}`,
      type: MapObjectType.CONCRETE_WALL,
      x,
      y: WORLD_HEIGHT - CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
    });
  }

  // Left and right borders
  for (let y = 0; y < WORLD_HEIGHT; y += CELL_SIZE) {
    objects.push({
      id: `concrete-border-left-${y}`,
      type: MapObjectType.CONCRETE_WALL,
      x: 0,
      y,
      width: CELL_SIZE,
      height: CELL_SIZE,
    });
    objects.push({
      id: `concrete-border-right-${y}`,
      type: MapObjectType.CONCRETE_WALL,
      x: WORLD_WIDTH - CELL_SIZE,
      y,
      width: CELL_SIZE,
      height: CELL_SIZE,
    });
  }

  // Add brick walls in the middle (destructible) - 7x density
  const brickWallGroups: Array<{ x: number; y: number; width?: number; height?: number }> = [
    // Original walls multiplied
    { x: 800, y: 800, width: 3, height: 1 },
    { x: 1200, y: 600, width: 2, height: 1 },
    { x: 2000, y: 1500, width: 3, height: 1 },
    { x: 3000, y: 2000, width: 2, height: 1 },
    // Additional walls for 7x density
    { x: 400, y: 400, width: 2, height: 1 },
    { x: 600, y: 1200, width: 3, height: 1 },
    { x: 1000, y: 2000, width: 2, height: 1 },
    { x: 1400, y: 800, width: 4, height: 1 },
    { x: 1600, y: 1400, width: 2, height: 1 },
    { x: 1800, y: 600, width: 3, height: 1 },
    { x: 2200, y: 1800, width: 2, height: 1 },
    { x: 2400, y: 1200, width: 3, height: 1 },
    { x: 2600, y: 400, width: 2, height: 1 },
    { x: 2800, y: 1600, width: 4, height: 1 },
    { x: 3200, y: 1000, width: 2, height: 1 },
    { x: 3400, y: 2400, width: 3, height: 1 },
    { x: 3600, y: 600, width: 2, height: 1 },
    { x: 500, y: 2500, width: 3, height: 1 },
    { x: 900, y: 3000, width: 2, height: 1 },
    { x: 1300, y: 3500, width: 3, height: 1 },
    { x: 1700, y: 3200, width: 2, height: 1 },
    { x: 2100, y: 2800, width: 4, height: 1 },
    { x: 2500, y: 3200, width: 2, height: 1 },
    { x: 2900, y: 3600, width: 3, height: 1 },
    { x: 3300, y: 3000, width: 2, height: 1 },
    { x: 3700, y: 3400, width: 3, height: 1 },
    // Vertical walls
    { x: 500, y: 1000, width: 1, height: 3 },
    { x: 1500, y: 2000, width: 1, height: 2 },
    { x: 2500, y: 500, width: 1, height: 3 },
    { x: 3500, y: 1500, width: 1, height: 4 },
    { x: 700, y: 2800, width: 1, height: 2 },
    { x: 1900, y: 1000, width: 1, height: 3 },
    { x: 3100, y: 2200, width: 1, height: 2 },
  ];

  let brickWallIndex = 0;
  brickWallGroups.forEach((group) => {
    const width = group.width || 1;
    const height = group.height || 1;
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        objects.push({
          id: `brick-wall-${brickWallIndex++}`,
          type: MapObjectType.BRICK_WALL,
          x: group.x + dx * CELL_SIZE,
          y: group.y + dy * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
          destroyed: false,
        });
      }
    }
  });

  // Add water areas - 7x density
  const waterAreas = [
    // Original water areas
    { x: 1600, y: 1600, width: 3, height: 2 },
    { x: 2500, y: 1000, width: 2, height: 4 },
    // Additional water areas for 7x density
    { x: 600, y: 600, width: 2, height: 2 },
    { x: 1200, y: 1200, width: 3, height: 2 },
    { x: 800, y: 2000, width: 2, height: 3 },
    { x: 1800, y: 2400, width: 3, height: 2 },
    { x: 2400, y: 1800, width: 2, height: 4 },
    { x: 3000, y: 1400, width: 3, height: 2 },
    { x: 3400, y: 2800, width: 2, height: 3 },
    { x: 400, y: 3200, width: 3, height: 2 },
    { x: 1400, y: 3600, width: 2, height: 2 },
    { x: 2200, y: 3200, width: 3, height: 2 },
    { x: 2800, y: 400, width: 2, height: 3 },
    { x: 3600, y: 2000, width: 3, height: 2 },
    { x: 1000, y: 2800, width: 2, height: 2 },
    { x: 3200, y: 600, width: 3, height: 2 },
    { x: 600, y: 1800, width: 2, height: 3 },
    { x: 2000, y: 600, width: 3, height: 2 },
    { x: 2600, y: 2600, width: 2, height: 4 },
    { x: 3800, y: 3200, width: 3, height: 2 },
  ];

  waterAreas.forEach((area, index) => {
    for (let dx = 0; dx < area.width; dx++) {
      for (let dy = 0; dy < area.height; dy++) {
        objects.push({
          id: `water-${index}-${dx}-${dy}`,
          type: MapObjectType.WATER,
          x: area.x + dx * CELL_SIZE,
          y: area.y + dy * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
        });
      }
    }
  });

  // Add trees (scattered) - 7x density (49 trees total)
  const trees = [
    // Original trees
    { x: 500, y: 500 },
    { x: 1500, y: 700 },
    { x: 2200, y: 1200 },
    { x: 1800, y: 2500 },
    { x: 3200, y: 1800 },
    { x: 700, y: 3000 },
    { x: 2800, y: 2800 },
    // Additional trees for 7x density
    { x: 300, y: 300 },
    { x: 900, y: 400 },
    { x: 1100, y: 900 },
    { x: 1300, y: 1300 },
    { x: 1700, y: 500 },
    { x: 1900, y: 1100 },
    { x: 2100, y: 1900 },
    { x: 2300, y: 700 },
    { x: 2700, y: 1500 },
    { x: 2900, y: 2300 },
    { x: 3100, y: 1000 },
    { x: 3300, y: 2700 },
    { x: 3500, y: 500 },
    { x: 3700, y: 1500 },
    { x: 100, y: 1000 },
    { x: 500, y: 1500 },
    { x: 700, y: 2000 },
    { x: 1100, y: 2500 },
    { x: 1500, y: 3000 },
    { x: 1900, y: 3500 },
    { x: 2300, y: 3100 },
    { x: 2700, y: 3300 },
    { x: 3100, y: 3500 },
    { x: 3500, y: 3100 },
    { x: 3900, y: 2700 },
    { x: 200, y: 2000 },
    { x: 600, y: 2400 },
    { x: 1000, y: 2200 },
    { x: 1400, y: 2600 },
    { x: 1800, y: 2900 },
    { x: 2200, y: 3400 },
    { x: 2600, y: 3700 },
    { x: 3000, y: 3600 },
    { x: 3400, y: 3300 },
    { x: 3800, y: 2900 },
    { x: 400, y: 3600 },
    { x: 800, y: 3800 },
  ];

  trees.forEach((pos, index) => {
    objects.push({
      id: `tree-${index}`,
      type: MapObjectType.TREE,
      x: pos.x,
      y: pos.y,
      width: CELL_SIZE,
      height: CELL_SIZE,
    });
  });

  return objects;
}

/**
 * Check if a point is within a map object
 */
export function pointInMapObject(x: number, y: number, obj: MapObject): boolean {
  return x >= obj.x && x < obj.x + obj.width &&
         y >= obj.y && y < obj.y + obj.height;
}

/**
 * Check if a circle (tank) collides with a map object
 */
export function circleCollidesWithMapObject(
  circleX: number,
  circleY: number,
  radius: number,
  obj: MapObject
): boolean {
  if (obj.destroyed && obj.type === MapObjectType.BRICK_WALL) {
    return false; // Destroyed walls don't block
  }

  if (obj.type === MapObjectType.WATER || obj.type === MapObjectType.TREE) {
    // Trees don't block movement (only visual), water blocks movement
    if (obj.type === MapObjectType.TREE) {
      return false;
    }
  }

  // Find closest point on rectangle to circle center
  const closestX = Math.max(obj.x, Math.min(circleX, obj.x + obj.width));
  const closestY = Math.max(obj.y, Math.min(circleY, obj.y + obj.height));

  // Calculate distance from circle center to closest point
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  const distanceSquared = dx * dx + dy * dy;

  return distanceSquared < radius * radius;
}

