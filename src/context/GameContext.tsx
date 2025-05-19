import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { generateLevel } from '../utils/levelGenerator';
import {Tank, /*TankType, Tile,*/ Direction, Player, PowerUpType} from '../types/gameTypes';
import { INITIAL_LIVES, MAX_PLAYERS, GRID_SIZE } from '../constants/gameConfig';

// Define the shape of our context
interface GameContextType {
  gameState: GameState;
  players: Player[];
  tanks: Tank[];
  score: Record<string, number>;
  currentLevel: number;
  isGameRunning: boolean;
  isPaused: boolean;
  powerUps: PowerUp[];
  addPlayer: (playerName: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  movePlayer: (playerId: number, direction: Direction) => void;
  fireProjectile: (playerId: number) => void;
}

export interface GameState {
  grid: number[][];
  projectiles: Projectile[];
  walls: Wall[];
}

export interface Projectile {
  id: string;
  position: { x: number; y: number };
  direction: Direction;
  ownerId: number;
  damage: number;
  speed: number;
}

export interface Wall {
  id: string;
  position: { x: number; y: number };
  type: 'brick' | 'steel' | 'water' | 'forest';
  health: number;
}

export interface PowerUp {
  id: string;
  position: { x: number; y: number };
  type: PowerUpType;
  duration: number;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const initialGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    return {
      grid: initialGrid,
      projectiles: [],
      walls: []
    };
  });
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [score, setScore] = useState<Record<string, number>>({});
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [isGameRunning, setIsGameRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);

  useEffect(() => {
    if (isGameRunning) {
      loadLevel(currentLevel);
    }
  }, [currentLevel, isGameRunning]);

  useEffect(() => {
    if (!isGameRunning || isPaused) return;

    const gameLoop = setInterval(() => {
      updateGameState();
    }, 16);

    return () => clearInterval(gameLoop);
  }, [isGameRunning, isPaused]);

  const loadLevel = (level: number) => {
    const levelGrid = generateLevel(level);
    setGameState(prev => ({
      ...prev,
      grid: levelGrid,
      projectiles: [],
      walls: extractWallsFromGrid(levelGrid)
    }));

    // Reset tank positions
    setTanks(prev => 
      prev.map((tank, index) => ({
        ...tank,
        position: getSpawnPosition(index),
        direction: 'up',
        health: tank.type === 'player' ? 3 : 1
      }))
    );

    generatePowerUps();
  };

  const extractWallsFromGrid = (grid: number[][]): Wall[] => {
    const walls: Wall[] = [];
    grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell >= 1 && cell <= 4) {
          walls.push({
            id: `wall-${x}-${y}`,
            position: { x, y },
            type: getWallType(cell),
            health: cell === 2 ? 2 : 1
          });
        }
      });
    });
    return walls;
  };

  const getWallType = (value: number): 'brick' | 'steel' | 'water' | 'forest' => {
    switch (value) {
      case 1: return 'brick';
      case 2: return 'steel';
      case 3: return 'water';
      case 4: return 'forest';
      default: return 'brick';
    }
  };

  const getSpawnPosition = (playerIndex: number) => {
    const spawnPoints = [
      { x: 1, y: 1 },
      { x: GRID_SIZE - 2, y: 1 },
      { x: 1, y: GRID_SIZE - 2 },
      { x: GRID_SIZE - 2, y: GRID_SIZE - 2 }
    ];
    return spawnPoints[playerIndex % spawnPoints.length];
  };

  const generatePowerUps = () => {
    const types: PowerUpType[] = ['shield', 'speed', 'firepower'];
    const newPowerUps: PowerUp[] = [];

    for (let i = 0; i < 3; i++) {
      let position;
      do {
        position = {
          x: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1,
          y: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1
        };
      } while (isPositionOccupied(position));

      newPowerUps.push({
        id: `powerup-${Date.now()}-${i}`,
        position,
        type: types[Math.floor(Math.random() * types.length)],
        duration: 10000
      });
    }

    setPowerUps(newPowerUps);
  };

  const isPositionOccupied = (position: { x: number; y: number }) => {
    return gameState.walls.some(wall => 
      wall.position.x === position.x && wall.position.y === position.y
    ) || tanks.some(tank =>
      Math.round(tank.position.x) === position.x && Math.round(tank.position.y) === position.y
    );
  };

  const updateGameState = () => {
    updateProjectiles();
    updateTanks();
    checkCollisions();
    updatePowerUps();
    checkGameConditions();
  };

  const updateProjectiles = () => {
    setGameState(prev => {
      const updatedProjectiles = prev.projectiles.map(projectile => {
        const newPosition = { ...projectile.position };
        const speed = projectile.speed;

        switch (projectile.direction) {
          case 'up': newPosition.y -= speed; break;
          case 'right': newPosition.x += speed; break;
          case 'down': newPosition.y += speed; break;
          case 'left': newPosition.x -= speed; break;
        }

        return { ...projectile, position: newPosition };
      }).filter(projectile => 
        projectile.position.x >= 0 && 
        projectile.position.x < GRID_SIZE && 
        projectile.position.y >= 0 && 
        projectile.position.y < GRID_SIZE
      );

      return { ...prev, projectiles: updatedProjectiles };
    });
  };

  const updateTanks = () => {
    setTanks(prev => prev.map(tank => {
      if (tank.type !== 'ai') return tank;

      const newPosition = { ...tank.position };
      const speed = tank.speed;

      if (Math.random() < 0.02) {
        const directions: Direction[] = ['up', 'right', 'down', 'left', 'space'];
        tank.direction = directions[Math.floor(Math.random() * directions.length)];
      }

      switch (tank.direction) {
        case 'up': newPosition.y = Math.max(0, newPosition.y - speed); break;
        case 'right': newPosition.x = Math.min(GRID_SIZE - 1, newPosition.x + speed); break;
        case 'down': newPosition.y = Math.min(GRID_SIZE - 1, newPosition.y + speed); break;
        case 'left': newPosition.x = Math.max(0, newPosition.x - speed); break;
        case 'space': ; break;
      }

      if (!isPositionOccupied(newPosition)) {
        return { ...tank, position: newPosition };
      }

      return tank;
    }));
  };

  const checkCollisions = () => {
    setGameState(prev => {
      const updatedWalls = [...prev.walls];
      const projectilesToRemove = new Set<string>();

      prev.projectiles.forEach(projectile => {
        const projX = Math.round(projectile.position.x);
        const projY = Math.round(projectile.position.y);

        // Wall collisions
        updatedWalls.forEach((wall, index) => {
          if (projX === wall.position.x && projY === wall.position.y) {
            projectilesToRemove.add(projectile.id);
            if (wall.type === 'brick' || (wall.type === 'steel' && projectile.damage > 1)) {
              updatedWalls[index] = { ...wall, health: wall.health - projectile.damage };
            }
          }
        });

        // Tank collisions
        setTanks(prevTanks => 
          prevTanks.map(tank => {
            if (
              tank.id !== projectile.ownerId &&
              Math.round(tank.position.x) === projX &&
              Math.round(tank.position.y) === projY
            ) {
              projectilesToRemove.add(projectile.id);
              const newHealth = tank.health - projectile.damage;

              if (tank.type === 'ai' && newHealth <= 0) {
                setScore(prev => ({
                  ...prev,
                  [projectile.ownerId]: (prev[projectile.ownerId] || 0) + 100
                }));
              }

              return { ...tank, health: newHealth };
            }
            return tank;
          }).filter(tank => tank.health > 0)
        );
      });

      return {
        ...prev,
        walls: updatedWalls.filter(wall => wall.health > 0),
        projectiles: prev.projectiles.filter(proj => !projectilesToRemove.has(proj.id))
      };
    });
  };

  const updatePowerUps = () => {
    setPowerUps(prev => prev.filter(powerUp => {
      const tankCollected = tanks.find(tank => 
        tank.type === 'player' &&
        Math.round(tank.position.x) === powerUp.position.x &&
        Math.round(tank.position.y) === powerUp.position.y
      );

      if (tankCollected) {
        setTanks(prevTanks => prevTanks.map(tank => {
          if (tank.id === tankCollected.id) {
            switch (powerUp.type) {
              case 'shield': return { ...tank, shield: true };
              case 'speed': return { ...tank, speed: tank.speed * 1.5 };
              case 'firepower': return { ...tank, firepower: tank.firepower + 1 };
            }
          }
          return tank;
        }));
        return false;
      }
      return true;
    }));
  };

  const checkGameConditions = () => {
    const aiTanks = tanks.filter(tank => tank.type === 'ai');
    const playerTanks = tanks.filter(tank => tank.type === 'player');

    if (aiTanks.length === 0 && isGameRunning) {
      setCurrentLevel(prev => prev + 1);
    }

    if (playerTanks.length === 0 && isGameRunning) {
      setIsGameRunning(false);
    }
  };

  const addPlayer = (playerName: string) => {
    if (players.length >= MAX_PLAYERS) return;

    const newPlayerId = players.length + 1;
    const spawnPosition = getSpawnPosition(players.length);
    const playerColor = getPlayerColor(newPlayerId);

    setPlayers(prev => [...prev, {
      id: newPlayerId,
      name: playerName,
      lives: INITIAL_LIVES,
      color: playerColor
    }]);

    setScore(prev => ({ ...prev, [newPlayerId]: 0 }));

    setTanks(prev => [...prev, {
      id: newPlayerId,
      type: 'player',
      position: spawnPosition,
      direction: 'up',
      speed: 0.2,
      health: 3,
      firepower: 1,
      fireRate: 6,
      lastFired: 0,
      shield: false,
      color: playerColor
    }]);
  };

  const getPlayerColor = (playerId: number): string => {
    const colors = ['#FFD700', '#00BFFF', '#FF6347', '#32CD32'];
    return colors[(playerId - 1) % colors.length];
  };

  const startGame = () => {
    if (players.length === 0) {
      addPlayer('Player 1');
    }

    setIsGameRunning(true);
    setIsPaused(false);
    loadLevel(currentLevel);

    // Add AI tanks
    const aiCount = Math.min(currentLevel + 2, 8);
    const aiTanks: Tank[] = Array.from({ length: aiCount }, (_, i) => ({
      id: 100 + i,
      type: 'ai',
      position: {
        x: 2 + Math.floor(Math.random() * (GRID_SIZE - 4)),
        y: 2 + Math.floor(Math.random() * (GRID_SIZE - 4))
      },
      direction: 'down',
      speed: 0.05,
      health: 1 + Math.floor(currentLevel / 3),
      firepower: 1,
      fireRate: 1,
      lastFired: 0,
      shield: false,
      color: '#FF0000'
    }));

    setTanks(prev => [...prev.filter(tank => tank.type === 'player'), ...aiTanks]);
  };

  const pauseGame = () => setIsPaused(true);
  const resumeGame = () => setIsPaused(false);

  const restartGame = () => {
    setCurrentLevel(1);
    setScore({});
    setTanks(prev => 
      prev.filter(tank => tank.type === 'player').map(tank => ({
        ...tank,
        position: getSpawnPosition(tank.id - 1),
        direction: 'up',
        health: 3,
        firepower: 1,
        speed: 0.1,
        shield: false
      }))
    );
    startGame();
  };

  const movePlayer = (playerId: number, direction: Direction) => {
    if (!isGameRunning || isPaused) return;

    setTanks(prev => prev.map(tank => {
      if (tank.id !== playerId || tank.type !== 'player') return tank;

      const newPosition = { ...tank.position };
      const speed = tank.speed;

      switch (direction) {
        case 'up': newPosition.y = Math.max(0, newPosition.y - speed); break;
        case 'right': newPosition.x = Math.min(GRID_SIZE - 1, newPosition.x + speed); break;
        case 'down': newPosition.y = Math.min(GRID_SIZE - 1, newPosition.y + speed); break;
        case 'left': newPosition.x = Math.max(0, newPosition.x - speed); break;
      }

      if (!isPositionOccupied(newPosition)) {
        return { ...tank, direction, position: newPosition };
      }

      return { ...tank, direction };
    }));
  };

  const fireProjectile = (playerId: number) => {
    if (!isGameRunning || isPaused) return;

    const tank = tanks.find(t => t.id === playerId);
    if (!tank) return;

    const now = Date.now();
    const cooldown = 1000 / tank.fireRate;

    if (now - tank.lastFired < cooldown) return;

    setTanks(prev => prev.map(t => 
      t.id === playerId ? { ...t, lastFired: now } : t
    ));

    const projectilePosition = { ...tank.position };
    switch (tank.direction) {
      case 'up': projectilePosition.y -= 0.5; break;
      case 'right': projectilePosition.x += 0.5; break;
      case 'down': projectilePosition.y += 0.5; break;
      case 'left': projectilePosition.x -= 0.5; break;
    }

    setGameState(prev => ({
      ...prev,
      projectiles: [...prev.projectiles, {
        id: `proj-${playerId}-${Date.now()}`,
        position: projectilePosition,
        direction: tank.direction,
        ownerId: playerId,
        damage: tank.firepower,
        speed: 0.2
      }]
    }));
  };

  const value = {
    gameState,
    players,
    tanks,
    score,
    currentLevel,
    isGameRunning,
    isPaused,
    powerUps,
    addPlayer,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    movePlayer,
    fireProjectile
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};