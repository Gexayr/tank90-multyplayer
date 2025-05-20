import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import WebSocketService from '../services/websocket';

interface Bullet {
  sprite: PIXI.Graphics;
  direction: { x: number; y: number };
  speed: number;
  id: string;
}

interface Tank {
  sprite: PIXI.Graphics;
  rotation: number;
  id: string;
}

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const tanksRef = useRef<Map<string, Tank>>(new Map());
  const bulletsRef = useRef<Map<string, Bullet>>(new Map());
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastShotTimeRef = useRef<number>(0);
  const SHOT_COOLDOWN = 500; // milliseconds between shots
  const wsService = WebSocketService.getInstance();

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create PIXI Application
    const app = new PIXI.Application({
      width: 800,
      height: 600,
      backgroundColor: 0x000000,
      resolution: window.devicePixelRatio || 1,
    });

    // Add canvas to DOM
    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // Connect to WebSocket server
    wsService.connect();

    // Create tank function
    const createTank = (id: string, x: number, y: number, color: number) => {
      const tank = new PIXI.Graphics();
      tank.beginFill(color);
      tank.drawRect(-20, -20, 40, 40); // Center the tank
      tank.endFill();
      
      // Add direction indicator (triangle)
      tank.beginFill(0xFF0000);
      tank.moveTo(0, -25);
      tank.lineTo(-5, -15);
      tank.lineTo(5, -15);
      tank.endFill();
      
      tank.x = x;
      tank.y = y;
      app.stage.addChild(tank);

      tanksRef.current.set(id, {
        sprite: tank,
        rotation: 0,
        id
      });
    };

    // Create bullet function
    const createBullet = (id: string, x: number, y: number, direction: { x: number; y: number }, color: number) => {
      const bullet = new PIXI.Graphics();
      bullet.beginFill(color);
      bullet.drawCircle(0, 0, 4);
      bullet.endFill();
      bullet.x = x;
      bullet.y = y;
      app.stage.addChild(bullet);

      bulletsRef.current.set(id, {
        sprite: bullet,
        direction,
        speed: 10,
        id
      });
    };

    // Calculate direction vector from rotation
    const getDirectionFromRotation = (rotation: number) => {
      return {
        x: Math.sin(rotation),
        y: -Math.cos(rotation)
      };
    };

    // WebSocket event handlers
    wsService.onPlayerJoin((player) => {
      createTank(player.id, player.x, player.y, player.color);
    });

    wsService.onPlayerLeave((playerId) => {
      const tank = tanksRef.current.get(playerId);
      if (tank) {
        app.stage.removeChild(tank.sprite);
        tanksRef.current.delete(playerId);
      }
    });

    // Add player movement handler
    wsService.onPlayerMove((data) => {
      const tank = tanksRef.current.get(data.id);
      if (tank && data.id !== wsService.getSocketId()) {
        tank.sprite.x = data.x;
        tank.sprite.y = data.y;
        tank.rotation = data.rotation;
        tank.sprite.rotation = data.rotation;
      }
    });

    wsService.onGameStateUpdate((state) => {
      // Create tanks for all players
      state.players.forEach((player: any) => {
        if (!tanksRef.current.has(player.id)) {
          createTank(player.id, player.x, player.y, player.color);
        }
      });

      // Create bullets
      state.bullets.forEach((bullet: any) => {
        if (!bulletsRef.current.has(bullet.id)) {
          const tank = tanksRef.current.get(bullet.playerId);
          if (tank) {
            createBullet(bullet.id, bullet.x, bullet.y, bullet.direction, tank.sprite.tint);
          }
        }
      });
    });

    wsService.onBulletCreate((bullet) => {
      const tank = tanksRef.current.get(bullet.playerId);
      if (tank) {
        createBullet(bullet.id, bullet.x, bullet.y, bullet.direction, tank.sprite.tint);
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
      const speed = 5;
      const rotationSpeed = 0.1;

      // Update local player
      const localTank = tanksRef.current.get(wsService.getSocketId() || '');
      if (localTank) {
        if (keysRef.current['ArrowLeft']) {
          localTank.rotation -= rotationSpeed;
        }
        if (keysRef.current['ArrowRight']) {
          localTank.rotation += rotationSpeed;
        }
        if (keysRef.current['ArrowUp']) {
          const direction = getDirectionFromRotation(localTank.rotation);
          localTank.sprite.x += direction.x * speed;
          localTank.sprite.y += direction.y * speed;
        }
        if (keysRef.current['ArrowDown']) {
          const direction = getDirectionFromRotation(localTank.rotation);
          localTank.sprite.x -= direction.x * speed;
          localTank.sprite.y -= direction.y * speed;
        }
        localTank.sprite.rotation = localTank.rotation;

        // Keep tank within canvas bounds
        localTank.sprite.x = Math.max(20, Math.min(localTank.sprite.x, app.screen.width - 20));
        localTank.sprite.y = Math.max(20, Math.min(localTank.sprite.y, app.screen.height - 20));

        // Send position update to server
        wsService.sendPlayerMove(
          localTank.sprite.x,
          localTank.sprite.y,
          localTank.rotation
        );
      }

      // Update bullets
      bulletsRef.current.forEach((bullet, id) => {
        bullet.sprite.x += bullet.direction.x * bullet.speed;
        bullet.sprite.y += bullet.direction.y * bullet.speed;

        // Remove bullets that are out of bounds
        if (
          bullet.sprite.x < 0 ||
          bullet.sprite.x > app.screen.width ||
          bullet.sprite.y < 0 ||
          bullet.sprite.y > app.screen.height
        ) {
          app.stage.removeChild(bullet.sprite);
          bulletsRef.current.delete(id);
        }
      });
    };

    // Add game loop to PIXI ticker
    app.ticker.add(gameLoop);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      app.ticker.remove(gameLoop);
      wsService.disconnect();
      app.destroy(true, true);
    };
  }, []);

  return (
    <div 
      ref={canvasRef} 
      style={{ 
        width: '800px', 
        height: '600px',
        margin: '0 auto',
        border: '2px solid #333'
      }}
    />
  );
};

export default GameCanvas; 