import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { generateLevel } from '../utils/levelGenerator';
import { Tank, Direction, Player, PowerUpType } from '../types/gameTypes';
import { INITIAL_LIVES, MAX_PLAYERS, GRID_SIZE } from '../constants/gameConfig';

// Определяем типы для всех параметров функций
type PlayerArray = Player[];
type TankArray = Tank[];
type PowerUpArray = PowerUp[];

// Define the shape of our context
interface GameContextType {
  gameState: GameState;
  players: PlayerArray;
  tanks: TankArray;
  score: Record<string, number>;
  currentLevel: number;
  isGameRunning: boolean;
  isPaused: boolean;
  powerUps: PowerUpArray;
  showPlayerInput: boolean;
  addPlayer: (playerName: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  movePlayer: (playerId: number, direction: Direction) => void;
  fireProjectile: (playerId: number) => void;
  togglePlayerInput: () => void;
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
  damage: number;
}

export interface PowerUp {
  id: string;
  position: { x: number; y: number };
  type: PowerUpType;
  duration: number;
}

// Расширяем интерфейс Player
interface ExtendedPlayer extends Player {
  position: { x: number; y: number };
  direction: Direction;
  color: string;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const LEVEL_COUNT = 5; // Укажите реальное количество уровней

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const initialGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    return {
      grid: initialGrid,
      projectiles: [],
      walls: []
    };
  });
  
  const [players, setPlayers] = useState<PlayerArray>([]);
  const [tanks, setTanks] = useState<TankArray>([]);
  const [score, setScore] = useState<Record<string, number>>({});
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [isGameRunning, setIsGameRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [powerUps, setPowerUps] = useState<PowerUpArray>([]);
  const [showPlayerInput, setShowPlayerInput] = useState<boolean>(true);

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

    // Initialize tanks if they don't exist
    if (!tanks || tanks.length === 0) {
      const initialTanks: Tank[] = players.map((player: Player, index: number) => ({
        id: player.id,
        type: 'player',
        position: getSpawnPosition(index),
        direction: 'up',
        health: 3,
        speed: 1,
        firepower: 1,
        fireRate: 1,
        lastFired: 0,
        shield: false,
        color: player.color
      }));
      setTanks(initialTanks);
    } else {
      // Reset tank positions
      setTanks(prev => 
        prev.map((tank: Tank, index: number) => ({
          ...tank,
          position: getSpawnPosition(index),
          direction: 'up',
          health: tank.type === 'player' ? 3 : 1,
          shield: false
        }))
      );
    }

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
            health: cell === 2 ? 2 : 2,
            damage: 0
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
      let attempts = 0;
      const maxAttempts = 10;

      do {
        // Генерируем целые координаты для бонуса
        position = {
          x: Math.floor(Math.random() * (GRID_SIZE - 4)) + 2,
          y: Math.floor(Math.random() * (GRID_SIZE - 4)) + 2
        };
        attempts++;
      } while (isPositionOccupied(position) && attempts < maxAttempts);

      if (attempts < maxAttempts) {
        newPowerUps.push({
          id: `powerup-${Date.now()}-${i}`,
          position,
          type: types[Math.floor(Math.random() * types.length)],
          duration: 10000
        });
      }
    }

    console.log('Generated powerups:', newPowerUps); // Добавляем лог
    setPowerUps(newPowerUps);
  };

  const isPositionOccupied = (position: { x: number; y: number }) => {
    if (!gameState?.walls || !tanks) return false;
    
    // Проверяем столкновение со стенами
    const wallCollision = gameState.walls.some((wall: Wall) => {
      return wall.position.x === position.x && wall.position.y === position.y;
    });

    // Проверяем столкновение с танками
    const tankCollision = tanks.some((tank: Tank) => {
      const tankX = Math.floor(tank.position.x);
      const tankY = Math.floor(tank.position.y);
      return tankX === position.x && tankY === position.y;
    });

    return wallCollision || tankCollision;
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
      }).filter(projectile => {
        // Проверяем столкновение со стенами
        const wallCollision = prev.walls.some(wall => {
          if (wall.type === 'forest') return false; // Лес не препятствие
          const dx = Math.abs(wall.position.x - projectile.position.x);
          const dy = Math.abs(wall.position.y - projectile.position.y);
          
          if (dx < 0.3 && dy < 0.3) {
            // Если стена разрушаемая (кирпичная)
            if (wall.type === 'brick') {
              // Увеличиваем счетчик урона
              wall.damage += projectile.damage;
              
              // Если полученный урон достиг половины здоровья, меняем внешний вид
              if (wall.damage >= wall.health / 2) {
                wall.health = 1; // Уменьшаем здоровье для визуального эффекта
              }
              
              // Если полученный урон достиг полного здоровья, удаляем стену
              if (wall.damage >= wall.health) {
                setGameState(current => ({
                  ...current,
                  walls: current.walls.filter(w => w.id !== wall.id)
                }));
              }
              return true; // Удаляем снаряд
            }
            // Если стена неразрушаемая (стальная)
            else if (wall.type === 'steel') {
              return true; // Удаляем снаряд
            }
          }
          return false;
        });

        // Проверяем попадание в ваш танк
        const yourTankHit = tanks.some(tank => {
          // Проверяем только попадание в ваш танк (первый танк)
          if (tank.id !== tanks[0].id) return false;
          
          const dx = Math.abs(tank.position.x - projectile.position.x);
          const dy = Math.abs(tank.position.y - projectile.position.y);
          
          if (dx < 0.3 && dy < 0.3) {
            // Завершаем игру
            setIsGameRunning(false);
            setShowPlayerInput(true);
            return true;
          }
          return false;
        });

        if (yourTankHit) {
          return true; // Удаляем снаряд
        }

        // Проверяем границы поля
        if (projectile.position.x < 0 || projectile.position.x >= GRID_SIZE ||
            projectile.position.y < 0 || projectile.position.y >= GRID_SIZE) {
          return false; // Удаляем снаряд
        }

        return !wallCollision;
      });

      return { ...prev, projectiles: updatedProjectiles };
    });
  };

  const updateTanks = () => {
    setTanks(prev => prev.map(tank => {
      if (tank.type === 'player') {
        // Обновляем состояние танка с учетом бонусов
        return {
          ...tank,
          speed: tank.speed || 1,
          shield: tank.shield || false,
          firepower: tank.firepower || 1
        };
      }
      return tank;
    }));
  };

  const checkCollisions = () => {
    // Создаем копию текущих бонусов
    const currentPowerUps = [...powerUps];
    const remainingPowerUps: PowerUp[] = [];

    // Проверяем каждый бонус
    currentPowerUps.forEach(powerUp => {
      let isCollected = false;

      // Проверяем столкновение с каждым танком
      tanks.forEach(tank => {
        // Проверяем расстояние между танком и бонусом
        const dx = Math.abs(tank.position.x - powerUp.position.x);
        const dy = Math.abs(tank.position.y - powerUp.position.y);
        
        // Если танк находится достаточно близко к бонусу (расстояние меньше 0.3)
        if (dx < 0.3 && dy < 0.3) {
          isCollected = true;
          console.log('Bonus collected:', powerUp.type, 'at position:', powerUp.position, 'tank position:', tank.position); // Добавляем лог
          
          // Добавляем эффект мигания
          setTanks(prev => prev.map(t => 
            t.id === tank.id ? { ...t, isFlashing: true, flashColor: getPowerUpColor(powerUp.type) } : t
          ));

          // Убираем эффект мигания через 1 секунду
          setTimeout(() => {
            setTanks(prev => prev.map(t => 
              t.id === tank.id ? { ...t, isFlashing: false, flashColor: undefined } : t
            ));
          }, 1000);
          
          // Применяем эффект бонуса
          switch (powerUp.type) {
            case 'speed':
              setTanks(prev => prev.map(t => 
                t.id === tank.id ? { ...t, speed: 2 } : t
              ));
              setTimeout(() => {
                setTanks(prev => prev.map(t => 
                  t.id === tank.id ? { ...t, speed: 1 } : t
                ));
              }, 10000);
              break;
            case 'shield':
              setTanks(prev => prev.map(t => 
                t.id === tank.id ? { ...t, shield: true } : t
              ));
              setTimeout(() => {
                setTanks(prev => prev.map(t => 
                  t.id === tank.id ? { ...t, shield: false } : t
                ));
              }, 10000);
              break;
            case 'firepower':
              setTanks(prev => prev.map(t => 
                t.id === tank.id ? { ...t, firepower: 2 } : t
              ));
              setTimeout(() => {
                setTanks(prev => prev.map(t => 
                  t.id === tank.id ? { ...t, firepower: 1 } : t
                ));
              }, 10000);
              break;
          }
        }
      });

      // Если бонус не был собран, добавляем его в список оставшихся
      if (!isCollected) {
        remainingPowerUps.push(powerUp);
      }
    });

    // Обновляем состояние бонусов только если есть изменения
    if (remainingPowerUps.length !== powerUps.length) {
      console.log('Updating powerups:', remainingPowerUps.length); // Добавляем лог
      setPowerUps(remainingPowerUps);
    }
  };

  // Функция для получения цвета бонуса
  const getPowerUpColor = (type: PowerUpType): string => {
    switch (type) {
      case 'speed': return '#00ff00'; // Зеленый
      case 'shield': return '#0000ff'; // Синий
      case 'firepower': return '#ff0000'; // Красный
      default: return '#ffffff'; // Белый
    }
  };

  const updatePowerUps = () => {
    // Обновляем длительность бонусов и удаляем истекшие
    const now = Date.now();
    setPowerUps(prev => prev.filter(powerUp => {
      // Проверяем, не истекло ли время действия бонуса
      if (powerUp.duration <= 0) {
        return false; // Удаляем бонус
      }
      return true; // Оставляем бонус
    }));
  };

  const checkGameConditions = () => {
    // Game condition checks here
  };

  const getDirectionFromRotation = (rotation: number): Direction => {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    if (normalizedRotation >= 315 || normalizedRotation < 45) return 'up';
    if (normalizedRotation >= 45 && normalizedRotation < 135) return 'right';
    if (normalizedRotation >= 135 && normalizedRotation < 225) return 'down';
    return 'left';
  };

  const addPlayer = (playerName: string) => {
    // Проверяем, есть ли уже игрок с таким именем
    if (players.some(player => player.name === playerName)) {
      console.log('Player with this name already exists');
      return;
    }

    // Проверяем максимальное количество игроков
    if (players.length >= MAX_PLAYERS) {
      console.log('Maximum number of players reached');
      return;
    }

    const playerId = Date.now();
    const newPlayer: ExtendedPlayer = {
      id: playerId,
      name: playerName,
      lives: INITIAL_LIVES,
      position: getSpawnPosition(players.length),
      direction: 'up',
      color: getPlayerColor(players.length)
    };

    const newTank: Tank = {
      id: playerId,
      type: 'player',
      position: newPlayer.position,
      direction: newPlayer.direction,
      health: 3,
      speed: 1,
      firepower: 1,
      fireRate: 1,
      lastFired: 0,
      shield: false,
      color: newPlayer.color
    };

    setPlayers(prev => [...prev, newPlayer]);
    setTanks(prev => [...prev, newTank]);
    setShowPlayerInput(false); // Скрываем поле ввода после добавления игрока
  };

  const getPlayerColor = (playerId: number): string => {
    const colors = ['yellow', 'blue', 'red', 'green'];
    return colors[playerId % colors.length];
  };

  const startGame = () => {
    const randomLevel = Math.floor(Math.random() * LEVEL_COUNT) + 1;
    setCurrentLevel(randomLevel);
    setIsGameRunning(true);
    setIsPaused(false);
    loadLevel(randomLevel);
  };

  const pauseGame = () => setIsPaused(true);
  const resumeGame = () => setIsPaused(false);

  const restartGame = () => {
    setCurrentLevel(1);
    setScore({});
    setPlayers([]);
    setTanks([]);
    setIsGameRunning(false);
    setIsPaused(false);
  };

  const movePlayer = (playerId: number, direction: Direction) => {
    const tank = tanks.find(t => t.id === playerId);
    if (!tank) return;

    const now = Date.now();
    if (tank.lastMoved && now - tank.lastMoved < 50) {
      return;
    }

    // Рассчитываем новую позицию с учетом скорости из бонуса
    const newPosition = { ...tank.position };
    const moveSpeed = 0.2 * (tank.speed || 1); // Умножаем базовую скорость на множитель из бонуса
    switch (direction) {
      case 'up': newPosition.y -= moveSpeed; break;
      case 'right': newPosition.x += moveSpeed; break;
      case 'down': newPosition.y += moveSpeed; break;
      case 'left': newPosition.x -= moveSpeed; break;
    }

    // Проверяем границы поля в направлении движения
    switch (direction) {
      case 'up':
        if (newPosition.y < 0) return;
        break;
      case 'right':
        if (newPosition.x >= GRID_SIZE - 0.9) return;
        break;
      case 'down':
        if (newPosition.y >= GRID_SIZE - 0.9) return;
        break;
      case 'left':
        if (newPosition.x < 0) return;
        break;
    }

    // Проверяем столкновение со стенами
    const wallCollision = gameState.walls.some(wall => {
      if (wall.type === 'forest') return false; // Лес не препятствие
      const dx = Math.abs(wall.position.x - newPosition.x);
      const dy = Math.abs(wall.position.y - newPosition.y);
      return dx < 0.9 && dy < 0.9;
    });
    if (wallCollision) {
      return;
    }

    // Проверяем столкновение с другими танками
    const tankCollision = tanks.some(otherTank => {
      if (otherTank.id === playerId) return false;
      const dx = Math.abs(otherTank.position.x - newPosition.x);
      const dy = Math.abs(otherTank.position.y - newPosition.y);
      return dx < 0.9 && dy < 0.9;
    });
    if (tankCollision) {
      return;
    }

    // Если все проверки пройдены, обновляем позицию
    setTanks(prev => prev.map(t => {
      if (t.id === playerId) {
        return { ...t, position: newPosition, direction, lastMoved: now };
      }
      return t;
    }));

    // Проверяем столкновение с бонусами после обновления позиции
    checkCollisions();
  };

  const fireProjectile = (playerId: number) => {
    const tank = tanks.find(t => t.id === playerId);
    if (!tank || !tank.position) {
      console.error('Cannot fire: tank or tank position is undefined');
      return;
    }

    const now = Date.now();
    if (tank.lastFired && now - tank.lastFired < 333) {
      return;
    }

    const projectile: Projectile = {
      id: `projectile-${Date.now()}`,
      position: { x: tank.position.x, y: tank.position.y },
      direction: tank.direction,
      ownerId: playerId,
      damage: tank.firepower, // Используем силу выстрелов из бонуса
      speed: 0.1
    };

    setTanks(prev => prev.map(t => 
      t.id === playerId ? { ...t, lastFired: now } : t
    ));

    setGameState(prev => ({
      ...prev,
      projectiles: [...prev.projectiles, projectile]
    }));
  };

  const togglePlayerInput = () => {
    setShowPlayerInput(prev => !prev);
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        players,
        tanks,
        score,
        currentLevel,
        isGameRunning,
        isPaused,
        powerUps,
        showPlayerInput,
        addPlayer,
        startGame,
        pauseGame,
        resumeGame,
        restartGame,
        movePlayer,
        fireProjectile,
        togglePlayerInput
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};