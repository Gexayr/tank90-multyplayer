import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import WebSocketService from '../services/websocket';
import { CommandBuffer } from '../game/CommandBuffer';
import { GameSimulation, TankState } from '../game/GameSimulation';
import { Camera } from '../game/Camera';
import { NetworkInterpolation } from '../game/NetworkInterpolation';
import './GameCanvas.css';

interface Bullet {
  sprite: PIXI.Graphics;
  id: string;
  playerId: string;
  direction: { x: number; y: number };
  speed: number;
}

interface Tank {
  sprite: PIXI.Graphics;
  rotation: number;
  id: string;
  health: number;
  maxHealth: number;
  healthBar: PIXI.Graphics;
  score: number;
  color: number;
  highlight?: PIXI.Graphics;
  interpolation?: NetworkInterpolation; // For remote tanks only
}

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const tanksRef = useRef<Map<string, Tank>>(new Map());
  const bulletsRef = useRef<Map<string, Bullet>>(new Map());
  const mapObjectsRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  // Touch/joystick controls
  const isTouchDevice = useMemo(() => typeof window !== 'undefined' && ('ontouchstart' in window || (navigator as any).maxTouchPoints > 0), []);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickCenter, setJoystickCenter] = useState<{ x: number; y: number } | null>(null);
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickAngleRef = useRef<number | null>(null);
  const joystickMagnitudeRef = useRef<number>(0);
  const joystickVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const SHOOT_BTN_SIZE = 80;
  const lastShotTimeRef = useRef<number>(0);
  const SHOT_COOLDOWN = 500; // milliseconds between shots

  // Calculate direction vector from rotation
  const getDirectionFromRotation = (rotation: number) => {
    return {
      x: Math.sin(rotation),
      y: -Math.cos(rotation),
    };
  };
  const wsService = WebSocketService.getInstance();
  const [localScore, setLocalScore] = useState(0);
  
  // Client-side prediction
  const commandBufferRef = useRef<CommandBuffer>(new CommandBuffer());
  const gameSimulationRef = useRef<GameSimulation>(new GameSimulation());
  const localTankStateRef = useRef<TankState | null>(null); // Predicted state for local player
  
  // Camera system
  const cameraRef = useRef<Camera | null>(null);
  
  // Minimap configuration
  const MINIMAP_WIDTH = 160; // fixed minimap size
  const MINIMAP_HEIGHT = 120;
  const WORLD_WIDTH = 4000;
  const WORLD_HEIGHT = 4000;
  const MINIMAP_SCALE_X = MINIMAP_WIDTH / WORLD_WIDTH;
  const MINIMAP_SCALE_Y = MINIMAP_HEIGHT / WORLD_HEIGHT;

  // Viewport/Camera configuration
  // Fixed viewport size - adjust based on your needs (1280x720 is a common game resolution)
  const VIEWPORT_WIDTH = 1280;
  const VIEWPORT_HEIGHT = 720;
  const ASPECT_RATIO = VIEWPORT_WIDTH / VIEWPORT_HEIGHT; // 16:9

  // Create health bar for tank
  const createHealthBar = (tank: Tank) => {
    const healthBar = new PIXI.Graphics();
    healthBar.beginFill(0x00ff00);
    healthBar.drawRect(-20, 30, 40, 5);
    healthBar.endFill();
    if (worldRef.current) {
      worldRef.current.addChild(healthBar);
      // Ensure health bar is drawn behind the tank
      healthBar.zIndex = 0;
    }
    return healthBar;
  };

  // Update health bar with animation
  const updateHealthBar = (tank: Tank) => {
    const healthPercentage = tank.health / tank.maxHealth;
    tank.healthBar.clear();
    tank.healthBar.beginFill(0x00ff00);
    tank.healthBar.drawRect(-20, 30, 40 * healthPercentage, 5);
    tank.healthBar.endFill();

    // Update position
    tank.healthBar.x = tank.sprite.x;
    tank.healthBar.y = tank.sprite.y;
    tank.healthBar.rotation = tank.sprite.rotation;
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Calculate responsive viewport size for mobile
    const isMobile = window.innerWidth <= 768;
    let viewportWidth = VIEWPORT_WIDTH;
    let viewportHeight = VIEWPORT_HEIGHT;

    if (isMobile) {
      // On mobile, calculate size to fill screen while maintaining aspect ratio
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Try width-based scaling first
      let calculatedWidth = screenWidth;
      let calculatedHeight = screenWidth / ASPECT_RATIO;
      
      // If height-based scaling is smaller, use that instead
      if (screenHeight / ASPECT_RATIO < calculatedWidth) {
        calculatedHeight = screenHeight;
        calculatedWidth = screenHeight * ASPECT_RATIO;
      }
      
      viewportWidth = calculatedWidth;
      viewportHeight = calculatedHeight;
    }

    // Initialize camera system (use actual viewport size)
    cameraRef.current = new Camera({
      viewportWidth: viewportWidth,
      viewportHeight: viewportHeight,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });

    // Create PIXI Application with responsive viewport size
    const app = new PIXI.Application({
      width: viewportWidth,
      height: viewportHeight,
      backgroundColor: 0x000000,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true, // Handle high DPI displays
    });

    // Ensure we can control draw order via zIndex
    app.stage.sortableChildren = true;

    // Add canvas to DOM
    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // Create world container and background grid across full world
    const world = new PIXI.Container();
    world.sortableChildren = true;
    app.stage.addChild(world);
    worldRef.current = world;

    const grid = new PIXI.Graphics();
    const gridSize = 40; // size of each cell
    grid.lineStyle(1, 0x444444, 0.4);
    for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
      grid.moveTo(x + 0.5, 0);
      grid.lineTo(x + 0.5, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
      grid.moveTo(0, y + 0.5);
      grid.lineTo(WORLD_WIDTH, y + 0.5);
    }
    grid.zIndex = -10; // behind everything
    world.addChild(grid);

    // Create map object rendering function
    const createMapObject = (obj: any) => {
      if (mapObjectsRef.current.has(obj.id)) {
        return; // Already exists
      }

      const sprite = new PIXI.Graphics();
      sprite.x = obj.x;
      sprite.y = obj.y;
      sprite.zIndex = -5; // Behind tanks but above grid

      switch (obj.type) {
        case 'brick_wall':
          if (!obj.destroyed) {
            // Brown/red brick pattern
            sprite.beginFill(0x8B4513); // Brown
            sprite.drawRect(0, 0, obj.width, obj.height);
            sprite.endFill();
            // Brick pattern lines
            sprite.lineStyle(1, 0x654321, 0.5);
            sprite.moveTo(obj.width / 2, 0);
            sprite.lineTo(obj.width / 2, obj.height);
            sprite.moveTo(0, obj.height / 2);
            sprite.lineTo(obj.width, obj.height / 2);
            sprite.lineStyle(0); // Reset line style
          }
          break;

        case 'concrete_wall':
          // Gray concrete
          sprite.beginFill(0x808080); // Gray
          sprite.drawRect(0, 0, obj.width, obj.height);
          sprite.endFill();
          // Concrete texture lines
          sprite.lineStyle(1, 0x606060, 0.3);
          for (let i = 0; i < 4; i++) {
            sprite.moveTo((i * obj.width) / 4, 0);
            sprite.lineTo((i * obj.width) / 4, obj.height);
          }
          sprite.lineStyle(0); // Reset line style
          break;

        case 'water':
          // Blue water with wave pattern
          sprite.beginFill(0x4169E1); // Royal blue
          sprite.drawRect(0, 0, obj.width, obj.height);
          sprite.endFill();
          // Wave pattern
          sprite.lineStyle(1, 0x1E90FF, 0.4);
          for (let i = 0; i < 3; i++) {
            const waveY = (obj.height / 3) * (i + 1);
            sprite.moveTo(0, waveY);
            for (let x = 0; x <= obj.width; x += 5) {
              const waveOffset = Math.sin((x / obj.width) * Math.PI * 2) * 2;
              sprite.lineTo(x, waveY + waveOffset);
            }
          }
          sprite.lineStyle(0); // Reset line style
          break;

        case 'tree':
          // Green tree (circle for simplicity)
          sprite.beginFill(0x228B22); // Forest green
          sprite.drawCircle(obj.width / 2, obj.height / 2, obj.width / 2 - 2);
          sprite.endFill();
          // Tree trunk
          sprite.beginFill(0x8B4513); // Brown trunk
          sprite.drawRect(obj.width / 2 - 4, obj.height / 2, 8, obj.height / 2);
          sprite.endFill();
          sprite.zIndex = 0.5; // Trees are above ground but tanks can go under
          break;
      }

      // Only add to world if not destroyed (for brick walls) or if it's another type
      if (obj.type === 'brick_wall' && obj.destroyed) {
        // Don't render destroyed brick walls
        return;
      }
      
      world.addChild(sprite);
      mapObjectsRef.current.set(obj.id, sprite);
    };

    // Update map object (for destruction)
    const updateMapObject = (objId: string, destroyed: boolean) => {
      const sprite = mapObjectsRef.current.get(objId);
      if (sprite) {
        if (destroyed) {
          sprite.visible = false;
        }
      }
    };

    // Connect to WebSocket server
    wsService.connect();

    // Minimap drawing (HTML canvas overlay)
    const drawMinimap = () => {
      const canvas = minimapRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Resize in case CSS changed pixel ratio
      if (canvas.width !== MINIMAP_WIDTH || canvas.height !== MINIMAP_HEIGHT) {
        canvas.width = MINIMAP_WIDTH;
        canvas.height = MINIMAP_HEIGHT;
      }

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background (semi-transparent dark)
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid (optional, very light)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      const cellX = 40 * MINIMAP_SCALE_X;
      const cellY = 40 * MINIMAP_SCALE_Y;
      for (let x = 0; x <= canvas.width; x += cellX) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += cellY) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(canvas.width, y + 0.5);
        ctx.stroke();
      }

      // Draw players
      tanksRef.current.forEach((t) => {
        const x = t.sprite.x * MINIMAP_SCALE_X;
        const y = t.sprite.y * MINIMAP_SCALE_Y;
        const isLocal = wsService.getSocketId() && t.id === wsService.getSocketId();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t.rotation);
        // body
        ctx.fillStyle = `#${t.color.toString(16).padStart(6,'0')}`;
        ctx.fillRect(-3, -3, 6, 6);
        // direction tip
        ctx.fillStyle = isLocal ? 'rgba(255,255,0,0.9)' : 'rgba(255,0,0,0.9)';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-2, -2);
        ctx.lineTo(2, -2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // Draw map objects on minimap
      mapObjectsRef.current.forEach((sprite, objId) => {
        if (!sprite.visible) return;
        
        const bounds = sprite.getBounds();
        const objX = bounds.x * MINIMAP_SCALE_X;
        const objY = bounds.y * MINIMAP_SCALE_Y;
        const objW = bounds.width * MINIMAP_SCALE_X;
        const objH = bounds.height * MINIMAP_SCALE_Y;
        
        ctx.save();
        if (objId.startsWith('brick-wall')) {
          ctx.fillStyle = 'rgba(139, 69, 19, 0.6)'; // Brown
        } else if (objId.startsWith('concrete')) {
          ctx.fillStyle = 'rgba(128, 128, 128, 0.6)'; // Gray
        } else if (objId.startsWith('water')) {
          ctx.fillStyle = 'rgba(65, 105, 225, 0.5)'; // Blue
        } else if (objId.startsWith('tree')) {
          ctx.fillStyle = 'rgba(34, 139, 34, 0.5)'; // Green
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        }
        ctx.fillRect(objX, objY, objW, objH);
        ctx.restore();
      });

      // Draw bullets
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      bulletsRef.current.forEach((b) => {
        const x = b.sprite.x * MINIMAP_SCALE_X;
        const y = b.sprite.y * MINIMAP_SCALE_Y;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    };

    // Helper to create or remove highlight for local tank
    const ensureHighlightState = (tank: Tank) => {
      const localId = wsService.getSocketId();
      const isLocal = localId && tank.id === localId;
      if (isLocal) {
        if (!tank.highlight && appRef.current) {
          const hl = new PIXI.Graphics();
          hl.lineStyle(0.8, 0xffff00, 0.5);
          hl.drawRoundedRect(-23, -23, 46, 46, 8);
          hl.zIndex = 0.75; // between health bar and tank
          (worldRef.current || app.stage).addChild(hl);
          tank.highlight = hl;
        }
      } else {
        if (tank.highlight) {
          if (worldRef.current) {
            worldRef.current.removeChild(tank.highlight);
          }
          tank.highlight.destroy();
          delete tank.highlight;
        }
      }
      // Sync position if exists
      if (tank.highlight) {
        tank.highlight.x = tank.sprite.x;
        tank.highlight.y = tank.sprite.y;
        tank.highlight.rotation = tank.sprite.rotation;
      }
    };

    // Create tank function
    const createTank = (id: string, x: number, y: number, color: number, health: number, score: number) => {
      const tank = new PIXI.Graphics();
      tank.beginFill(color);
      tank.drawRect(-20, -20, 40, 40); // Center the tank
      tank.endFill();
      
      // Add direction indicator (triangle)
      tank.beginFill(0xff0000);
      tank.moveTo(0, -25);
      tank.lineTo(-5, -15);
      tank.lineTo(5, -15);
      tank.endFill();
      
      tank.x = x;
      tank.y = y;
      // Ensure tank draws above health bar
      tank.zIndex = 1;
      (worldRef.current || app.stage).addChild(tank);

      const localId = wsService.getSocketId();
      const isLocal = localId && id === localId;

      const newTank: Tank = {
        sprite: tank,
        rotation: 0,
        id,
        health,
        maxHealth: 100,
        healthBar: new PIXI.Graphics(),
        score,
        color,
        // Initialize interpolation for remote tanks only
        interpolation: isLocal ? undefined : new NetworkInterpolation(100),
      };
      newTank.healthBar = createHealthBar(newTank);

      tanksRef.current.set(id, newTank);
      updateHealthBar(newTank);
      ensureHighlightState(newTank);
    };

    // Create bullet function
    const createBullet = (id: string, x: number, y: number, color: number, playerId: string, direction: { x: number; y: number }, speed: number) => {
      const bullet = new PIXI.Graphics();
      bullet.beginFill(color);
      bullet.drawCircle(0, 0, 4);
      bullet.endFill();
      bullet.x = x;
      bullet.y = y;
      bullet.zIndex = 2; // Bullets above everything
      (worldRef.current || app.stage).addChild(bullet);

      bulletsRef.current.set(id, {
        sprite: bullet,
        id,
        playerId,
        direction,
        speed: speed || 5, // Use provided speed or default to 5 (reduced from 10)
      });
    };


    // WebSocket event handlers
    wsService.onPlayerJoin((player) => {
      createTank(player.id, player.x, player.y, player.color, player.health, player.score);
      
      // Initialize local state if this is the local player
      const localId = wsService.getSocketId();
      if (localId && player.id === localId) {
        const localTank = tanksRef.current.get(localId);
        if (localTank) {
          localTankStateRef.current = {
            x: localTank.sprite.x,
            y: localTank.sprite.y,
            rotation: localTank.rotation,
          };
        }
      }
    });

    // Map objects handler
    // wsService.onMapObjects((objects) => {
    //   objects.forEach((obj: any) => {
    //     createMapObject(obj);
    //   });
    // });

    // Map update handler (for destroyed walls)
    // wsService.onMapUpdate((data) => {
    //   updateMapObject(data.objectId, data.destroyed);
    // });

    // Also handle map objects from game state
    wsService.onGameStateUpdate((state) => {
      const localId = wsService.getSocketId();
      const updateTimestamp = performance.now();
      
      // Create tanks for all players
      state.players.forEach((player: any) => {
        if (!tanksRef.current.has(player.id)) {
          createTank(player.id, player.x, player.y, player.color, player.health, player.score);
          // For newly created remote tanks, add initial state to interpolation buffer
          if (player.id !== localId) {
            const t = tanksRef.current.get(player.id);
            if (t && t.interpolation) {
              t.interpolation.addState({
                x: player.x,
                y: player.y,
                rotation: player.rotation,
                timestamp: updateTimestamp,
              });
            }
          }
        } else {
          const t = tanksRef.current.get(player.id)!;
          ensureHighlightState(t);
          
          // For remote players, add their state to interpolation buffer
          // This ensures state updates are interpolated smoothly
          if (player.id !== localId && t.interpolation) {
            t.interpolation.addState({
              x: player.x,
              y: player.y,
              rotation: player.rotation,
              timestamp: updateTimestamp,
            });
          }
        }
      });

      // Create bullets
      state.bullets.forEach((bullet: any) => {
        if (!bulletsRef.current.has(bullet.id)) {
          const tank = tanksRef.current.get(bullet.playerId);
          if (tank) {
            const color = 0xFFFFFF;
            createBullet(bullet.id, bullet.x, bullet.y, color, bullet.playerId, bullet.direction, bullet.speed);
          }
        }
      });

      // Create map objects if present
      if (state.mapObjects) {
        state.mapObjects.forEach((obj: any) => {
          createMapObject(obj);
        });
      }
    });

    wsService.onPlayerLeave((playerId) => {
      const tank = tanksRef.current.get(playerId);
      if (tank) {
        if (worldRef.current) {
          worldRef.current.removeChild(tank.sprite);
          worldRef.current.removeChild(tank.healthBar);
          if (tank.highlight) {
            worldRef.current.removeChild(tank.highlight);
            tank.highlight.destroy();
          }
        }
        tanksRef.current.delete(playerId);
      }
    });

    // Handle player move for remote players only (local player uses prediction)
    wsService.onPlayerMove((data) => {
      const localId = wsService.getSocketId();
      // Skip if this is the local player - we use prediction instead
      if (data.id === localId) {
        return;
      }
      
      const tank = tanksRef.current.get(data.id);
      if (tank) {
        // Initialize interpolation if not exists
        if (!tank.interpolation) {
          tank.interpolation = new NetworkInterpolation(100); // 100ms interpolation delay
        }

        // Add server state to interpolation buffer with high-precision timestamp
        // Use performance.now() for better accuracy than Date.now()
        tank.interpolation.addState({
          x: data.x,
          y: data.y,
          rotation: data.rotation,
          timestamp: performance.now(), // High-precision timestamp
        });
      }
    });

    wsService.onGameStateUpdate((state) => {
      // Create tanks for all players
      state.players.forEach((player: any) => {
        if (!tanksRef.current.has(player.id)) {
          createTank(player.id, player.x, player.y, player.color, player.health, player.score);
        } else {
          const t = tanksRef.current.get(player.id)!;
          ensureHighlightState(t);
        }
      });

      // Create bullets
      state.bullets.forEach((bullet: any) => {
        if (!bulletsRef.current.has(bullet.id)) {
          const tank = tanksRef.current.get(bullet.playerId);
          if (tank) {
            const color = 0xFFFFFF;
            createBullet(bullet.id, bullet.x, bullet.y, color, bullet.playerId, bullet.direction, bullet.speed);
          }
        }
      });
    });

    // Handle state updates with command confirmation (reconciliation)
    wsService.onStateUpdate((data) => {
      const localId = wsService.getSocketId();
      if (!localId) return;

      // Capture timestamp once for all players in this update (ensures consistency)
      const updateTimestamp = performance.now();

      // Update remote players with interpolation
      data.players.forEach((player: any) => {
        if (player.id !== localId) {
          const tank = tanksRef.current.get(player.id);
          if (tank) {
            // Initialize interpolation if not exists
            if (!tank.interpolation) {
              tank.interpolation = new NetworkInterpolation(100); // 100ms interpolation delay
            }

            // Add server state to interpolation buffer with high-precision timestamp
            // All players in the same update get the same timestamp for consistency
            tank.interpolation.addState({
              x: player.x,
              y: player.y,
              rotation: player.rotation,
              timestamp: updateTimestamp, // High-precision timestamp, consistent for all players
            });
          }
        }
      });

      // Reconciliation for local player
      const localTank = tanksRef.current.get(localId);
      if (localTank && data.latestConfirmedCommandId !== undefined) {
        // If server sent authoritative state (collision or event), use it
        if (data.authoritativeState) {
          localTankStateRef.current = {
            x: data.authoritativeState.x,
            y: data.authoritativeState.y,
            rotation: data.authoritativeState.rotation,
          };
        } else {
          // Find the server's state for local player
          const serverPlayer = data.players.find((p: any) => p.id === localId);
          if (serverPlayer) {
            localTankStateRef.current = {
              x: serverPlayer.x,
              y: serverPlayer.y,
              rotation: serverPlayer.rotation,
            };
          }
        }

        // Re-simulate unconfirmed commands
        if (localTankStateRef.current) {
          const unconfirmedCommands = commandBufferRef.current.getUnconfirmedCommands(data.latestConfirmedCommandId);
          const reconciledState = gameSimulationRef.current.reSimulateCommands(
            localTankStateRef.current,
            unconfirmedCommands
          );

          // Update local tank with reconciled state
          localTank.sprite.x = reconciledState.x;
          localTank.sprite.y = reconciledState.y;
          localTank.rotation = reconciledState.rotation;
          localTank.sprite.rotation = reconciledState.rotation;
          updateHealthBar(localTank);
          ensureHighlightState(localTank);
        }

        // Remove confirmed commands from buffer
        commandBufferRef.current.removeConfirmedCommands(data.latestConfirmedCommandId);
      }

      // Update bullets
      data.bullets.forEach((bullet: any) => {
        if (!bulletsRef.current.has(bullet.id)) {
          const tank = tanksRef.current.get(bullet.playerId);
          if (tank) {
            const color = 0xFFFFFF;
            createBullet(bullet.id, bullet.x, bullet.y, color, bullet.playerId, bullet.direction, bullet.speed);
          }
        }
      });
    });

    wsService.onBulletCreate((bullet) => {
      const tank = tanksRef.current.get(bullet.playerId);
      if (tank) {
        const color = 0xFFFFFF;
        createBullet(bullet.id, bullet.x, bullet.y, color, bullet.playerId, bullet.direction, bullet.speed);
      }
    });

    wsService.onBulletRemove((bulletId) => {
      const bullet = bulletsRef.current.get(bulletId);
      if (bullet) {
        if (worldRef.current) {
          worldRef.current.removeChild(bullet.sprite);
        }
        bulletsRef.current.delete(bulletId);
      }
    });

    wsService.onHealthUpdate((data) => {
      const tank = tanksRef.current.get(data.id);
      if (tank) {
        tank.health = data.health;
        updateHealthBar(tank);
      }
    });

    wsService.onScoreUpdate((data) => {
      const tank = tanksRef.current.get(data.playerId);
      if (tank) {
        tank.score = data.score;
        if (tank.id === wsService.getSocketId()) {
          setLocalScore(tank.score);
        }
      }
    });

    // Keyboard event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore period key to prevent interference with game controls
      if (e.key === '.' || e.key === 'Period') {
        e.preventDefault();
        return;
      }

      keysRef.current[e.key] = true;

      // Handle shooting (Spacebar or F key)
      if ((e.key === ' ' || e.key === 'f' || e.key === 'F') && Date.now() - lastShotTimeRef.current > SHOT_COOLDOWN) {
        const localId = wsService.getSocketId();
        const localTank = localId ? tanksRef.current.get(localId) : null;
        if (localTank && localTankStateRef.current) {
          const direction = getDirectionFromRotation(localTankStateRef.current.rotation);
          wsService.sendPlayerShoot(
            localTankStateRef.current.x + direction.x * 25,
            localTankStateRef.current.y + direction.y * 25,
            direction
          );
          lastShotTimeRef.current = Date.now();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Ignore period key
      if (e.key === '.' || e.key === 'Period') {
        return;
      }
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop with client-side prediction
    const gameLoop = () => {
      // Update local player with immediate prediction
      const localId = wsService.getSocketId();
      const localTankLoop = localId ? tanksRef.current.get(localId) : null;
      if (localTankLoop) {
        // Initialize local state if not set
        if (!localTankStateRef.current) {
          localTankStateRef.current = {
            x: localTankLoop.sprite.x,
            y: localTankLoop.sprite.y,
            rotation: localTankLoop.rotation,
          };
        }

        let inputChanged = false;
        let newRotation = localTankStateRef.current.rotation;
        let direction: 'forward' | 'backward' | undefined = undefined;

        // Keyboard controls (desktop)
        if (!isTouchDevice) {
          // Rotation input
          if (keysRef.current['ArrowLeft'] || keysRef.current['ArrowRight']) {
            newRotation = gameSimulationRef.current.calculateRotation(
              localTankStateRef.current.rotation,
              keysRef.current['ArrowLeft'],
              keysRef.current['ArrowRight']
            );
            inputChanged = true;
          }

          // Movement input
          if (keysRef.current['ArrowUp']) {
            direction = 'forward';
            inputChanged = true;
          } else if (keysRef.current['ArrowDown']) {
            direction = 'backward';
            inputChanged = true;
          }
        } else {
          // Touch joystick controls (mobile)
          const mag = joystickMagnitudeRef.current;
          const vec = joystickVecRef.current;
          if (mag > 0.05) {
            const targetRot = Math.atan2(vec.x, -vec.y);
            newRotation = targetRot;
            direction = mag > 0.2 ? 'forward' : undefined;
            inputChanged = true;
          }
        }

        // If input changed, immediately predict and send command
        if (inputChanged) {
          // Create command and add to buffer
          const commandId = commandBufferRef.current.addCommand(newRotation, direction);

          // Immediately apply prediction locally
          const command = commandBufferRef.current.getAllCommands().find(c => c.commandId === commandId);
          if (command && localTankStateRef.current) {
            localTankStateRef.current = gameSimulationRef.current.applyCommand(
              localTankStateRef.current,
              command
            );

            // Update visual representation immediately
            localTankLoop.sprite.x = localTankStateRef.current.x;
            localTankLoop.sprite.y = localTankStateRef.current.y;
            localTankLoop.rotation = localTankStateRef.current.rotation;
            localTankLoop.sprite.rotation = localTankStateRef.current.rotation;
            updateHealthBar(localTankLoop);
            ensureHighlightState(localTankLoop);
          }

          // Send command to server (only input data + command ID)
          wsService.sendPlayerMove(commandId, newRotation, direction);
        } else if (localTankStateRef.current) {
          // Keep visual in sync with predicted state even when no new input
          localTankLoop.sprite.x = localTankStateRef.current.x;
          localTankLoop.sprite.y = localTankStateRef.current.y;
          localTankLoop.rotation = localTankStateRef.current.rotation;
          localTankLoop.sprite.rotation = localTankStateRef.current.rotation;
        }
      }

      // Update remote tanks with interpolation and tree transparency
      // Use performance.now() for high-precision timing (better for smooth animation)
      const currentTime = performance.now();
      const localIdForInterpolation = wsService.getSocketId();
      tanksRef.current.forEach((tank) => {
        // Skip local tank (uses prediction)
        if (tank.id === localIdForInterpolation) {
          return;
        }

        // Apply interpolation for remote tanks
        if (tank.interpolation) {
          // Get interpolated state at current time (with delay built into interpolation)
          const interpolated = tank.interpolation.getInterpolatedState(currentTime);
          if (interpolated) {
            // Smoothly update visual position using interpolated state
            tank.sprite.x = interpolated.x;
            tank.sprite.y = interpolated.y;
            tank.rotation = interpolated.rotation;
            tank.sprite.rotation = interpolated.rotation;
            updateHealthBar(tank);
            ensureHighlightState(tank);
          }

          // Clean up old interpolation states (keep last 2 seconds of history)
          // This prevents memory buildup while maintaining enough history for smooth interpolation
          tank.interpolation.clearOldStates(currentTime, 2000);
        } else {
          // If interpolation is not initialized, initialize it
          // This can happen if a tank was created before interpolation was set up
          tank.interpolation = new NetworkInterpolation(100);
        }

        // Check if tank is under a tree (for transparency)
        let underTree = false;
        mapObjectsRef.current.forEach((treeSprite, objId) => {
          if (objId.startsWith('tree-') && treeSprite.visible) {
            // Simple collision check - if tank center is within tree bounds
            const treeBounds = treeSprite.getBounds();
            const tankCenterX = tank.sprite.x;
            const tankCenterY = tank.sprite.y;
            if (tankCenterX >= treeBounds.x && tankCenterX < treeBounds.x + treeBounds.width &&
                tankCenterY >= treeBounds.y && tankCenterY < treeBounds.y + treeBounds.height) {
              underTree = true;
            }
          }
        });

        // Apply transparency if under tree
        if (underTree) {
          tank.sprite.alpha = 0.5;
          if (tank.highlight) {
            tank.highlight.alpha = 0.5;
          }
        } else {
          tank.sprite.alpha = 1.0;
          if (tank.highlight) {
            tank.highlight.alpha = 1.0;
          }
        }
      });

      // Also check local tank for tree transparency
      const localTank = localId ? tanksRef.current.get(localId) : null;
      if (localTank && localTankStateRef.current) {
        let underTree = false;
        mapObjectsRef.current.forEach((treeSprite, objId) => {
          if (objId.startsWith('tree-') && treeSprite.visible) {
            const treeBounds = treeSprite.getBounds();
            const tankCenterX = localTankStateRef.current!.x;
            const tankCenterY = localTankStateRef.current!.y;
            if (tankCenterX >= treeBounds.x && tankCenterX < treeBounds.x + treeBounds.width &&
                tankCenterY >= treeBounds.y && tankCenterY < treeBounds.y + treeBounds.height) {
              underTree = true;
            }
          }
        });

        if (underTree) {
          localTank.sprite.alpha = 0.5;
          if (localTank.highlight) {
            localTank.highlight.alpha = 0.5;
          }
        } else {
          localTank.sprite.alpha = 1.0;
          if (localTank.highlight) {
            localTank.highlight.alpha = 1.0;
          }
        }
      }

      // Keep highlight synced (in case socket id becomes available later)
      tanksRef.current.forEach((t) => ensureHighlightState(t));

      // Advance bullets locally so their movement is visible between server events
      bulletsRef.current.forEach((b) => {
        b.sprite.x += b.direction.x * b.speed;
        b.sprite.y += b.direction.y * b.speed;
      });

      // Camera follow: center on local tank with boundary clamping
      if (appRef.current && worldRef.current && cameraRef.current) {
        const world = worldRef.current;
        const camera = cameraRef.current;
        const localId = wsService.getSocketId();
        
        // Use predicted state for camera tracking (most accurate)
        if (localId && localTankStateRef.current) {
          const cameraOffset = camera.follow(
            localTankStateRef.current.x,
            localTankStateRef.current.y
          );
          
          // Apply camera offset to world container
          // Negative because we move the world opposite to the camera movement
          world.x = cameraOffset.x;
          world.y = cameraOffset.y;
        } else {
          // Fallback to sprite position if predicted state not available
          const localTank = localId ? tanksRef.current.get(localId) : null;
          if (localTank) {
            const cameraOffset = camera.follow(
              localTank.sprite.x,
              localTank.sprite.y
            );
            world.x = cameraOffset.x;
            world.y = cameraOffset.y;
          }
        }
      }

      // Draw minimap overlay
      drawMinimap();
    };

    // Resize handler - responsive viewport on mobile
    const handleResize = () => {
      const isMobileNow = window.innerWidth <= 768;
      if (isMobileNow && appRef.current) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Calculate size to fill screen while maintaining aspect ratio
        let calculatedWidth = screenWidth;
        let calculatedHeight = screenWidth / ASPECT_RATIO;
        
        if (screenHeight / ASPECT_RATIO < calculatedWidth) {
          calculatedHeight = screenHeight;
          calculatedWidth = screenHeight * ASPECT_RATIO;
        }
        
        appRef.current.renderer.resize(calculatedWidth, calculatedHeight);
        
        // Update camera viewport size
        if (cameraRef.current) {
          cameraRef.current.setViewportSize(calculatedWidth, calculatedHeight);
        }
      } else if (!isMobileNow && appRef.current) {
        // Desktop: use fixed size
        appRef.current.renderer.resize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
        if (cameraRef.current) {
          cameraRef.current.setViewportSize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // Add game loop to PIXI ticker
    app.ticker.add(gameLoop);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      app.ticker.remove(gameLoop);
      wsService.disconnect();
      if (appRef.current) {
        // Clean up all tank-related graphics
        tanksRef.current.forEach((t) => {
          if (t.highlight) t.highlight.destroy();
          t.healthBar.destroy();
          t.sprite.destroy();
        });
        appRef.current.destroy(true, true);
      }
    };
  }, []);

  return (
    <div className="game-canvas-wrapper">
      <div
        ref={canvasRef}
        className="game-canvas-container"
      />
      <div
        className="score-display"
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          fontSize: '20px',
          textShadow: '2px 2px 2px black',
          zIndex: 1002,
          pointerEvents: 'none',
        }}
      >
        Score: {localScore}
      </div>
      <canvas
        ref={minimapRef}
        style={{
          position: 'fixed',
          right: '10px',
          bottom: '10px',
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          opacity: 0.8,
          pointerEvents: 'none',
          zIndex: 1000,
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
        }}
      />
      {isTouchDevice && (
        <>
          <div
            ref={joystickRef}
            onTouchStart={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              setJoystickCenter(center);
              setJoystickActive(true);
              setJoystickKnob({ x: 0, y: 0 });
              joystickAngleRef.current = null;
              joystickMagnitudeRef.current = 0;
              joystickVecRef.current = { x: 0, y: 0 };
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (!joystickCenter) return;
              const dx = touch.clientX - joystickCenter.x;
              const dy = touch.clientY - joystickCenter.y;
              const maxRadius = 50;
              const dist = Math.min(Math.hypot(dx, dy), maxRadius);
              const angle = Math.atan2(dy, dx);
              const nx = Math.cos(angle) * dist;
              const ny = Math.sin(angle) * dist;
              setJoystickKnob({ x: nx, y: ny });
              joystickAngleRef.current = angle;
              joystickMagnitudeRef.current = dist / maxRadius;
              joystickVecRef.current = { x: Math.cos(angle) * (dist / maxRadius), y: Math.sin(angle) * (dist / maxRadius) };
            }}
            onTouchEnd={() => {
              setJoystickActive(false);
              setJoystickKnob({ x: 0, y: 0 });
              joystickAngleRef.current = null;
              joystickMagnitudeRef.current = 0;
              joystickVecRef.current = { x: 0, y: 0 };
              // Movement will be handled in game loop, no need to send here
            }}
            className="mobile-joystick"
            style={{
              position: 'fixed',
              left: 20,
              bottom: 20,
              width: 120,
              height: 120,
              borderRadius: 60,
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.15)',
              zIndex: 1001,
              touchAction: 'none'
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 16,
                height: 16,
                marginLeft: -8,
                marginTop: -8,
                background: 'rgba(255,255,255,0.35)',
                borderRadius: 8,
                transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`,
              }}
            />
          </div>

          <div
            onTouchStart={() => {
              const localId = wsService.getSocketId();
              const localTank = localId ? tanksRef.current.get(localId) : null;
              if (!localTank || !localTankStateRef.current) return;
              if (Date.now() - lastShotTimeRef.current > SHOT_COOLDOWN) {
                const dir = getDirectionFromRotation(localTankStateRef.current.rotation);
                wsService.sendPlayerShoot(
                  localTankStateRef.current.x + dir.x * 25,
                  localTankStateRef.current.y + dir.y * 25,
                  dir
                );
                lastShotTimeRef.current = Date.now();
              }
            }}
            className="mobile-fire-button"
            style={{
              position: 'fixed',
              bottom: 20,
              width: SHOOT_BTN_SIZE,
              height: SHOOT_BTN_SIZE,
              borderRadius: SHOOT_BTN_SIZE / 2,
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), rgba(255,0,0,0.6))',
              border: '2px solid rgba(255,255,255,0.2)',
              zIndex: 1001,
              touchAction: 'none'
            }}
          />
        </>
      )}
    </div>
  );
};

export default GameCanvas; 