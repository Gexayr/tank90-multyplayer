import { GRID_SIZE, WALL_TYPES } from '../constants/gameConfig';

// Generate a level grid based on level number
export const generateLevel = (level: number): number[][] => {
  const grid: number[][] = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));

  // Add walls
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      // Add border walls
      if (i === 0 || i === GRID_SIZE - 1 || j === 0 || j === GRID_SIZE - 1) {
        grid[i][j] = 2; // Steel walls
      }
      // Add random walls
      else if (Math.random() < 0.1) {
        grid[i][j] = Math.random() < 0.7 ? 1 : 2; // 70% brick walls, 30% steel walls
      }
    }
  }

  // Clear spawn areas
  const spawnAreas = [
    { x: 1, y: 1 },
    { x: GRID_SIZE - 2, y: 1 },
    { x: 1, y: GRID_SIZE - 2 },
    { x: GRID_SIZE - 2, y: GRID_SIZE - 2 }
  ];

  spawnAreas.forEach(area => {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (area.x + i >= 0 && area.x + i < GRID_SIZE && 
            area.y + j >= 0 && area.y + j < GRID_SIZE) {
          grid[area.y + j][area.x + i] = 0;
        }
      }
    }
  });

  return grid;
};

// Cell values in the grid:
// 0: Empty
// 1: Brick wall
// 2: Steel wall
// 3: Water
// 4: Forest
// 5: Ice
// 9: Base/Headquarters (to protect)

const generateLevel1 = (grid: number[][]): number[][] => {
  // Simple level with some brick walls forming corridors
  
  // Add some brick walls
  for (let i = 2; i < GRID_SIZE - 2; i += 2) {
    for (let j = 2; j < GRID_SIZE - 2; j += 2) {
      grid[i][j] = 1; // Brick wall
    }
  }
  
  // Add a few steel walls
  grid[3][3] = 2;
  grid[3][9] = 2;
  grid[9][3] = 2;
  grid[9][9] = 2;
  
  return grid;
};

const generateLevel2 = (grid: number[][]): number[][] => {
  // Level with more obstacles and water
  
  // Create a maze-like pattern with brick walls
  for (let i = 1; i < GRID_SIZE; i += 2) {
    for (let j = 1; j < GRID_SIZE; j += 2) {
      if (Math.random() < 0.7) {
        grid[i][j] = 1; // Brick wall
      }
    }
  }
  
  // Add water in the middle
  for (let i = 5; i < 8; i++) {
    for (let j = 5; j < 8; j++) {
      grid[i][j] = 3; // Water
    }
  }
  
  // Add some steel walls as barriers
  grid[2][2] = 2;
  grid[2][GRID_SIZE - 3] = 2;
  grid[GRID_SIZE - 3][2] = 2;
  grid[GRID_SIZE - 3][GRID_SIZE - 3] = 2;
  
  // Add some forest for cover
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    if (grid[y][x] === 0) {
      grid[y][x] = 4; // Forest
    }
  }
  
  return grid;
};

const generateLevel3 = (grid: number[][]): number[][] => {
  // Level with cross-shaped barriers
  
  // Create cross shape with brick walls
  const mid = Math.floor(GRID_SIZE / 2);
  
  for (let i = 1; i < GRID_SIZE - 1; i++) {
    grid[i][mid] = 1; // Vertical line
    grid[mid][i] = 1; // Horizontal line
  }
  
  // Add steel walls in the corners
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      // Top-left corner
      grid[i][j] = 2;
      
      // Top-right corner
      grid[i][GRID_SIZE - 1 - j] = 2;
      
      // Bottom-left corner
      grid[GRID_SIZE - 1 - i][j] = 2;
      
      // Bottom-right corner
      grid[GRID_SIZE - 1 - i][GRID_SIZE - 1 - j] = 2;
    }
  }
  
  // Add water areas
  for (let i = 3; i < 6; i++) {
    for (let j = 3; j < 6; j++) {
      grid[i][j] = 3; // Water
      grid[i][GRID_SIZE - 1 - j] = 3; // Water
      grid[GRID_SIZE - 1 - i][j] = 3; // Water
      grid[GRID_SIZE - 1 - i][GRID_SIZE - 1 - j] = 3; // Water
    }
  }
  
  // Add forests
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    if (grid[y][x] === 0) {
      grid[y][x] = 4; // Forest
    }
  }
  
  // Add ice patches
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    if (grid[y][x] === 0) {
      grid[y][x] = 5; // Ice
    }
  }
  
  return grid;
};

const generateLevel4 = (grid: number[][]): number[][] => {
  // More complex level with mazes
  
  // Create a maze pattern with brick walls
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if ((i % 4 === 0 || j % 4 === 0) && Math.random() < 0.7) {
        grid[i][j] = 1; // Brick wall
      }
    }
  }
  
  // Add steel walls as barriers in key positions
  for (let i = 2; i < GRID_SIZE; i += 4) {
    for (let j = 2; j < GRID_SIZE; j += 4) {
      grid[i][j] = 2; // Steel wall
    }
  }
  
  // Add water areas
  for (let i = 0; i < GRID_SIZE; i++) {
    if (i % 3 === 0) {
      for (let j = 0; j < 3; j++) {
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        if (grid[y][x] === 0) {
          grid[y][x] = 3; // Water
        }
      }
    }
  }
  
  // Add forests in clusters
  for (let cluster = 0; cluster < 3; cluster++) {
    const centerX = Math.floor(Math.random() * GRID_SIZE);
    const centerY = Math.floor(Math.random() * GRID_SIZE);
    
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const x = centerX + j;
        const y = centerY + i;
        
        if (
          x >= 0 && x < GRID_SIZE && 
          y >= 0 && y < GRID_SIZE && 
          grid[y][x] === 0
        ) {
          grid[y][x] = 4; // Forest
        }
      }
    }
  }
  
  // Add ice patches
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    if (grid[y][x] === 0) {
      grid[y][x] = 5; // Ice
    }
  }
  
  // Ensure spawn areas are clear
  grid[0][0] = 0; // Top-left
  grid[0][1] = 0;
  grid[1][0] = 0;
  
  grid[0][GRID_SIZE - 1] = 0; // Top-right
  grid[0][GRID_SIZE - 2] = 0;
  grid[1][GRID_SIZE - 1] = 0;
  
  grid[GRID_SIZE - 1][0] = 0; // Bottom-left
  grid[GRID_SIZE - 2][0] = 0;
  grid[GRID_SIZE - 1][1] = 0;
  
  grid[GRID_SIZE - 1][GRID_SIZE - 1] = 0; // Bottom-right
  grid[GRID_SIZE - 2][GRID_SIZE - 1] = 0;
  grid[GRID_SIZE - 1][GRID_SIZE - 2] = 0;
  
  return grid;
};

