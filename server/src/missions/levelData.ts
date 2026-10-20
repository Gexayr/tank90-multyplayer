import type { Wall, PowerUp } from '../../../shared/missions-types';
import { BOARD_WIDTH, BOARD_HEIGHT } from './constants';

export function generateLevel(level: number): { walls: Wall[]; powerUps: PowerUp[] } {
  const walls: Wall[] = [];
  let wallId = 0;

  const addWall = (x: number, z: number, type: 'brick' | 'metal' | 'base') => {
    walls.push({ id: `wall-${wallId++}`, position: { x, z }, type });
  };

  const center = Math.floor(BOARD_WIDTH / 2);

  // Border walls
  for (let i = 0; i < BOARD_WIDTH; i++) {
    addWall(i, 0, 'metal');
    addWall(i, BOARD_HEIGHT - 1, 'metal');
  }
  for (let i = 1; i < BOARD_HEIGHT - 1; i++) {
    addWall(0, i, 'metal');
    addWall(BOARD_WIDTH - 1, i, 'metal');
  }

  // Eagle base on the bottom row, next to the border
  addWall(center, BOARD_HEIGHT - 2, 'base');

  // Brick wall on its left, right and top (the side enemies come from)
  const baseProtect = [
    [center - 1, BOARD_HEIGHT - 2],
    [center + 1, BOARD_HEIGHT - 2],
    [center - 1, BOARD_HEIGHT - 3],
    [center, BOARD_HEIGHT - 3],
    [center + 1, BOARD_HEIGHT - 3],
  ];
  baseProtect.forEach(([x, z]) => addWall(x, z, 'brick'));

  const usedPositions = new Set<string>();
  walls.forEach(w => usedPositions.add(`${w.position.x},${w.position.z}`));

  // Keep player spawn areas clear
  const clearZones = new Set<string>();
  [[center - 4, BOARD_HEIGHT - 2], [center + 4, BOARD_HEIGHT - 2], [center - 2, BOARD_HEIGHT - 2], [center + 2, BOARD_HEIGHT - 2]].forEach(([x, z]) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) clearZones.add(`${x + dx},${z + dz}`);
  });
  // Keep enemy spawn areas clear
  [[2, 2], [center, 2], [BOARD_WIDTH - 3, 2]].forEach(([x, z]) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) clearZones.add(`${x + dx},${z + dz}`);
  });

  // Generate wall clusters
  const clusterCount = 10 + level * 2;
  for (let c = 0; c < clusterCount; c++) {
    const cx = 2 + Math.floor(Math.random() * (BOARD_WIDTH - 4));
    const cz = 3 + Math.floor(Math.random() * (BOARD_HEIGHT - 7));
    const isHorizontal = Math.random() > 0.5;
    const length = 2 + Math.floor(Math.random() * 3);
    const isMetal = Math.random() < 0.25;

    for (let i = 0; i < length; i++) {
      const wx = isHorizontal ? cx + i : cx;
      const wz = isHorizontal ? cz : cz + i;
      const key = `${wx},${wz}`;
      if (!usedPositions.has(key) && !clearZones.has(key) && wx > 0 && wx < BOARD_WIDTH - 1 && wz > 0 && wz < BOARD_HEIGHT - 1) {
        addWall(wx, wz, isMetal ? 'metal' : 'brick');
        usedPositions.add(key);
      }
    }
  }

  // Power-ups
  const powerUps: PowerUp[] = [];
  const puTypes: PowerUp['type'][] = ['star', 'speed', 'shield', 'life'];
  for (let i = 0; i < 4; i++) {
    let px: number, pz: number, key: string;
    let tries = 0;
    do {
      px = 2 + Math.floor(Math.random() * (BOARD_WIDTH - 4));
      pz = 3 + Math.floor(Math.random() * (BOARD_HEIGHT - 7));
      key = `${px},${pz}`;
      tries++;
    } while ((usedPositions.has(key) || clearZones.has(key)) && tries < 100);
    if (tries < 100) {
      powerUps.push({ id: `pu-${i}`, position: { x: px, z: pz }, type: puTypes[i % puTypes.length] });
      usedPositions.add(key);
    }
  }

  return { walls, powerUps };
}
