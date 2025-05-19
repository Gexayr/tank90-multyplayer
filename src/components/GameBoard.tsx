import React from 'react';
import { useGameContext } from '../context/GameContext';
import Tank from './Tank';
import Terrain from './Terrain';
import Projectile from './Projectile';
import PowerUp from './PowerUp';
import { GRID_SIZE, TILE_SIZE } from '../constants/gameConfig';

const GameBoard: React.FC = () => {
  const { gameState, tanks, powerUps, isGameRunning } = useGameContext();
  
  if (!isGameRunning) {
    return (
      <div className="game-board flex items-center justify-center">
        <div className="text-center p-8 bg-gray-800 bg-opacity-80 rounded-lg">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">Tank 90</h2>
          <p className="text-white mb-6">Press Start to begin the battle!</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="game-board relative"
      style={{ 
        width: `${GRID_SIZE * TILE_SIZE}px`, 
        height: `${GRID_SIZE * TILE_SIZE}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        margin: '0 auto'
      }}
    >
      {/* Render terrain */}
      {gameState.walls.map(wall => (
        <Terrain
          key={wall.id}
          type={wall.type}
          position={wall.position}
        />
      ))}
      
      {/* Render tanks */}
      {tanks.map(tank => (
        <Tank
          key={`tank-${tank.id}`}
          tank={tank}
        />
      ))}
      
      {/* Render projectiles */}
      {gameState.projectiles.map(projectile => (
        <Projectile
          key={projectile.id}
          position={projectile.position}
          direction={projectile.direction}
        />
      ))}
      
      {/* Render power-ups */}
      {powerUps.map(powerUp => (
        <PowerUp
          key={powerUp.id}
          type={powerUp.type}
          position={powerUp.position}
        />
      ))}
      
      {/* Base/HQ */}
      <div
        className="absolute bg-yellow-600 border-4 border-yellow-800"
        style={{
          width: `${TILE_SIZE}px`,
          height: `${TILE_SIZE}px`,
          left: `${Math.floor(GRID_SIZE / 2) * TILE_SIZE}px`,
          top: `${(GRID_SIZE - 2) * TILE_SIZE}px`,
          backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23ffd700\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/></svg>')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          zIndex: 5
        }}
      />
    </div>
  );
};

export default GameBoard;