import React from 'react';
import { TILE_SIZE } from '../constants/gameConfig';

interface TerrainProps {
  type: 'brick' | 'steel' | 'water' | 'forest';
  position: { x: number; y: number };
}

const Terrain: React.FC<TerrainProps> = ({ type, position }) => {
  // Define terrain styles based on type
  const getTerrainStyle = () => {
    switch (type) {
      case 'brick':
        return {
          backgroundColor: '#a84632',
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)',
          backgroundSize: '8px 8px',
          border: '1px solid #863a2a'
        };
      case 'steel':
        return {
          backgroundColor: '#777',
          backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
          backgroundSize: '8px 8px',
          border: '1px solid #555'
        };
      case 'water':
        return {
          backgroundColor: '#4a80f5',
          animation: 'waterRipple 2s linear infinite',
          border: '1px solid #3a70e5'
        };
      case 'forest':
        return {
          backgroundColor: '#2e8b57',
          backgroundImage: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.1) 40%)',
          backgroundSize: '8px 8px',
          border: '1px solid #1e7b47',
          zIndex: 15
        };
      default:
        return {};
    }
  };
  
  return (
    <div
      className="absolute"
      style={{
        width: `${TILE_SIZE}px`,
        height: `${TILE_SIZE}px`,
        left: `${position.x * TILE_SIZE}px`,
        top: `${position.y * TILE_SIZE}px`,
        ...getTerrainStyle()
      }}
    />
  );
};

export default Terrain;