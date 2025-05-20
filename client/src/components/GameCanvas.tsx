import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import WebSocketService from '../services/websocket';

interface Bullet {
  sprite: PIXI.Graphics;
  direction: { x: number; y: number };
  speed: number;
  id: string;
  playerId: string;
}

interface Tank {
  sprite: PIXI.Graphics;
  rotation: number;
  id: string;
  health: number;
  maxHealth: number;
  healthBar: PIXI.Graphics;
  score: number;
  lastHealthRestore: number;
}

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const tanksRef = useRef<Map<string, Tank>>(new Map());
  const bulletsRef = useRef<Map<string, Bullet>>(new Map());
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastShotTimeRef = useRef<number>(0);
  const SHOT_COOLDOWN = 500; // milliseconds between shots
  const HEALTH_RESTORE_COOLDOWN = 10000; // 10 seconds between health restores
  const HEALTH_RESTORE_AMOUNT = 1; // Amount of health restored
  const wsService = WebSocketService.getInstance();
  const [localScore, setLocalScore] = useState(0);

  // Create health bar for tank
  const createHealthBar = (tank: Tank) => {
    const healthBar = new PIXI.Graphics();
    healthBar.beginFill(0x00FF00);
    healthBar.drawRect(-20, -30, 40, 5);
    healthBar.endFill();
    tank.sprite.addChild(healthBar);
    return healthBar;
  };

  // Update health bar
  const updateHealthBar = (tank: Tank) => {
    const healthPercentage = tank.health / tank.maxHealth;
    tank.healthBar.clear();
    tank.healthBar.beginFill(0x00FF00);
    tank.healthBar.drawRect(-20, -30, 40 * healthPercentage, 5);
    tank.healthBar.endFill();
  };

  // Check collision between bullet and tank
  const checkCollision = (bullet: Bullet, tank: Tank): boolean => {
    const bulletBounds = bullet.sprite.getBounds();
    const tankBounds = tank.sprite.getBounds();
    
    return (
      bulletBounds.x < tankBounds.x + tankBounds.width &&
      bulletBounds.x + bulletBounds.width > tankBounds.x &&
      bulletBounds.y < tankBounds.y + tankBounds.height &&
      bulletBounds.y + bulletBounds.height > tankBounds.y
    );
  };

  // Handle bullet hit
  const handleBulletHit = (bullet: Bullet, tank: Tank) => {
    // Remove bullet
    if (appRef.current) {
      appRef.current.stage.removeChild(bullet.sprite);
      bulletsRef.current.delete(bullet.id);
    }

    // Reduce tank health
    tank.health -= 1;
    updateHealthBar(tank);

    // Create hit effect
    const hitEffect = new PIXI.Graphics();
    hitEffect.beginFill(0xFF0000);
    hitEffect.drawCircle(0, 0, 10);
    hitEffect.endFill();
    hitEffect.x = bullet.sprite.x;
    hitEffect.y = bullet.sprite.y;
    if (appRef.current) {
      appRef.current.stage.addChild(hitEffect);
      
      // Remove hit effect after 100ms
      setTimeout(() => {
        if (appRef.current) {
          appRef.current.stage.removeChild(hitEffect);
        }
      }, 100);
    }

    // Check if tank is destroyed
    if (tank.health <= 0) {
      if (appRef.current) {
        appRef.current.stage.removeChild(tank.sprite);
        tanksRef.current.delete(tank.id);
      }
      // Add score to the player who destroyed the tank
      const killerTank = tanksRef.current.get(bullet.playerId);
      if (killerTank) {
        killerTank.score += 100;
        if (killerTank.id === wsService.getSocketId()) {
          setLocalScore(killerTank.score);
        }
        wsService.sendScoreUpdate(killerTank.id, killerTank.score);
      }
      // Notify server about tank destruction
      wsService.sendTankDestroyed(tank.id);
    }
  };

  // Try to restore health
  const tryRestoreHealth = (tank: Tank) => {
    const now = Date.now();
    if (tank.health < tank.maxHealth && now - tank.lastHealthRestore >= HEALTH_RESTORE_COOLDOWN) {
      tank.health = Math.min(tank.health + HEALTH_RESTORE_AMOUNT, tank.maxHealth);
      tank.lastHealthRestore = now;
      updateHealthBar(tank);
    }
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

      const healthBar = createHealthBar({
        sprite: tank,
        rotation: 0,
        id,
        health: 3,
        maxHealth: 3,
        healthBar: new PIXI.Graphics(),
        score: 0,
        lastHealthRestore: Date.now()
      });

      tanksRef.current.set(id, {
        sprite: tank,
        rotation: 0,
        id,
        health: 3,
        maxHealth: 3,
        healthBar,
        score: 0,
        lastHealthRestore: Date.now()
      });
    };

    // Create bullet function
    const createBullet = (id: string, x: number, y: number, direction: { x: number; y: number }, color: number, playerId: string) => {
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
        id,
        playerId
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
            createBullet(bullet.id, bullet.x, bullet.y, bullet.direction, tank.sprite.tint, bullet.playerId);
          }
        }
      });
    });

    wsService.onBulletCreate((bullet) => {
      const tank = tanksRef.current.get(bullet.playerId);
      if (tank) {
        createBullet(bullet.id, bullet.x, bullet.y, bullet.direction, tank.sprite.tint, bullet.playerId);
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

        // Try to restore health
        tryRestoreHealth(localTank);

        // Send position update to server
        wsService.sendPlayerMove(
          localTank.sprite.x,
          localTank.sprite.y,
          localTank.rotation
        );
      }

      // Update bullets and check collisions
      bulletsRef.current.forEach((bullet, bulletId) => {
        bullet.sprite.x += bullet.direction.x * bullet.speed;
        bullet.sprite.y += bullet.direction.y * bullet.speed;

        // Check collisions with tanks
        tanksRef.current.forEach((tank) => {
          // Don't check collision with the tank that fired the bullet
          if (tank.id !== bullet.playerId && checkCollision(bullet, tank)) {
            handleBulletHit(bullet, tank);
          }
        });

        // Remove bullets that are out of bounds
        if (
          bullet.sprite.x < 0 ||
          bullet.sprite.x > app.screen.width ||
          bullet.sprite.y < 0 ||
          bullet.sprite.y > app.screen.height
        ) {
          app.stage.removeChild(bullet.sprite);
          bulletsRef.current.delete(bulletId);
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
    <div style={{ position: 'relative' }}>
      <div 
        ref={canvasRef} 
        style={{ 
          width: '800px', 
          height: '600px',
          margin: '0 auto',
          border: '2px solid #333'
        }}
      />
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontSize: '20px',
        textShadow: '2px 2px 2px black'
      }}>
        Score: {localScore}
      </div>
    </div>
  );
};

export default GameCanvas; 