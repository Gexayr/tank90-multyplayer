import React from 'react';
import { Medal } from 'lucide-react';

// Mock leaderboard data
const mockLeaderboard = [
  { name: 'TankMaster', score: 12500 },
  { name: 'BattleKing', score: 10200 },
  { name: 'DestroyerX', score: 9300 },
  { name: 'NinjaTank', score: 8100 },
  { name: 'PixelWarrior', score: 7600 }
];

const Leaderboard: React.FC = () => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Medal className="text-yellow-400" size={18} />
        <h2 className="text-xl font-bold text-yellow-400">Leaderboard</h2>
      </div>
      
      <div className="space-y-2">
        {mockLeaderboard.map((entry, index) => (
          <div 
            key={index}
            className="flex justify-between items-center px-3 py-2 bg-gray-700 rounded"
          >
            <div className="flex items-center gap-2">
              <span className={`font-bold ${
                index === 0 ? 'text-yellow-400' :
                index === 1 ? 'text-gray-300' :
                index === 2 ? 'text-yellow-600' : 'text-gray-500'
              }`}>
                {index + 1}
              </span>
              <span className="text-white">{entry.name}</span>
            </div>
            <span className="text-green-400 font-mono">{entry.score}</span>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-gray-500 mt-3 text-center">
        Top players of all time
      </p>
    </div>
  );
};

export default Leaderboard;