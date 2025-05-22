import React, { useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { Play, Pause, RotateCcw, Plus, Trophy } from 'lucide-react';

const GameInterface: React.FC = () => {
  const {
    isGameRunning,
    isPaused,
    currentLevel,
    players,
    score,
    addPlayer,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    showPlayerInput,
    togglePlayerInput
  } = useGameContext();
  
  const [playerName, setPlayerName] = useState('');
  
  const handleAddPlayer = () => {
    if (playerName.trim()) {
      addPlayer(playerName.trim());
      setPlayerName('');
    }
  };
  
  // Calculate total score
  const calculateTotalScore = () => {
    return Object.values(score).reduce((total, playerScore) => total + playerScore, 0);
  };
  
  return (
    <div className="game-interface bg-gray-800 p-4 rounded-lg">
      {!isGameRunning ? (
        // Game setup
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-yellow-400 mb-1">Game Setup</h2>
          
          {showPlayerInput && (
            <div className="flex flex-col gap-2">
              <label className="text-gray-300 text-sm">Add Player</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player name"
                  className="flex-1 px-3 py-2 bg-gray-700 rounded text-white"
                  maxLength={10}
                  size={12}
                />
                <button
                  onClick={handleAddPlayer}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
                  title="Add Player"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          )}
          
          {players.length > 0 && (
            <div className="mt-2">
              <h3 className="text-gray-300 text-sm mb-2">Players:</h3>
              <ul className="space-y-1">
                {players.map(player => (
                  <li 
                    key={player.id} 
                    className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="text-white">{player.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <button
            onClick={startGame}
            disabled={players.length === 0}
            className={`mt-4 py-2 px-4 rounded font-bold flex items-center justify-center gap-2 ${
              players.length > 0
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Play size={18} />
            Start Game
          </button>
        </div>
      ) : (
        // Game info during gameplay
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-yellow-400">Game Info</h2>
            
            <div className="flex gap-2">
              {isPaused ? (
                <button
                  onClick={resumeGame}
                  className="bg-green-600 hover:bg-green-700 text-white p-2 rounded transition-colors"
                  title="Resume"
                >
                  <Play size={18} />
                </button>
              ) : (
                <button
                  onClick={pauseGame}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded transition-colors"
                  title="Pause"
                >
                  <Pause size={18} />
                </button>
              )}
              
              <button
                onClick={restartGame}
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded transition-colors"
                title="Restart"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-3 rounded">
              <p className="text-gray-400 text-sm">Level</p>
              <p className="text-2xl font-bold text-white">{currentLevel}</p>
            </div>
            
            <div className="bg-gray-700 p-3 rounded">
              <p className="text-gray-400 text-sm">Score</p>
              <p className="text-2xl font-bold text-white">{calculateTotalScore()}</p>
            </div>
          </div>
          
          <div className="mt-2">
            <h3 className="text-gray-300 text-sm mb-2 flex items-center gap-1">
              <Trophy size={14} />
              Player Stats
            </h3>
            
            <div className="space-y-2">
              {players.map(player => (
                <div 
                  key={player.id} 
                  className="flex justify-between items-center px-3 py-2 bg-gray-700 rounded"
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="text-white">{player.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-400">
                      Lives: <span className="text-white">{player.lives}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Score: <span className="text-white">{score[player.id] || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameInterface;