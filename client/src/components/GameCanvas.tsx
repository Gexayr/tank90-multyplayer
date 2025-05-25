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
  const createHealthBar = () => {
    const healthBar = new PIXI.Graphics();
    healthBar.beginFill(0x00FF00);
    healthBar.drawRect(-20, -30, 40, 5);
    healthBar.endFill();
    if (appRef.current) {
      appRef.current.stage.addChild(healthBar);
    }
    return healthBar;
  };

  // Create pulsing effect
  const createPulseEffect = (x: number, y: number) => {
    const pulse = new PIXI.Graphics();
    pulse.beginFill(0x00FF00, 0.5);
    pulse.drawCircle(0, 0, 5);
    pulse.endFill();
    pulse.x = x;
    pulse.y = y;
    
    if (appRef.current) {
      appRef.current.stage.addChild(pulse);
      
      // Animate pulse
      let scale = 1;
      const animatePulse = () => {
        scale += 0.1;
        pulse.scale.set(scale);
        pulse.alpha = 1 - scale * 0.2;
        
        if (scale < 5) {
          requestAnimationFrame(animatePulse);
        } else {
          if (appRef.current) {
            appRef.current.stage.removeChild(pulse);
          }
        }
      };
      
      animatePulse();
    }
  };

  // Update health bar with animation
  const updateHealthBar = (tank: Tank, targetHealth?: number) => {
    const currentHealth = tank.health;
    const targetHealthValue = targetHealth !== undefined ? targetHealth : currentHealth;
    const healthPercentage = targetHealthValue / tank.maxHealth;

    // Create animation container
    const animateHealthChange = () => {
      const currentPercentage = tank.healthBar.width / 40;
      const step = (healthPercentage - currentPercentage) * 0.1;

      if (Math.abs(step) > 0.001) {
        tank.healthBar.clear();
        tank.healthBar.beginFill(0x00FF00);
        tank.healthBar.drawRect(-20, -30, 40 * (currentPercentage + step), 5);
        tank.healthBar.endFill();
        requestAnimationFrame(animateHealthChange);
      } else {
        tank.healthBar.clear();
        tank.healthBar.beginFill(0x00FF00);
        tank.healthBar.drawRect(-20, -30, 40 * healthPercentage, 5);
        tank.healthBar.endFill();
      }
    };

    animateHealthChange();

    // Update position
    tank.healthBar.x = tank.sprite.x;
    tank.healthBar.y = tank.sprite.y;
    tank.healthBar.rotation = tank.sprite.rotation;
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

    // Reduce tank health with animation
    const newHealth = tank.health - 1;
    updateHealthBar(tank, newHealth);
    tank.health = newHealth;
    
    // Send health update to server
    wsService.sendHealthUpdate(tank.id, tank.health);

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
        appRef.current.stage.removeChild(tank.healthBar);
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
      const newHealth = Math.min(tank.health + HEALTH_RESTORE_AMOUNT, tank.maxHealth);
      updateHealthBar(tank, newHealth);
      tank.health = newHealth;
      tank.lastHealthRestore = now;
      
      // Create pulse effect at health bar position
      createPulseEffect(tank.sprite.x, tank.sprite.y - 30);
      
      // Send health update to server
      wsService.sendHealthUpdate(tank.id, tank.health);
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

      // Initial health bar update
      updateHealthBar(tanksRef.current.get(id)!);
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
        if (appRef.current) {
          appRef.current.stage.removeChild(tank.sprite);
          appRef.current.stage.removeChild(tank.healthBar);
        }
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
      // Update existing tanks or create new ones if they don't exist
      state.players.forEach((player: any) => {
        const existingTank = tanksRef.current.get(player.id);
        if (existingTank) {
          // Update existing tank position and rotation
          existingTank.sprite.x = player.x;
          existingTank.sprite.y = player.y;
          existingTank.rotation = player.rotation;
          existingTank.sprite.rotation = player.rotation;
          updateHealthBar(existingTank);
        } else {
          // Create new tank only if it doesn't exist
          createTank(player.id, player.x, player.y, player.color);
        }
      });

      // Remove tanks that are no longer in the game state
      tanksRef.current.forEach((tank, id) => {
        if (!state.players.find((p: any) => p.id === id)) {
          if (appRef.current) {
            appRef.current.stage.removeChild(tank.sprite);
            appRef.current.stage.removeChild(tank.healthBar);
          }
          tanksRef.current.delete(id);
        }
      });

      // Create bullets
      state.bullets.forEach((bullet: any) => {
        if (!bulletsRef.current.has(bullet.id)) {
          const tank = tanksRef.current.get(bullet.playerId);
          if (tank) {
            createBullet(bullet.id, bullet.x, bullet.y, bullet.direction, 0, bullet.playerId);
          }
        }
      });
    });

    wsService.onBulletCreate((bullet) => {
      const tank = tanksRef.current.get(bullet.playerId);
      if (tank) {
        createBullet(bullet.id, bullet.x, bullet.y, bullet.direction, 0, bullet.playerId);
      }
    });

    // Add health update handler
    wsService.onHealthUpdate((data) => {
      const tank = tanksRef.current.get(data.id);
      if (tank) {
        tank.health = data.health;
        updateHealthBar(tank);
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

        // Update health bar position
        updateHealthBar(localTank);

        // Send position update to server
        wsService.sendPlayerMove(
          localTank.sprite.x,
          localTank.sprite.y,
          localTank.rotation
        );
      }

      // Update other tanks' health bars
      tanksRef.current.forEach((tank) => {
        if (tank.id !== wsService.getSocketId()) {
          updateHealthBar(tank);
        }
      });

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
          width: '1800px',
          height: '1600px',
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