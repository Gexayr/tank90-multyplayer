import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  POWER_UP_COUNT,
  POWER_UP_TYPES,
  WALL_TYPES,
  INITIAL_LIVES,
  MAX_PLAYERS,
  GRID_SIZE
} from '../constants/gameConfig';
import { generateLevel } from '../utils/levelGenerator';
import { Tank, Direction, Player, PowerUpType, Bullet, Wall, PowerUp, Position } from '../types/gameTypes';
import WebSocketService from '../services/websocket';

export interface GameState {
  players: Map<string, Player>;
  bullets: Map<string, Bullet>;
  level: number[][];
  powerUps: PowerUp[];
  walls: Wall[];
  score: Record<string, number>;
  currentLevel: number;
  isGameRunning: boolean;
  isPaused: boolean;
}

interface GameContextType {
  gameState: GameState;
  players: Player[];
  tanks: Tank[];
  score: Record<string, number>;
  currentLevel: number;
  isGameRunning: boolean;
  isPaused: boolean;
  powerUps: PowerUp[];
  showPlayerInput: boolean;
  addPlayer: (playerName: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  movePlayer: (playerId: string, direction: Direction) => void;
  fireProjectile: (playerId: string) => void;
  togglePlayerInput: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};

const generateRandomPosition = (): Position => {
    return {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE)
  };
};

const isPositionOccupied = (
  position: Position,
  walls: Wall[],
  tanks: Tank[],
  powerUps: PowerUp[]
): boolean => {
  return (
    walls.some(wall => wall.position.x === position.x && wall.position.y === position.y) ||
    tanks.some(tank => tank.position.x === position.x && tank.position.y === position.y) ||
    powerUps.some(powerUp => powerUp.position.x === position.x && powerUp.position.y === position.y)
  );
};

const generateWalls = (): Wall[] => {
    const walls: Wall[] = [];
    const levelGrid = generateLevel(1); // Use the level generator

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (levelGrid[y][x] === 1) { // Assuming 1 represents a wall
                walls.push({
                    id: `wall-${x}-${y}`,
                    type: Math.random() < 0.7 ? WALL_TYPES.BRICK : WALL_TYPES.STEEL, // Random type for generated walls
                    position: { x, y },
                    health: 100, // Example health
                    damage: 0 // Example damage
                });
            }
        }
    }

    // Add some random power-ups (optional, based on design)
    // For now, we'll rely on the separate generatePowerUps function

    return walls;
};


