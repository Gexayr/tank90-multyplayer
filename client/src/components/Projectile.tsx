import React from 'react';
import { Direction } from '../types/gameTypes';
import { TILE_SIZE } from '../constants/gameConfig';

interface ProjectileProps {
  position: { x: number; y: number };
  direction: Direction;
}

const Projectile: React.FC<ProjectileProps> = ({ position, direction }) => {
  // Проверяем, что позиция существует
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    console.error('Invalid projectile position:', position);
    return null;
  }

  // Determine projectile shape based on direction
  const getProjectileStyle = () => {
    const isHorizontal = direction === 'left' || direction === 'right';
    
    return {
      width: isHorizontal ? '8px' : '4px',
      height: isHorizontal ? '4px' : '8px',
      backgroundColor: '#fff',
      boxShadow: '0 0 5px rgba(255, 255, 255, 0.8)',
      borderRadius: '1px'
    };
  };
  
  return (
    <div
      className="absolute z-20"
      style={{
        ...getProjectileStyle(),
        left: `${(position.x * TILE_SIZE) + (TILE_SIZE / 2) - 2}px`,
        top: `${(position.y * TILE_SIZE) + (TILE_SIZE / 2) - 2}px`,
        transform: 'translate(-50%, -50%)'
      }}
    />
  );
};

export default Projectile;