import React, { useEffect, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import { TILE_SIZE } from '../constants/gameConfig';
import { Tank, Bullet, Wall, PowerUp } from '../types/gameTypes';

const GameField: React.FC = () => {
  const { tanks = [], walls = [], powerUps = [], bullets = [] } = useGameContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    const playerTank = tanks[0];
    if (playerTank) {
      const targetX = centerX - playerTank.position.x * TILE_SIZE;
      const targetY = centerY - playerTank.position.y * TILE_SIZE;

      const deadZoneX = viewportWidth * 0.2;
      const deadZoneY = viewportHeight * 0.2;

      const dx = targetX - viewportRef.current.x;
      const dy = targetY - viewportRef.current.y;

      if (Math.abs(dx) > deadZoneX / 2) {
        viewportRef.current.x += dx - Math.sign(dx) * deadZoneX / 2;
      }
      if (Math.abs(dy) > deadZoneY / 2) {
        viewportRef.current.y += dy - Math.sign(dy) * deadZoneY / 2;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawTank = (tank: Tank) => {
      const x = tank.position.x * TILE_SIZE + viewportRef.current.x;
      const y = tank.position.y * TILE_SIZE + viewportRef.current.y;
      if (x < -TILE_SIZE || x > canvas.width || y < -TILE_SIZE || y > canvas.height) return;

      ctx.fillStyle = tank.color;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      const cx = x + TILE_SIZE / 2;
      const cy = y + TILE_SIZE / 2;

      ctx.fillStyle = '#000';
      ctx.beginPath();
      switch (tank.direction) {
        case 'up':
          ctx.moveTo(cx, y);
          ctx.lineTo(cx - TILE_SIZE / 4, y + TILE_SIZE / 4);
          ctx.lineTo(cx + TILE_SIZE / 4, y + TILE_SIZE / 4);
          break;
        case 'right':
          ctx.moveTo(x + TILE_SIZE, cy);
          ctx.lineTo(x + TILE_SIZE - TILE_SIZE / 4, cy - TILE_SIZE / 4);
          ctx.lineTo(x + TILE_SIZE - TILE_SIZE / 4, cy + TILE_SIZE / 4);
          break;
        case 'down':
          ctx.moveTo(cx, y + TILE_SIZE);
          ctx.lineTo(cx - TILE_SIZE / 4, y + TILE_SIZE - TILE_SIZE / 4);
          ctx.lineTo(cx + TILE_SIZE / 4, y + TILE_SIZE - TILE_SIZE / 4);
          break;
        case 'left':
          ctx.moveTo(x, cy);
          ctx.lineTo(x + TILE_SIZE / 4, cy - TILE_SIZE / 4);
          ctx.lineTo(x + TILE_SIZE / 4, cy + TILE_SIZE / 4);
          break;
      }
      ctx.closePath();
      ctx.fill();
    };

    const drawBullet = (bullet: Bullet) => {
      const x = bullet.position.x * TILE_SIZE + viewportRef.current.x;
      const y = bullet.position.y * TILE_SIZE + viewportRef.current.y;
      if (x < -TILE_SIZE || x > canvas.width || y < -TILE_SIZE || y > canvas.height) return;

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 8, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPowerUp = (powerUp: PowerUp) => {
      const x = powerUp.position.x * TILE_SIZE + viewportRef.current.x;
      const y = powerUp.position.y * TILE_SIZE + viewportRef.current.y;
      if (x < -TILE_SIZE || x > canvas.width || y < -TILE_SIZE || y > canvas.height) return;

      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 4, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawWall = (wall: Wall) => {
      const x = wall.position.x * TILE_SIZE + viewportRef.current.x;
      const y = wall.position.y * TILE_SIZE + viewportRef.current.y;
      if (x < -TILE_SIZE || x > canvas.width || y < -TILE_SIZE || y > canvas.height) return;

      switch (wall.type) {
        case 'brick':
          // Разрушаемая стена с текстурой кирпича
          ctx.fillStyle = 'rgba(139, 69, 19, 0.8)'; // Кирпичный цвет с небольшой прозрачностью
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = 'rgba(107, 52, 16, 0.9)';
          ctx.lineWidth = 1;
          // Горизонтальные линии
          for (let i = 0; i < TILE_SIZE; i += TILE_SIZE / 4) {
            ctx.beginPath();
            ctx.moveTo(x, y + i);
            ctx.lineTo(x + TILE_SIZE, y + i);
            ctx.stroke();
          }
          // Вертикальные линии
          for (let i = 0; i < TILE_SIZE; i += TILE_SIZE / 4) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i, y + TILE_SIZE);
            ctx.stroke();
          }
          break;

        case 'steel':
          // Неразрушаемая стена с металлической текстурой
          ctx.fillStyle = 'rgba(105, 105, 105, 0.8)'; // Серый цвет с небольшой прозрачностью
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = 'rgba(64, 64, 64, 0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          // Добавляем блики
          ctx.fillStyle = 'rgba(128, 128, 128, 0.9)';
          ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, 2);
          break;

        case 'forest':
          // Лес (полупрозрачный)
          ctx.fillStyle = 'rgba(34, 139, 34, 0.6)'; // Зеленый цвет с прозрачностью
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Добавляем текстуру деревьев (более темный зеленый)
          ctx.fillStyle = 'rgba(0, 100, 0, 0.7)';
          for (let i = 0; i < 3; i++) {
            const treeX = x + (TILE_SIZE / 4) * (i + 1);
            const treeY = y + TILE_SIZE / 2;
            ctx.beginPath();
            ctx.arc(treeX, treeY, TILE_SIZE / 6, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'water':
          // Вода (непроходимая)
          ctx.fillStyle = 'rgba(30, 144, 255, 0.7)'; // Синий цвет с прозрачностью
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Добавляем волны
          ctx.strokeStyle = 'rgba(0, 191, 255, 0.8)';
          ctx.lineWidth = 1;
          for (let i = 0; i < TILE_SIZE; i += TILE_SIZE / 4) {
            ctx.beginPath();
            ctx.moveTo(x, y + i);
            ctx.lineTo(x + TILE_SIZE, y + i);
            ctx.stroke();
          }
          break;
      }
    };

    // Отрисовка всех элементов
    powerUps.forEach(drawPowerUp);
    bullets.forEach(drawBullet);
    tanks.forEach(drawTank);
    walls.forEach(drawWall);

    // Grid
    ctx.strokeStyle = 'rgba(51,51,51,0.1)';
    ctx.lineWidth = 0.5;
    const startX = Math.floor(-viewportRef.current.x / TILE_SIZE);
    const startY = Math.floor(-viewportRef.current.y / TILE_SIZE);
    const endX = Math.ceil((canvas.width - viewportRef.current.x) / TILE_SIZE);
    const endY = Math.ceil((canvas.height - viewportRef.current.y) / TILE_SIZE);

    for (let x = startX; x <= endX; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_SIZE + viewportRef.current.x, 0);
      ctx.lineTo(x * TILE_SIZE + viewportRef.current.x, canvas.height);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_SIZE + viewportRef.current.y);
      ctx.lineTo(canvas.width, y * TILE_SIZE + viewportRef.current.y);
      ctx.stroke();
    }

  }, [tanks, walls, powerUps, bullets]);

  return (
      <canvas
          ref={canvasRef}
          className="game-field"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a1a'
          }}
      />
  );
};

export default GameField;