const generateLevel5 = (grid: number[][]): number[][] => {
  // Fortress level with heavy defenses
  
  // Create a border of steel walls
  for (let i = 0; i < GRID_SIZE; i++) {
    grid[0][i] = 2; // Top row
    grid[GRID_SIZE - 1][i] = 2; // Bottom row
    grid[i][0] = 2; // Left column
    grid[i][GRID_SIZE - 1] = 2; // Right column
  }
  
  // Create a fortress structure with brick walls
  for (let i = 3; i < GRID_SIZE - 3; i += 3) {
    for (let j = 3; j < GRID_SIZE - 3; j++) {
      grid[i][j] = 1; // Horizontal brick walls
    }
  }
  
  for (let i = 3; i < GRID_SIZE - 3; i++) {
    for (let j = 3; j < GRID_SIZE - 3; j += 3) {
      grid[i][j] = 1; // Vertical brick walls
    }
  }
  
  // Add water moat
  for (let i = 2; i < GRID_SIZE - 2; i++) {
    grid[2][i] = 3; // Top water
    grid[GRID_SIZE - 3][i] = 3; // Bottom water
    grid[i][2] = 3; // Left water
    grid[i][GRID_SIZE - 3] = 3; // Right water
  }
  
  // Add forests for cover
  for (let i = 4; i < GRID_SIZE - 4; i++) {
    for (let j = 4; j < GRID_SIZE - 4; j++) {
      if (grid[i][j] === 0 && Math.random() < 0.2) {
        grid[i][j] = 4; // Forest
      }
    }
  }
  
  // Add some ice in the center area
  for (let i = 5; i < 8; i++) {
    for (let j = 5; j < 8; j++) {
      if (grid[i][j] === 0) {
        grid[i][j] = 5; // Ice
      }
    }
  }
  
  // Clear spawn areas
  grid[1][1] = 0; // Top-left
  grid[1][2] = 0;
  grid[2][1] = 0;
  
  grid[1][GRID_SIZE - 2] = 0; // Top-right
  grid[1][GRID_SIZE - 3] = 0;
  grid[2][GRID_SIZE - 2] = 0;
  
  grid[GRID_SIZE - 2][1] = 0; // Bottom-left
  grid[GRID_SIZE - 3][1] = 0;
  grid[GRID_SIZE - 2][2] = 0;
  
  grid[GRID_SIZE - 2][GRID_SIZE - 2] = 0; // Bottom-right
  grid[GRID_SIZE - 3][GRID_SIZE - 2] = 0;
  grid[GRID_SIZE - 2][GRID_SIZE - 3] = 0;
  
  return grid;
};

const generateRandomLevel = (grid: number[][], level: number): number[][] => {
  // Random level with difficulty increasing based on level number
  
  // Difficulty factors
  const brickDensity = Math.min(0.3 + (level * 0.02), 0.5);
  const steelDensity = Math.min(0.1 + (level * 0.01), 0.3);
  const waterDensity = Math.min(0.05 + (level * 0.005), 0.15);
  const forestDensity = Math.min(0.1 + (level * 0.01), 0.2);
  const iceDensity = Math.min(0.05 + (level * 0.005), 0.15);
  
  // Fill with random terrain
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const rand = Math.random();
      
      if (rand < brickDensity) {
        grid[i][j] = 1; // Brick wall
      } else if (rand < brickDensity + steelDensity) {
        grid[i][j] = 2; // Steel wall
      } else if (rand < brickDensity + steelDensity + waterDensity) {
        grid[i][j] = 3; // Water
      } else if (rand < brickDensity + steelDensity + waterDensity + forestDensity) {
        grid[i][j] = 4; // Forest
      } else if (rand < brickDensity + steelDensity + waterDensity + forestDensity + iceDensity) {
        grid[i][j] = 5; // Ice
      }
    }
  }
  
  // Clear spawn areas
  grid[0][0] = 0; // Top-left
  grid[0][1] = 0;
  grid[1][0] = 0;
  
  grid[0][GRID_SIZE - 1] = 0; // Top-right
  grid[0][GRID_SIZE - 2] = 0;
  grid[1][GRID_SIZE - 1] = 0;
  
  grid[GRID_SIZE - 1][0] = 0; // Bottom-left
  grid[GRID_SIZE - 2][0] = 0;
  grid[GRID_SIZE - 1][1] = 0;
  
  grid[GRID_SIZE - 1][GRID_SIZE - 1] = 0; // Bottom-right
  grid[GRID_SIZE - 2][GRID_SIZE - 1] = 0;
  grid[GRID_SIZE - 1][GRID_SIZE - 2] = 0;
  
  return grid;
};