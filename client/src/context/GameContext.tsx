import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { generateLevel } from '../utils/levelGenerator';
import { Tank, Direction, Player, PowerUpType } from '../types/gameTypes';
import { INITIAL_LIVES, MAX_PLAYERS, GRID_SIZE } from '../constants/gameConfig';
import { io, Socket } from 'socket.io-client';

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

// Расширяем интерфейс Player
interface ExtendedPlayer extends Player {
  position: { x: number; y: number };
  direction: Direction;
  color: string;
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
  
  const [players, setPlayers] = useState<PlayerArray>([]);
  const [tanks, setTanks] = useState<TankArray>([]);
  const [score, setScore] = useState<Record<string, number>>({});
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [isGameRunning, setIsGameRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [powerUps, setPowerUps] = useState<PowerUpArray>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server with ID:', newSocket.id);
      // При подключении всегда запрашиваем актуальное состояние игры
      newSocket.emit('request-game-state');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server, reason:', reason);
      if (reason === 'io server disconnect') {
        // Сервер отключил нас, пробуем переподключиться
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to server after', attemptNumber, 'attempts');
      newSocket.emit('request-game-state');
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to server');
    });

    newSocket.on('game-state', (data: { players: Player[]; tanks: Tank[] }) => {
      console.log('Received game state:', data);
      if (data.players) {
        setPlayers(data.players);
      }
      if (data.tanks) {
        setTanks(data.tanks);
      }
    });

    newSocket.on('player-join', (data: { player: ExtendedPlayer; tank: Tank }) => {
      console.log('Player joined:', data);
      if (!data || !data.player) return;
      
      setPlayers(prev => {
        if (!prev) return [data.player];
        if (prev.some(p => p.id === data.player.id)) {
          return prev;
        }
        return [...prev, data.player];
      });

      if (data.tank) {
        setTanks(prev => {
          if (!prev) return [data.tank];
          if (prev.some(t => t.id === data.tank.id)) {
            return prev;
          }
          return [...prev, data.tank];
        });
      }
    });

    newSocket.on('player-move', (data: { id: number; x: number; y: number; rotation: number }) => {
      console.log('Player moved:', data);
      if (!data) return;
      
      setTanks(prev => {
        if (!prev) return [];
        return prev.map(tank => 
          tank.id === data.id
            ? { ...tank, position: { x: data.x, y: data.y }, direction: getDirectionFromRotation(data.rotation) }
            : tank
        );
      });
    });

    newSocket.on('health-update', (data: { id: number; health: number }) => {
      setTanks((prev: Tank[]) =>
        prev.map((tank: Tank) =>
          tank.id === data.id ? { ...tank, health: data.health } : tank
        )
      );
    });

    newSocket.on('bullet-create', (bullet: Projectile) => {
      setGameState((prev: GameState) => ({
        ...prev,
        projectiles: [...prev.projectiles, bullet],
      }));
    });

    newSocket.on('bullet-remove', (bulletId: string) => {
      setGameState((prev: GameState) => ({
        ...prev,
        projectiles: prev.projectiles.filter((p: Projectile) => p.id !== bulletId),
      }));
    });

    newSocket.on('player-leave', (playerId: number) => {
      console.log('Player left:', playerId);
      if (!playerId) return;
      
      setPlayers(prev => prev ? prev.filter(p => p.id !== playerId) : []);
      setTanks(prev => prev ? prev.filter(t => t.id !== playerId) : []);
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

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
    if (!gameState?.walls || !tanks) return false;
    
    return gameState.walls.some((wall: Wall) => 
      wall.position.x === position.x && wall.position.y === position.y
    ) || tanks.some((tank: Tank) =>
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
      });

      return { ...prev, projectiles: updatedProjectiles };
    });
  };

  const updateTanks = () => {
    setTanks(prev => prev.map(tank => {
      if (tank.type === 'player') {
        // Update player tank logic here
      }
      return tank;
    }));
  };

  const checkCollisions = () => {
    // Collision detection logic here
  };

  const updatePowerUps = () => {
    setPowerUps(prev => prev.filter(powerUp => powerUp.duration > 0));
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
    if (players.length >= MAX_PLAYERS) return;

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
    
    if (socket) {
      socket.emit('player-join', { player: newPlayer, tank: newTank });
    }
  };

  const getPlayerColor = (playerId: number): string => {
    const colors = ['yellow', 'blue', 'red', 'green'];
    return colors[playerId % colors.length];
  };

  const startGame = () => {
    setIsGameRunning(true);
    setIsPaused(false);
    loadLevel(currentLevel);
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

    setTanks(prev => prev.map(tank => {
      if (tank.id === playerId) {
        const newPosition = { ...tank.position };
        switch (direction) {
          case 'up': newPosition.y -= 0.2; break;
          case 'right': newPosition.x += 0.2; break;
          case 'down': newPosition.y += 0.2; break;
          case 'left': newPosition.x -= 0.2; break;
        }
        return { ...tank, position: newPosition, direction, lastMoved: now };
      }
      return tank;
    }));

    if (socket) {
      const updatedTank = tanks.find(t => t.id === playerId);
      if (updatedTank) {
        socket.emit('player-move', { 
          id: playerId,
          x: updatedTank.position.x, 
          y: updatedTank.position.y, 
          rotation: getRotationFromDirection(direction)
        });
      }
    }
  };

  const getRotationFromDirection = (direction: Direction): number => {
    switch (direction) {
      case 'up': return 0;
      case 'right': return 90;
      case 'down': return 180;
      case 'left': return 270;
      default: return 0;
    }
  };

  const fireProjectile = (playerId: number) => {
    const tank = tanks.find(t => t.id === playerId);
    if (!tank || !tank.position) {
      console.error('Cannot fire: tank or tank position is undefined');
      return;
    }

    // Проверяем, прошло ли достаточно времени с последнего выстрела
    const now = Date.now();
    if (tank.lastFired && now - tank.lastFired < 333) { // 333ms = 3 выстрела в секунду
      return;
    }

    const projectile: Projectile = {
      id: `projectile-${Date.now()}`,
      position: { x: tank.position.x, y: tank.position.y },
      direction: tank.direction,
      ownerId: playerId,
      damage: 1,
      speed: 0.1
    };

    // Обновляем время последнего выстрела
    setTanks(prev => prev.map(t => 
      t.id === playerId ? { ...t, lastFired: now } : t
    ));

    setGameState(prev => ({
      ...prev,
      projectiles: [...prev.projectiles, projectile]
    }));

    if (socket) {
      socket.emit('player-shoot', { 
        x: projectile.position.x, 
        y: projectile.position.y, 
        direction: getDirectionVector(tank.direction)
      });
    }
  };

  const getDirectionVector = (direction: Direction): { x: number; y: number } => {
    switch (direction) {
      case 'up': return { x: 0, y: -1 };
      case 'right': return { x: 1, y: 0 };
      case 'down': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      default: return { x: 0, y: -1 };
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket && players) {
        socket.emit('player-leave', players.map(p => p.id));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket, players]);

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
        addPlayer,
        startGame,
        pauseGame,
        resumeGame,
        restartGame,
        movePlayer,
        fireProjectile
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