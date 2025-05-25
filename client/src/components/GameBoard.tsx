import React from 'react';
import { useGameContext } from '../context/GameContext';
import GameField from './GameField';
import GameControls from './GameControls';
import GameInterface from './GameInterface';

const GameBoard: React.FC = () => {
  const { isGameRunning } = useGameContext();

  return (
    <div className="game-board">
      <GameField />
      {isGameRunning && <GameControls />}
      <GameInterface />
    </div>
  );
};

export default GameBoard;