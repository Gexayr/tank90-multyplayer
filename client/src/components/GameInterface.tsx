import React, { useState, useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import { Play, Pause, RotateCcw, Trophy, Clock, Globe, Star } from 'lucide-react';

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
  } = useGameContext();
  
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'today' | 'week'>('all');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleAddPlayerAndStart = () => {
    if (!playerName.trim()) {
      setError('Name cannot be empty');
      return;
    }
    if (playerName.length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }
    if (playerName.length > 10) {
      setError('Name cannot be longer than 10 characters');
      return;
    }
    if (players.length >= 4) {
      setError('Maximum number of players reached');
      return;
    }
    
    addPlayer(playerName);
    setPlayerName('');
    setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPlayerAndStart();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-yellow-400 text-xl">Loading Game...</p>
        </div>
      </div>
    );
  }
  
  if (isGameRunning) {
    return null;
  }
  
  return (
    <div className="game-interface bg-gray-800/90 backdrop-blur-sm p-4 rounded-lg shadow-xl">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">Welcome to Tank 90!</h2>
        
        <div className="flex flex-col gap-2 max-w-md mx-auto w-full">
          <label className="text-gray-300 text-lg text-center">Enter Your Name to Play</label>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder="Your name"
              className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded text-white text-lg text-center placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
              maxLength={10}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm text-center animate-fade-in">{error}</p>
            )}
            <button
              onClick={handleAddPlayerAndStart}
              disabled={!playerName.trim() || playerName.length < 2 || players.length >= 4}
              className={`py-3 px-6 rounded-lg text-xl font-bold flex items-center justify-center gap-2 mx-auto transition-all ${ 
                playerName.trim() && playerName.length >= 2 && players.length < 4
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/25'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed border-2 border-gray-500'
              }`}
            >
              <Play size={24} />
              Start Game
            </button>
          </div>
        </div>
        
        {players.length > 0 && (
          <div className="mt-4">
            <h3 className="text-gray-300 text-lg mb-3 text-center">Players in Game:</h3>
            <ul className="space-y-2">
              {players.map(player => (
                <li 
                  key={player.id} 
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700/50 rounded border border-gray-600 shadow-lg hover:shadow-gray-500/25 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="text-white text-lg">{player.name}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameInterface;