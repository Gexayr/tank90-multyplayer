import React, { useEffect, useRef, useState } from 'react';
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
  const [localScore, setLocalScore] = useState(0);

  // Create health bar for tank
  const createHealthBar = (tank: Tank) => {
    const healthBar = new PIXI.Graphics();
    healthBar.beginFill(0x00ff00);
    healthBar.drawRect(-20, 30, 40, 5);
    healthBar.endFill();
    if (appRef.current) {
      appRef.current.stage.addChild(healthBar);
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
      width: 800,
      height: 600,
      backgroundColor: 0x000000,
      resolution: window.devicePixelRatio || 1,
    });

    // Ensure we can control draw order via zIndex
    app.stage.sortableChildren = true;

    // Add canvas to DOM
    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // Connect to WebSocket server
    wsService.connect();

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
      // Set tint to match the player's color for consistency
      tank.tint = color;
      app.stage.addChild(tank);

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
    };

    // Create bullet function
    const createBullet = (id: string, x: number, y: number, color: number, playerId: string, direction: { x: number; y: number }, speed: number) => {
      const bullet = new PIXI.Graphics();
      bullet.beginFill(color);
      bullet.drawCircle(0, 0, 4);
      bullet.endFill();
      bullet.x = x;
      bullet.y = y;
      app.stage.addChild(bullet);

      bulletsRef.current.set(id, {
        sprite: bullet,
        id,
        playerId,
        direction,
        speed,
      });
    };

    // Calculate direction vector from rotation
    const getDirectionFromRotation = (rotation: number) => {
      return {
        x: Math.sin(rotation),
        y: -Math.cos(rotation),
      };
    };

    // WebSocket event handlers
    wsService.onPlayerJoin((player) => {
      createTank(player.id, player.x, player.y, player.color, player.health, player.score);
    });

    wsService.onPlayerLeave((playerId) => {
      const tank = tanksRef.current.get(playerId);
      if (tank && appRef.current) {
        appRef.current.stage.removeChild(tank.sprite);
        appRef.current.stage.removeChild(tank.healthBar);
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
      }
    });

    wsService.onGameStateUpdate((state) => {
      // Create tanks for all players
      state.players.forEach((player: any) => {
        if (!tanksRef.current.has(player.id)) {
          createTank(player.id, player.x, player.y, player.color, player.health, player.score);
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
      if (bullet && appRef.current) {
        appRef.current.stage.removeChild(bullet.sprite);
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
            wsService.sendPlayerMove(localTank.sprite.x, localTank.sprite.y, localTank.rotation, keysRef.current['ArrowUp'] ? 'forward' : 'backward');
        }
      }

      // Advance bullets locally so their movement is visible between server events
      bulletsRef.current.forEach((b) => {
        b.sprite.x += b.direction.x * b.speed;
        b.sprite.y += b.direction.y * b.speed;
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
      if (appRef.current) {
        appRef.current.destroy(true, true);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={canvasRef}
        style={{
          width: '800px',
          height: '600px',
          margin: '0 auto',
          border: '2px solid #333',
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
    </div>
  );
};

export default GameCanvas; 