import React, { useEffect, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import { Direction, Position, Wall, PowerUp, Bullet, Tank } from '../types/gameTypes';
import { TILE_SIZE, GRID_SIZE } from '../constants/gameConfig';

const GameField: React.FC = () => {
  const { tanks = [], walls = [], powerUps = [], bullets = [] } = useGameContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Calculate viewport center
    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    // Find the first player's tank (you might want to track the active player differently)
    const playerTank = tanks[0];
    if (playerTank) {
      // Calculate the offset to center the player's tank
      viewportRef.current = {
        x: centerX - (playerTank.position.x * TILE_SIZE),
        y: centerY - (playerTank.position.y * TILE_SIZE)
      };
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate visible grid range based on viewport
    const startX = Math.floor(-viewportRef.current.x / TILE_SIZE);
    const startY = Math.floor(-viewportRef.current.y / TILE_SIZE);
    const endX = Math.ceil((canvas.width - viewportRef.current.x) / TILE_SIZE);
    const endY = Math.ceil((canvas.height - viewportRef.current.y) / TILE_SIZE);

    // Draw power-ups first (bottom layer)
    powerUps?.forEach((powerUp: PowerUp) => {
      const screenX = powerUp.position.x * TILE_SIZE + viewportRef.current.x;
      const screenY = powerUp.position.y * TILE_SIZE + viewportRef.current.y;
      
      if (screenX >= -TILE_SIZE && screenX <= canvas.width &&
          screenY >= -TILE_SIZE && screenY <= canvas.height) {
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(
          screenX + TILE_SIZE / 2,
          screenY + TILE_SIZE / 2,
          TILE_SIZE / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });

    // Draw bullets (middle layer)
    bullets?.forEach((bullet: Bullet) => {
      const screenX = bullet.position.x * TILE_SIZE + viewportRef.current.x;
      const screenY = bullet.position.y * TILE_SIZE + viewportRef.current.y;
      
      if (screenX >= -TILE_SIZE && screenX <= canvas.width &&
          screenY >= -TILE_SIZE && screenY <= canvas.height) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(
          screenX + TILE_SIZE / 2,
          screenY + TILE_SIZE / 2,
          TILE_SIZE / 8,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });

    // Draw tanks (middle layer)
    tanks?.forEach((tank: Tank) => {
      const screenX = tank.position.x * TILE_SIZE + viewportRef.current.x;
      const screenY = tank.position.y * TILE_SIZE + viewportRef.current.y;
      
      if (screenX >= -TILE_SIZE && screenX <= canvas.width &&
          screenY >= -TILE_SIZE && screenY <= canvas.height) {
        // Draw tank body
        ctx.fillStyle = tank.color;
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

        // Draw tank direction indicator
        ctx.fillStyle = '#000';
        const centerX = screenX + TILE_SIZE / 2;
        const centerY = screenY + TILE_SIZE / 2;
        const indicatorLength = TILE_SIZE / 2;

        ctx.beginPath();
        switch (tank.direction) {
          case 'up':
            ctx.moveTo(centerX, screenY);
            ctx.lineTo(centerX - TILE_SIZE / 4, screenY + TILE_SIZE / 4);
            ctx.lineTo(centerX + TILE_SIZE / 4, screenY + TILE_SIZE / 4);
            break;
          case 'right':
            ctx.moveTo(screenX + TILE_SIZE, centerY);
            ctx.lineTo(screenX + TILE_SIZE - TILE_SIZE / 4, centerY - TILE_SIZE / 4);
            ctx.lineTo(screenX + TILE_SIZE - TILE_SIZE / 4, centerY + TILE_SIZE / 4);
            break;
          case 'down':
            ctx.moveTo(centerX, screenY + TILE_SIZE);
            ctx.lineTo(centerX - TILE_SIZE / 4, screenY + TILE_SIZE - TILE_SIZE / 4);
            ctx.lineTo(centerX + TILE_SIZE / 4, screenY + TILE_SIZE - TILE_SIZE / 4);
            break;
          case 'left':
            ctx.moveTo(screenX, centerY);
            ctx.lineTo(screenX + TILE_SIZE / 4, centerY - TILE_SIZE / 4);
            ctx.lineTo(screenX + TILE_SIZE / 4, centerY + TILE_SIZE / 4);
            break;
        }
        ctx.closePath();
        ctx.fill();
      }
    });

    // Draw walls and terrain (middle layer)
    walls?.forEach((wall: Wall) => {
      const screenX = wall.position.x * TILE_SIZE + viewportRef.current.x;
      const screenY = wall.position.y * TILE_SIZE + viewportRef.current.y;
      
      if (screenX >= -TILE_SIZE && screenX <= canvas.width &&
          screenY >= -TILE_SIZE && screenY <= canvas.height) {
        
        switch (wall.type) {
          case 'brick':
            // Разрушаемая стена
            ctx.fillStyle = 'rgba(139, 69, 19, 0.7)'; // Полупрозрачный кирпичный цвет
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            // Добавляем текстуру кирпича
            ctx.strokeStyle = 'rgba(107, 52, 16, 0.9)';
            ctx.lineWidth = 1;
            // Горизонтальные линии
            for (let i = 0; i < TILE_SIZE; i += TILE_SIZE / 4) {
              ctx.beginPath();
              ctx.moveTo(screenX, screenY + i);
              ctx.lineTo(screenX + TILE_SIZE, screenY + i);
              ctx.stroke();
            }
            // Вертикальные линии
            for (let i = 0; i < TILE_SIZE; i += TILE_SIZE / 4) {
              ctx.beginPath();
              ctx.moveTo(screenX + i, screenY);
              ctx.lineTo(screenX + i, screenY + TILE_SIZE);
              ctx.stroke();
            }
            break;

          case 'steel':
            // Неразрушаемая стена
            ctx.fillStyle = 'rgba(105, 105, 105, 0.7)'; // Полупрозрачный серый цвет
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            // Добавляем металлическую текстуру
            ctx.strokeStyle = 'rgba(64, 64, 64, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            // Добавляем блики
            ctx.fillStyle = 'rgba(128, 128, 128, 0.9)';
            ctx.fillRect(screenX + 4, screenY + 4, TILE_SIZE - 8, 2);
            break;

          case 'forest':
            // Лес
            ctx.fillStyle = 'rgba(34, 139, 34, 0.7)'; // Полупрозрачный зеленый цвет
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            // Добавляем текстуру деревьев
            ctx.fillStyle = 'rgba(0, 100, 0, 0.9)';
            for (let i = 0; i < 3; i++) {
              const treeX = screenX + (TILE_SIZE / 4) * (i + 1);
              const treeY = screenY + TILE_SIZE / 2;
              ctx.beginPath();
              ctx.arc(treeX, treeY, TILE_SIZE / 6, 0, Math.PI * 2);
              ctx.fill();
            }
            break;

          case 'water':
            // Вода
            ctx.fillStyle = 'rgba(30, 144, 255, 0.7)'; // Полупрозрачный синий цвет
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            // Добавляем волны
            ctx.strokeStyle = 'rgba(0, 191, 255, 0.9)';
            ctx.lineWidth = 1;
            for (let i = 0; i < TILE_SIZE; i += TILE_SIZE / 4) {
              ctx.beginPath();
              ctx.moveTo(screenX, screenY + i);
              ctx.lineTo(screenX + TILE_SIZE, screenY + i);
              ctx.stroke();
            }
            break;
        }
      }
    });

    // Draw grid last (top layer)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    // Draw visible grid lines
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