import React, { useEffect } from 'react';
import { useGameContext } from '../context/GameContext';

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
    
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          // Assuming player 1 is controlled by arrow keys
          if (players[0]?.id) movePlayer(players[0].id, 'up');
          break;
        case 'ArrowRight':
          if (players[0]?.id) movePlayer(players[0].id, 'right');
          break;
        case 'ArrowDown':
          if (players[0]?.id) movePlayer(players[0].id, 'down');
          break;
        case 'ArrowLeft':
          if (players[0]?.id) movePlayer(players[0].id, 'left');
          break;
        case ' ': // Spacebar for player 1
          if (players[0]?.id) fireProjectile(players[0].id);
          break;
        case 'w':
          // Assuming player 2 is controlled by WASD
          if (players[1]?.id) movePlayer(players[1].id, 'up');
          break;
        case 'd':
          if (players[1]?.id) movePlayer(players[1].id, 'right');
          break;
        case 's':
          if (players[1]?.id) movePlayer(players[1].id, 'down');
          break;
        case 'a':
          if (players[1]?.id) movePlayer(players[1].id, 'left');
          break;
        case 'f': // F key for player 2
           if (players[1]?.id) fireProjectile(players[1].id);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameRunning, isPaused, players, movePlayer, fireProjectile]);
  
  // This component now only handles keyboard controls and renders nothing visual.
  // Visual controls are removed as requested.
  if (!isGameRunning) return null; // Optionally hide the component entirely when game is not running

  return null; // Render nothing for visual controls
};

export default GameControls;