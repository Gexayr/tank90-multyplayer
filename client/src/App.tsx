import { useEffect } from 'react';
import { GameProvider } from './context/GameContext';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import Leaderboard from './components/Leaderboard';
import './styles/App.css';

function App() {
  useEffect(() => {
    // Update document title
    document.title = "Tank 90 Multiplayer";
  }, []);

  return (
    <GameProvider>
      <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
        <header className="bg-gray-800 py-4 text-center shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-400">TANK 90</h1>
          <p className="text-gray-400">Multiplayer Edition</p>
        </header>
        
        <main className="container mx-auto px-4 py-6 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
          <div className="game-container">
            <GameBoard />
            <GameControls />
          </div>
          
          <div className="game-sidebar w-full lg:w-64 flex flex-col gap-4">
            {/*<GameInterface />*/}
            <Leaderboard />
          </div>
        </main>
        
        <footer className="mt-auto py-4 text-center text-gray-500 text-sm">
          <p>© 2025 Tank 90 Multiplayer - A modern recreation of the classic game</p>
        </footer>
      </div>
    </GameProvider>
  );
}

export default App; 