const generatePowerUps = (existingWalls: Wall[], existingPlayers: Player[], count: number): PowerUp[] => {
  const powerUps: PowerUp[] = [];
  const types = Object.values(POWER_UP_TYPES);

  for (let i = 0; i < count; i++) {
    let position: Position;
    do {
      position = generateRandomPosition();
    } while (isPositionOccupied(position, existingWalls, existingPlayers, powerUps));

    powerUps.push({
      id: `powerup-${i}`,
      type: types[Math.floor(Math.random() * types.length)] as PowerUpType,
      position,
      duration: 10000
    });
  }
  return powerUps;
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>({
    players: new Map<string, Player>(),
    bullets: new Map<string, Bullet>(),
    level: [], // Initial level will be generated on game start
    powerUps: [],
    walls: [],
    score: {},
    currentLevel: 1,
    isGameRunning: false,
    isPaused: false
  });

  const [showPlayerInput, setShowPlayerInput] = useState<boolean>(true);

  const webSocketService = WebSocketService.getInstance();

  useEffect(() => {
    // Connect to WebSocket
    // webSocketService.connect('ws://localhost:3000'); // Replace with your server URL

    // Set up WebSocket event listeners
    // webSocketService.onGameStateUpdate((state: GameState) => {
    //   setGameState(state);
    // });

    // Clean up on component unmount
    return () => {
    //  webSocketService.disconnect();
    };
  }, [webSocketService]); // Re-run if webSocketService changes

  const addPlayer = useCallback((playerName: string) => {
    setGameState((prev: GameState) => {
      if (prev.players.size >= MAX_PLAYERS) {
        console.warn('Maximum number of players reached.');
        return prev;
      }

      const newPlayerId = `player-${Date.now()}`;
      const newPlayer: Player = {
        id: newPlayerId,
        name: playerName,
        score: 0,
        lives: INITIAL_LIVES,
        position: { x: 0, y: 0 }, // Temporary position
        direction: 'up',
        color: `hsl(${(prev.players.size * 90) % 360}, 70%, 50%)`,
        hasShield: false,
        hasSpeedBoost: false,
        hasFirepowerBoost: false
      };

      const newPlayers = new Map(prev.players);
      newPlayers.set(newPlayer.id, newPlayer);

      // Generate game elements
      const initialWalls = generateWalls();
      const initialPowerUps = generatePowerUps(initialWalls, Array.from(newPlayers.values()), POWER_UP_COUNT);

      // Assign random positions to all players
      newPlayers.forEach((player: Player) => {
        let position: Position;
        do {
          position = generateRandomPosition();
        } while (isPositionOccupied(position, initialWalls, Array.from(newPlayers.values()).filter((p: Player) => p.id !== player.id), initialPowerUps));
        player.position = position;
      });

      return {
        ...prev,
        players: newPlayers,
        score: { ...prev.score, [newPlayer.id]: 0 },
        level: generateLevel(prev.currentLevel),
        walls: initialWalls,
        powerUps: initialPowerUps,
        isGameRunning: true,
        isPaused: false
      };
    });
  }, []);

  const startGame = useCallback(() => {
    setGameState((prev: GameState) => {
      const initialWalls = generateWalls();
      const initialPowerUps = generatePowerUps(initialWalls, Array.from(prev.players.values()), POWER_UP_COUNT);

      // Assign random positions to players on game start, avoiding walls and power-ups
      const updatedPlayers = new Map(prev.players);
      updatedPlayers.forEach((player: Player) => {
        let position: Position;
        do {
          position = generateRandomPosition();
        } while (isPositionOccupied(position, initialWalls, Array.from(updatedPlayers.values()).filter((p: Player) => p.id !== player.id), initialPowerUps));
        player.position = position;
        // Initialize other player game state properties if they are not part of initial Player type
        // e.g., player.hasShield = false; etc. - ensure Player type includes these
      });

      return {
        ...prev,
        level: generateLevel(prev.currentLevel), // Generate level grid
        walls: initialWalls,
        powerUps: initialPowerUps,
        isGameRunning: true,
        isPaused: false,
        players: updatedPlayers // Update players with new positions
      };
    });
    // webSocketService.emit('startGame', { level: gameState.currentLevel }); // Emit event to server
  }, []);

/*  const pauseGame = useCallback(() => {
    setGameState((prev: GameState) => ({ ...prev, isPaused: true }));
    // webSocketService.emit('pauseGame'); // Emit event to server
  }, []);

  const resumeGame = useCallback(() => {
    setGameState((prev: GameState) => ({ ...prev, isPaused: false }));
    // webSocketService.emit('resumeGame'); // Emit event to server
  }, []);*/

/*  const restartGame = useCallback(() => {
    setGameState((prev: GameState) => ({
      ...prev,
      level: generateLevel(1), // Reset to level 1
      walls: generateWalls(), // Regenerate walls
      powerUps: generatePowerUps(generateWalls(), Array.from(prev.players.values()), POWER_UP_COUNT), // Regenerate power-ups
      bullets: new Map<string, Bullet>(), // Clear bullets
      score: Object.fromEntries(Array.from(prev.players.keys()).map(id => [id, 0])), // Reset scores
      currentLevel: 1, // Reset level
      isGameRunning: true, // Start game immediately after restart
      isPaused: false
    }));
    // webSocketService.emit('restartGame'); // Emit event to server
  }, []);*/

  const movePlayer = useCallback((playerId: string, direction: Direction) => {
    setGameState((prev: GameState) => {
      const player = prev.players.get(playerId);
      if (!player) return prev;

      const newPosition: Position = { ...player.position };

      // Calculate potential new position based on direction and speed (if applicable)
      const speed = player.hasSpeedBoost ? 2 : 1; // Example speed boost
      for (let i = 0; i < speed; i++) {
        const intermediatePosition = { ...newPosition };
         switch (direction) {
          case 'up':
            intermediatePosition.y = Math.max(0, intermediatePosition.y - 1);
            break;
          case 'right':
            intermediatePosition.x = Math.min(GRID_SIZE - 1, intermediatePosition.x + 1);
            break;
          case 'down':
            intermediatePosition.y = Math.min(GRID_SIZE - 1, intermediatePosition.y + 1);
            break;
          case 'left':
            intermediatePosition.x = Math.max(0, intermediatePosition.x - 1);
            break;
        }

        // Check for collisions at each step if speed > 1
        if (isPositionOccupied(intermediatePosition, prev.walls, Array.from(prev.players.values()).filter((p: Player) => p.id !== playerId), prev.powerUps)) {
          // If collision, stop moving in this direction
          break;
        } else {
            newPosition.x = intermediatePosition.x;
            newPosition.y = intermediatePosition.y;
        }
      }

      const newPlayers = new Map(prev.players);
      newPlayers.set(playerId, {
        ...player,
        position: newPosition,
        direction
      });

      // webSocketService.emit('playerMove', { id: playerId, position: newPosition, direction }); // Emit to server

      return {
        ...prev,
        players: newPlayers
      };
    });
  }, []);

  const fireProjectile = useCallback((playerId: string) => {
    setGameState((prev: GameState) => {
      const player = prev.players.get(playerId);
      if (!player) return prev;

      // Prevent firing if game is paused
      if (!prev.isGameRunning || prev.isPaused) return prev;

      const bulletId = `bullet-${Date.now()}-${playerId}`;
      const newBullets = new Map(prev.bullets);

      // Calculate initial bullet position based on tank position and direction
      const bulletPosition: Position = { ...player.position }; // Explicit type annotation
      switch (player.direction) {
          case 'up':
              bulletPosition.y -= 1; // Start bullet 1 unit away from tank
              break;
          case 'right':
              bulletPosition.x += 1; // Start bullet 1 unit away from tank
              break;
          case 'down':
              bulletPosition.y += 1; // Start bullet 1 unit away from tank
              break;
          case 'left':
              bulletPosition.x -= 1; // Start bullet 1 unit away from tank
              break;
      }

      // Check if initial bullet position is occupied (e.g., inside a wall)
      if (isPositionOccupied(bulletPosition, prev.walls, Array.from(prev.players.values()), prev.powerUps)) {
          return prev; // Don't fire if the initial position is occupied
      }

      newBullets.set(bulletId, {
        id: bulletId,
        position: bulletPosition,
        direction: player.direction,
        ownerId: playerId,
        damage: player.hasFirepowerBoost ? 20 : 10, // Example damage boost
        speed: player.hasFirepowerBoost ? 8 : 5 // Example speed boost
      });

      // webSocketService.emit('fireProjectile', { id: bulletId, position: bulletPosition, direction: player.direction, ownerId: playerId }); // Emit to server

      return {
        ...prev,
        bullets: newBullets
      };
    });
  }, []);

  // Game loop for updating bullets and checking collisions
  useEffect(() => {
    if (!gameState.isGameRunning || gameState.isPaused) return;

    const gameLoop = setInterval(() => {
      setGameState((prev: GameState) => {
        const newBullets = new Map(prev.bullets);
        const newWalls = [...prev.walls];
        const newPowerUps = [...prev.powerUps];
        const newPlayers = new Map(prev.players);
        const newScore = { ...prev.score };

        // Update bullets
        for (const [bulletId, bullet] of newBullets.entries()) {
          const newPosition: Position = { ...bullet.position };

          // Move bullet
          switch (bullet.direction) {
            case 'up':
              newPosition.y -= bullet.speed;
              break;
            case 'right':
              newPosition.x += bullet.speed;
              break;
            case 'down':
              newPosition.y += bullet.speed;
              break;
            case 'left':
              newPosition.x -= bullet.speed;
              break;
          }

          // Check for collisions with walls
          let hitWall = false;
          for (let i = newWalls.length - 1; i >= 0; i--) {
            const wall = newWalls[i];
            // Simple AABB collision check (requires refinement for precise collision)
            if (
              newPosition.x < wall.position.x + 1 &&
              newPosition.x + 1 > wall.position.x &&
              newPosition.y < wall.position.y + 1 &&
              newPosition.y + 1 > wall.position.y
            ) {
              if (wall.type === WALL_TYPES.BRICK) {
                wall.health -= bullet.damage;
                if (wall.health <= 0) {
                  newWalls.splice(i, 1);
                }
              } else if (wall.type === WALL_TYPES.STEEL) {
                  // Steel walls are indestructible to regular bullets
              }
              hitWall = true;
              newBullets.delete(bulletId); // Remove bullet on collision
              break;
            }
          }

          if (hitWall) continue; // If a wall was hit, move to the next bullet

          // Check for collisions with players (tanks)
          let hitPlayer = false;
          for (const [playerId, player] of newPlayers.entries()) {
              if (player.id !== bullet.ownerId) { // Don't hit the bullet's owner
                // Simple AABB collision check (requires refinement)
                if (
                    newPosition.x < player.position.x + 1 &&
                    newPosition.x + 1 > player.position.x &&
                    newPosition.y < player.position.y + 1 &&
                    newPosition.y + 1 > player.position.y
                ) {
                    if (!player.hasShield) {
                        player.lives -= 1;
                        if (player.lives <= 0) {
                            newPlayers.delete(playerId); // Remove player if lives are 0
                            // Handle game over condition if needed
                        }
                        // Award score to the bullet owner
                        newScore[bullet.ownerId] = (newScore[bullet.ownerId] || 0) + 100; // Example score
                    } else {
                        // Shield absorbed the hit, remove shield
                        player.hasShield = false;
                    }
                    hitPlayer = true;
                    newBullets.delete(bulletId); // Remove bullet on collision
                    break;
                }
              }
          }

           if (hitPlayer) continue; // If a player was hit, move to the next bullet

          // Check if bullet is out of bounds
          if (
            newPosition.x < 0 ||
            newPosition.x >= GRID_SIZE || // Use GRID_SIZE for bounds
            newPosition.y < 0 ||
            newPosition.y >= GRID_SIZE // Use GRID_SIZE for bounds
          ) {
            newBullets.delete(bulletId);
            continue;
          }

          // Update bullet position if no collision
          newBullets.set(bulletId, {
            ...bullet,
            position: newPosition
          });
        }

        // Check for power-up collection
        for (let i = newPowerUps.length - 1; i >= 0; i--) {
          const powerUp = newPowerUps[i];
          let collected = false;
          for (const [playerId, player] of newPlayers.entries()) {
            // Simple AABB collision check
            if (
              player.position.x < powerUp.position.x + 1 &&
              player.position.x + 1 > powerUp.position.x &&
              player.position.y < powerUp.position.y + 1 &&
              player.position.y + 1 > powerUp.position.y
            ) {
              // Apply power-up effect
              switch (powerUp.type) {
                case POWER_UP_TYPES.STAR:
                    // Example: Increase score
                    newScore[playerId] = (newScore[playerId] || 0) + 50;
                    break;
                case POWER_UP_TYPES.SHIELD:
                    player.hasShield = true;
                    setTimeout(() => {
                        setGameState((current: GameState) => {
                            const updatedPlayers = new Map(current.players);
                            const p = updatedPlayers.get(playerId);
                            if (p) { p.hasShield = false; }
                            return { ...current, players: updatedPlayers };
                        });
                    }, powerUp.duration);
                    break;
                case POWER_UP_TYPES.SPEED:
                    player.hasSpeedBoost = true;
                     setTimeout(() => {
                        setGameState((current: GameState) => {
                            const updatedPlayers = new Map(current.players);
                            const p = updatedPlayers.get(playerId);
                            if (p) { p.hasSpeedBoost = false; }
                            return { ...current, players: updatedPlayers };
                        });
                    }, powerUp.duration);
                    break;
                case POWER_UP_TYPES.FIREPOWER:
                    player.hasFirepowerBoost = true;
                     setTimeout(() => {
                        setGameState((current: GameState) => {
                            const updatedPlayers = new Map(current.players);
                            const p = updatedPlayers.get(playerId);
                            if (p) { p.hasFirepowerBoost = false; }
                            return { ...current, players: updatedPlayers };
                        });
                    }, powerUp.duration);
                    break;
              }
              collected = true;
              break; // A player collected it, no need to check other players
            }
          }

          if (collected) {
            newPowerUps.splice(i, 1); // Remove collected power-up
            // Optionally, spawn a new power-up after a delay or at a random time
          }
        }

        // Check for game over (e.g., only one player left or time runs out)
        if (newPlayers.size <= 1 && prev.isGameRunning) {
            setGameState((current: GameState) => ({ ...current, isGameRunning: false, isPaused: true }));
            // webSocketService.emit('gameOver', { winner: Array.from(newPlayers.values())[0]?.id });
        }

        return {
          ...prev,
          bullets: newBullets,
          walls: newWalls,
          powerUps: newPowerUps,
          players: newPlayers,
          score: newScore
        };
      });
    }, 1000 / 60); // Run at approximately 60 FPS

    return () => clearInterval(gameLoop);
  }, [gameState.isGameRunning, gameState.isPaused]); // Removed webSocketService from dependencies to prevent re-running effect on every state change

  // Synchronize local state to context values
  const playersArray = Array.from(gameState.players.values());

  // Convert Player[] to Tank[] for components that expect Tank objects (like GameField)
  const tanksArray: Tank[] = playersArray.map((player: Player) => ({
    id: player.id,
    // name is optional in Tank, use player name if available
    name: player.name,
    position: player.position,
    direction: player.direction,
    // Tank color might be different, using player color for now
    color: player.color,
    lives: player.lives,
    hasShield: player.hasShield,
    hasSpeedBoost: player.hasSpeedBoost,
    hasFirepowerBoost: player.hasFirepowerBoost
  }));

  return (
    <GameContext.Provider
      value={{
        gameState,
        players: playersArray,
        tanks: tanksArray, // Provide tanks array
        score: gameState.score,
        currentLevel: gameState.currentLevel,
        isGameRunning: gameState.isGameRunning,
        isPaused: gameState.isPaused,
        powerUps: gameState.powerUps, // Provide powerUps array from gameState
        showPlayerInput,
        addPlayer,
        startGame,
        // pauseGame,
        // resumeGame,
        // restartGame,
        movePlayer,
        fireProjectile,
        togglePlayerInput: () => setShowPlayerInput((prev: boolean) => !prev)
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

