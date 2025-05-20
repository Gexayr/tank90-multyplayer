import React from 'react';
import { Tank as TankType } from '../types/gameTypes';
import { TILE_SIZE } from '../constants/gameConfig';

interface TankProps {
  tank: TankType;
}

const Tank: React.FC<TankProps> = ({ tank }) => {
  const { position, direction, type, shield, color } = tank;
  
  // Calculate rotation angle based on direction
  const getRotationAngle = () => {
    switch (direction) {
      case 'up': return 0;
      case 'right': return 90;
      case 'down': return 180;
      case 'left': return 270;
      default: return 0;
    }
  };

  // Convert color name to hex
  const getColorHex = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      'yellow': '#FFD700',
      'blue': '#4169E1',
      'red': '#FF0000',
      'green': '#32CD32'
    };
    return colorMap[colorName] || '#FFFFFF';
  };
  
  return (
    <div
      className={`absolute tank ${shield ? 'tank-shield' : ''}`}
      style={{
        width: `${TILE_SIZE}px`,
        height: `${TILE_SIZE}px`,
        left: `${position.x * TILE_SIZE}px`,
        top: `${position.y * TILE_SIZE}px`,
        backgroundColor: getColorHex(color),
        borderRadius: '2px',
        transform: `rotate(${getRotationAngle()}deg)`,
        zIndex: 10,
        transition: 'transform 0.1s, left 0.1s, top 0.1s',
        boxShadow: shield ? '0 0 8px 4px rgba(100, 200, 255, 0.7)' : 'none'
      }}
    >
      {/* Tank body */}
      <div className="w-full h-full relative">
        {/* Tank cannon */}
        <div 
          className="absolute bg-black"
          style={{
            width: '4px',
            height: '14px',
            left: '50%',
            top: '0',
            transform: 'translateX(-50%)'
          }}
        />
        
        {/* Tank treads */}
        <div 
          className="absolute bg-black bg-opacity-30"
          style={{
            width: '6px',
            height: '100%',
            left: '2px',
            top: '0'
          }}
        />
        <div 
          className="absolute bg-black bg-opacity-30"
          style={{
            width: '6px',
            height: '100%',
            right: '2px',
            top: '0'
          }}
        />
        
        {/* Tank turret */}
        <div 
          className="absolute rounded-full"
          style={{
            width: '14px',
            height: '14px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: getColorHex(color),
            border: '2px solid rgba(0, 0, 0, 0.4)'
          }}
        />
        
        {/* AI indicator */}
        {type === 'ai' && (
          <div 
            className="absolute bg-white"
            style={{
              width: '6px',
              height: '6px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%'
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Tank;