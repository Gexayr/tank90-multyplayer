import React from 'react';
import { PowerUpType } from '../types/gameTypes';
import { TILE_SIZE } from '../constants/gameConfig';
import { Shield, Zap, Star } from 'lucide-react';

interface PowerUpProps {
  type: PowerUpType;
  position: { x: number; y: number };
}

const PowerUp: React.FC<PowerUpProps> = ({ type, position }) => {
  // Define icon and color based on power-up type
  const getPowerUpConfig = () => {
    switch (type) {
      case 'shield':
        return {
          icon: <Shield className="w-5 h-5" />,
          color: '#3b82f6' // Blue
        };
      case 'speed':
        return {
          icon: <Zap className="w-5 h-5" />,
          color: '#f59e0b' // Amber
        };
      case 'firepower':
        return {
          icon: <Star className="w-5 h-5" />,
          color: '#ef4444' // Red
        };
      default:
        return {
          icon: <Star className="w-5 h-5" />,
          color: '#10b981' // Emerald
        };
    }
  };
  
  const { icon, color } = getPowerUpConfig();
  
  return (
    <div
      className="absolute power-up flex items-center justify-center rounded"
      style={{
        width: `${TILE_SIZE}px`,
        height: `${TILE_SIZE}px`,
        left: `${Math.floor(position.x) * TILE_SIZE}px`,
        top: `${Math.floor(position.y) * TILE_SIZE}px`,
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
        color: 'white',
        pointerEvents: 'none',
        zIndex: 20,
        transform: 'translateZ(0)',
        animation: 'pulse 1s infinite'
      }}
    >
      {icon}
    </div>
  );
};

export default PowerUp;