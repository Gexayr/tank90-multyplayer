import React, { useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Target } from 'lucide-react';

const GameControls: React.FC = () => {
  const { 
    isGameRunning, 
    isPaused, 
    players, 
    movePlayer, 
    fireProjectile 
  } = useGameContext();
  
  // Handle keyboard controls
  useEffect(() => {
    if (!isGameRunning || isPaused || players.length === 0) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const player1Id = players[0]?.id;
      const player2Id = players[1]?.id;
      
      if (!player1Id) return;
      
      // Player 1 controls (Arrow keys + Space)
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          movePlayer(player1Id, 'up');
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePlayer(player1Id, 'right');
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePlayer(player1Id, 'down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          movePlayer(player1Id, 'left');
          break;
        case ' ': // Space bar
          e.preventDefault();
          fireProjectile(player1Id);
          break;
      }
      
      // Player 2 controls (WASD + F)
      if (player2Id) {
        switch (e.key.toLowerCase()) {
          case 'w':
            movePlayer(player2Id, 'up');
            break;
          case 'd':
            movePlayer(player2Id, 'right');
            break;
          case 's':
            movePlayer(player2Id, 'down');
            break;
          case 'a':
            movePlayer(player2Id, 'left');
            break;
          case 'f':
            fireProjectile(player2Id);
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameRunning, isPaused, players, movePlayer, fireProjectile]);
  
  if (!isGameRunning) return null;
  
  return (
    <div className="game-controls">
      <div className="bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row gap-4">
        <div className="flex flex-col items-center">
          <p className="text-gray-400 text-sm mb-2">Player 1</p>
          <div className="grid grid-cols-3 grid-rows-3 gap-1">
            <div className="col-start-2">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                onClick={() => movePlayer(players[0]?.id, 'up')}
              >
                <ArrowUp size={18} />
              </button>
            </div>
            <div className="col-start-1 row-start-2">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                onClick={() => movePlayer(players[0]?.id, 'left')}
              >
                <ArrowLeft size={18} />
              </button>
            </div>
            <div className="col-start-2 row-start-2">
              <button
                className="bg-red-600 hover:bg-red-700 text-white w-10 h-10 rounded flex items-center justify-center"
                onClick={() => fireProjectile(players[0]?.id)}
              >
                <Target size={18} />
              </button>
            </div>
            <div className="col-start-3 row-start-2">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                onClick={() => movePlayer(players[0]?.id, 'right')}
              >
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="col-start-2 row-start-3">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                onClick={() => movePlayer(players[0]?.id, 'down')}
              >
                <ArrowDown size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Arrow keys & Space</p>
        </div>
        
        {players.length > 1 && (
          <div className="flex flex-col items-center">
            <p className="text-gray-400 text-sm mb-2">Player 2</p>
            <div className="grid grid-cols-3 grid-rows-3 gap-1">
              <div className="col-start-2">
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                  onClick={() => movePlayer(players[1]?.id, 'up')}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
              <div className="col-start-1 row-start-2">
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                  onClick={() => movePlayer(players[1]?.id, 'left')}
                >
                  <ArrowLeft size={18} />
                </button>
              </div>
              <div className="col-start-2 row-start-2">
                <button
                  className="bg-red-600 hover:bg-red-700 text-white w-10 h-10 rounded flex items-center justify-center"
                  onClick={() => fireProjectile(players[1]?.id)}
                >
                  <Target size={18} />
                </button>
              </div>
              <div className="col-start-3 row-start-2">
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                  onClick={() => movePlayer(players[1]?.id, 'right')}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
              <div className="col-start-2 row-start-3">
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-10 h-10 rounded flex items-center justify-center"
                  onClick={() => movePlayer(players[1]?.id, 'down')}
                >
                  <ArrowDown size={18} />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">WASD & F</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameControls;