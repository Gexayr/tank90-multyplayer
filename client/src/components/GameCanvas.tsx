import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import WebSocketService from '../services/websocket';

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
}

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const tanksRef = useRef<Map<string, Tank>>(new Map());
  const bulletsRef = useRef<Map<string, Bullet>>(new Map());
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
  // Minimap configuration
  const MINIMAP_WIDTH = 160; // fixed minimap size
  const MINIMAP_HEIGHT = 120;
  const WORLD_WIDTH = 4000;
  const WORLD_HEIGHT = 4000;
  const MINIMAP_SCALE_X = MINIMAP_WIDTH / WORLD_WIDTH;
  const MINIMAP_SCALE_Y = MINIMAP_HEIGHT / WORLD_HEIGHT;

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

    // Create PIXI Application
    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000,
      resolution: window.devicePixelRatio || 1,
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

      const newTank: Tank = {
        sprite: tank,
        rotation: 0,
        id,
        health,
        maxHealth: 100,
        healthBar: new PIXI.Graphics(),
        score,
        color,
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
      (worldRef.current || app.stage).addChild(bullet);

      bulletsRef.current.set(id, {
        sprite: bullet,
        id,
        playerId,
        direction,
        speed,
      });
    };


    // WebSocket event handlers
    wsService.onPlayerJoin((player) => {
      createTank(player.id, player.x, player.y, player.color, player.health, player.score);
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

    wsService.onPlayerMove((data) => {
      const tank = tanksRef.current.get(data.id);
      if (tank) {
        tank.sprite.x = data.x;
        tank.sprite.y = data.y;
        tank.rotation = data.rotation;
        tank.sprite.rotation = data.rotation;
        updateHealthBar(tank);
        ensureHighlightState(tank);
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
      keysRef.current[e.key] = true;

      // Handle shooting
      if (e.key === ' ' && Date.now() - lastShotTimeRef.current > SHOT_COOLDOWN) {
        const localTank = tanksRef.current.get(wsService.getSocketId() || '');
        if (localTank) {
          const direction = getDirectionFromRotation(localTank.rotation);
          wsService.sendPlayerShoot(
            localTank.sprite.x + direction.x * 25,
            localTank.sprite.y + direction.y * 25,
            direction
          );
          lastShotTimeRef.current = Date.now();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop
    const gameLoop = () => {
      const rotationSpeed = 0.1;

      // Update local player
      const localTank = tanksRef.current.get(wsService.getSocketId() || '');
      if (localTank) {
        let moved = false;
        let newRotation = localTank.rotation;

        // Keyboard controls (desktop)
        if (!isTouchDevice) {
          if (keysRef.current['ArrowLeft']) {
            newRotation -= rotationSpeed;
            moved = true;
          }
          if (keysRef.current['ArrowRight']) {
            newRotation += rotationSpeed;
            moved = true;
          }

          if (moved) {
            wsService.sendPlayerMove(localTank.sprite.x, localTank.sprite.y, newRotation);
          }

          if (keysRef.current['ArrowUp'] || keysRef.current['ArrowDown']) {
            wsService.sendPlayerMove(
              localTank.sprite.x,
              localTank.sprite.y,
              localTank.rotation,
              keysRef.current['ArrowUp'] ? 'forward' : 'backward'
            );
          }
        } else {
          // Touch joystick controls (mobile)
          const mag = joystickMagnitudeRef.current;
          const vec = joystickVecRef.current;
          if (mag > 0.05) {
            const targetRot = Math.atan2(vec.x, -vec.y);
            wsService.sendPlayerMove(localTank.sprite.x, localTank.sprite.y, targetRot, mag > 0.2 ? 'forward' : undefined);
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

      // Camera follow: center local tank, clamp to world bounds
      if (appRef.current && worldRef.current) {
        const app = appRef.current;
        const world = worldRef.current;
        const viewW = app.view.width;
        const viewH = app.view.height;
        let targetX = 0;
        let targetY = 0;
        const lt = tanksRef.current.get(wsService.getSocketId() || '');
        if (lt) {
          targetX = viewW / 2 - lt.sprite.x;
          targetY = viewH / 2 - lt.sprite.y;
        }
        // Clamp so world does not reveal outside edges
        const minX = Math.min(0, viewW - WORLD_WIDTH);
        const maxX = 0;
        const minY = Math.min(0, viewH - WORLD_HEIGHT);
        const maxY = 0;
        world.x = Math.max(minX, Math.min(targetX, maxX));
        world.y = Math.max(minY, Math.min(targetY, maxY));
      }

      // Draw minimap overlay
      drawMinimap();
    };

    // Resize handler to keep full-screen canvas
    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
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
    <div style={{ position: 'relative' }}>
      <div
        ref={canvasRef}
        style={{
          width: '100vw',
          height: '100vh',
          margin: 0,
          border: '2px solid #333'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          fontSize: '20px',
          textShadow: '2px 2px 2px black',
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
              const localTank = tanksRef.current.get(wsService.getSocketId() || '');
              if (localTank) {
                wsService.sendPlayerMove(localTank.sprite.x, localTank.sprite.y, localTank.rotation);
              }
            }}
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
              const localTank = tanksRef.current.get(wsService.getSocketId() || '');
              if (!localTank) return;
              if (Date.now() - lastShotTimeRef.current > SHOT_COOLDOWN) {
                const dir = getDirectionFromRotation(localTank.rotation);
                wsService.sendPlayerShoot(
                  localTank.sprite.x + dir.x * 25,
                  localTank.sprite.y + dir.y * 25,
                  dir
                );
                lastShotTimeRef.current = Date.now();
              }
            }}
            style={{
              position: 'fixed',
              right: 20,
              bottom: 30,
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