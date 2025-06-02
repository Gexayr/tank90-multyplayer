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
  const worldContainerRef = useRef<PIXI.Container | null>(null);
  const gridGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const minimapGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const minimapAppRef = useRef<PIXI.Application | null>(null);

  // Create health bar for tank
  const createHealthBar = (tank: Tank) => {
    const healthBar = new PIXI.Graphics();
    healthBar.beginFill(0x00FF00);
    healthBar.drawRect(-20, -30, 40, 5);
    healthBar.endFill();
    if (worldContainerRef.current) {
      worldContainerRef.current.addChild(healthBar);
      // appRef.current.stage.addChild(healthBar);
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
    
    if (worldContainerRef.current) {
      worldContainerRef.current.addChild(pulse);

      // Animate pulse
      let scale = 1;
      const animatePulse = () => {
        scale += 0.1;
        pulse.scale.set(scale);
        pulse.alpha = 1 - scale * 0.2;
        
        if (scale < 5) {
          requestAnimationFrame(animatePulse);
        } else {
          if (worldContainerRef.current) {
            worldContainerRef.current.removeChild(pulse);
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
    if (worldContainerRef.current) {
      // appRef.current.stage.removeChild(bullet.sprite);
      worldContainerRef.current.removeChild(bullet.sprite);
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
    if (worldContainerRef.current) {
      // appRef.current.stage.addChild(hitEffect);
      worldContainerRef.current.addChild(hitEffect);

      // Remove hit effect after 100ms
      setTimeout(() => {
        if (worldContainerRef.current) {
          // appRef.current.stage.removeChild(hitEffect);
          worldContainerRef.current.removeChild(hitEffect);
        }
      }, 100);
    }

    // Check if tank is destroyed
    if (tank.health <= 0) {
      if (worldContainerRef.current) {
        worldContainerRef.current.removeChild(tank.sprite);
        worldContainerRef.current.removeChild(tank.healthBar);
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

// Функция для отрисовки сетки
  const drawGrid = () => {
    if (!appRef.current || !worldContainerRef.current || !gridGraphicsRef.current) return;

    const app = appRef.current;
    const worldContainer = worldContainerRef.current;
    const gridGraphics = gridGraphicsRef.current;

    gridGraphics.clear(); // Очищаем предыдущую отрисовку сетки
    gridGraphics.lineStyle(1, 0x333333, 0.5); // Цвет и толщина линий сетки (темно-серый, полупрозрачный)

    const gridSize = 100; // Размер одной ячейки сетки (например, 100x100 пикселей)

    // Вычисляем видимую область (viewport) в мировых координатах
    // Левый верхний угол видимой области мира относительно (0,0) мира
    const viewPortWorldX = -worldContainer.x;
    const viewPortWorldY = -worldContainer.y;

    // Определяем границы видимой области в мировых координатах
    const minX = Math.floor(viewPortWorldX / gridSize) * gridSize;
    const maxX = Math.ceil((viewPortWorldX + app.screen.width) / gridSize) * gridSize;
    const minY = Math.floor(viewPortWorldY / gridSize) * gridSize;
    const maxY = Math.ceil((viewPortWorldY + app.screen.height) / gridSize) * gridSize;

    // Рисуем вертикальные линии
    for (let x = minX; x <= maxX; x += gridSize) {
      gridGraphics.moveTo(x, minY);
      gridGraphics.lineTo(x, maxY);
    }

    // Рисуем горизонтальные линии
    for (let y = minY; y <= maxY; y += gridSize) {
      gridGraphics.moveTo(minX, y);
      gridGraphics.lineTo(maxX, y);
    }
  };



  const lastGridXRef = useRef(0);
  const lastGridYRef = useRef(0);
  const GRID_REDRAW_THRESHOLD = 20;
  const WORLD_SIZE = 5000;
  const MINIMAP_SIZE = 200;

  const drawMinimap = () => {
    if (!appRef.current || !worldContainerRef.current || !minimapGraphicsRef.current) return;

    const localTank = tanksRef.current.get(wsService.getSocketId() || '');
    if (!localTank) return;

    const minimapGraphics = minimapGraphicsRef.current;
    minimapGraphics.clear();

    // 1. Рисуем фон (опционально, если хотите сетку на миникарте)
    // minimapGraphics.beginFill(0x000000, 0.2); // Можно добавить полупрозрачный фон
    // minimapGraphics.drawRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    // minimapGraphics.endFill();

    // 2. Рассчитываем масштаб миникарты
    const scaleX = MINIMAP_SIZE / WORLD_SIZE;
    const scaleY = MINIMAP_SIZE / WORLD_SIZE;

    // 3. Рисуем границы всего игрового мира на миникарте (если мир имеет границы)
    minimapGraphics.lineStyle(1, 0xAAAAAA, 0.7);
    minimapGraphics.drawRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE); // Границы миникарты = границы мира

    // 4. Отображаем позиции других игроков на миникарте
    tanksRef.current.forEach(tank => {
      // Преобразуем мировые координаты танка в координаты миникарты
      const minimapX = (tank.sprite.x + WORLD_SIZE / 2) * scaleX;
      const minimapY = (tank.sprite.y + WORLD_SIZE / 2) * scaleY;

      minimapGraphics.beginFill(0xFFFFFF); // Белый цвет для других танков
      if (tank.id === localTank.id) {
        minimapGraphics.beginFill(0x00FF00); // Зеленый для вашего танка
      }
      minimapGraphics.drawCircle(minimapX, minimapY, 2); // Маленькая точка для танка
      minimapGraphics.endFill();
    });

    // 5. Отображаем видимую область (viewport) на миникарте
    // Сначала вычислим видимую область в мировых координатах
    const viewPortWorldX = -worldContainerRef.current.x;
    const viewPortWorldY = -worldContainerRef.current.y;
    const viewPortWidth = appRef.current.screen.width;
    const viewPortHeight = appRef.current.screen.height;

    // Преобразуем координаты видимой области в координаты миникарты
    const minimapViewPortX = (viewPortWorldX + WORLD_SIZE / 2) * scaleX;
    const minimapViewPortY = (viewPortWorldY + WORLD_SIZE / 2) * scaleY;
    const minimapViewPortWidth = viewPortWidth * scaleX;
    const minimapViewPortHeight = viewPortHeight * scaleY;

    minimapGraphics.lineStyle(1, 0x0000FF, 0.8); // Синяя рамка для видимой области
    minimapGraphics.drawRect(
        minimapViewPortX,
        minimapViewPortY,
        minimapViewPortWidth,
        minimapViewPortHeight
    );
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

    const worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);
    worldContainerRef.current = worldContainer;

    const gridGraphics = new PIXI.Graphics();
    worldContainer.addChild(gridGraphics);
    gridGraphicsRef.current = gridGraphics;

    // Connect to WebSocket server
    wsService.connect();

    drawGrid();

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
      worldContainer.addChild(tank);

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
      worldContainer.addChild(bullet);

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
        if (worldContainerRef.current) {
          worldContainerRef.current.removeChild(tank.sprite);
          worldContainerRef.current.removeChild(tank.healthBar);
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
      if (localTank && appRef.current && worldContainerRef.current) {
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
        worldContainerRef.current.x = appRef.current.screen.width / 2 - localTank.sprite.x;
        worldContainerRef.current.y = appRef.current.screen.height / 2 - localTank.sprite.y;

        if (
            Math.abs(worldContainerRef.current.x - lastGridXRef.current) > GRID_REDRAW_THRESHOLD ||
            Math.abs(worldContainerRef.current.y - lastGridYRef.current) > GRID_REDRAW_THRESHOLD
        ) {
          drawGrid();
          lastGridXRef.current = worldContainerRef.current.x;
          lastGridYRef.current = worldContainerRef.current.y;
        }
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

      drawMinimap();
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

      if (minimapAppRef.current) {
        minimapAppRef.current.destroy(true, true);
        minimapAppRef.current = null;
      }
      minimapGraphicsRef.current = null;
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
      <div
          id="minimap-container" // Добавим ID для стилей
          style={{
            position: 'absolute',
            top: '10px',      // Позиция от верхнего края
            right: '10px',    // Позиция от правого края
            width: '200px',   // Ширина миникарты
            height: '200px',  // Высота миникарты
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // Полупрозрачный фон
            border: '1px solid #777', // Рамка
            overflow: 'hidden', // Скрываем все, что выходит за рамки
            zIndex: 10, // Чтобы миникарта была поверх всего
            borderRadius: '5px' // Небольшое скругление углов
          }}
          ref={(el) => {
            if (el && !minimapAppRef.current) { // Проверяем appRef.current, а не graphicsRef.current
              const minimapApp = new PIXI.Application({
                width: MINIMAP_SIZE, // Используем константы
                height: MINIMAP_SIZE,
                transparent: true,
                resolution: window.devicePixelRatio || 1,
                antialias: true
              });
              el.appendChild(minimapApp.view as HTMLCanvasElement);
              minimapAppRef.current = minimapApp; // Сохраняем ссылку на PIXI.Application миникарты

              const minimapGraphics = new PIXI.Graphics();
              minimapApp.stage.addChild(minimapGraphics);
              minimapGraphicsRef.current = minimapGraphics;
            }
          }}
      />
    </div>
  );
};

export default GameCanvas; 