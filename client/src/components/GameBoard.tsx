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
      
      {/* Render projectiles */}
      {gameState.projectiles.map(projectile => (
        <Projectile
          key={projectile.id}
          position={projectile.position}
          direction={projectile.direction}
        />
      ))}
      
      {/* Render tanks */}
      {tanks.map(tank => (
        <Tank
          key={`tank-${tank.id}`}
          tank={tank}
        />
      ))}
      
      {/* Render power-ups last, so they appear on top */}
      {powerUps.map(powerUp => (
        <PowerUp
          key={powerUp.id}
          type={powerUp.type}
          position={powerUp.position}
        />
      ))}
    </div>
  );
};

export default GameBoard;