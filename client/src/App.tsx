import React from 'react';
import GameCanvas from './components/GameCanvas';
import Leaderboard from './components/Leaderboard';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Tank 90 Multiplayer</h1>
        <p className="controls-info desktop-only">Controls: Arrow keys to move, Spacebar to fire</p>
      </header>
      <main className="app-main">
        <div className="game-section">
          <GameCanvas />
        </div>
        <aside className="leaderboard-section">
          <Leaderboard />
        </aside>
      </main>
      <footer className="app-footer mobile-only">
        <p>Controls: Arrow keys to move, Spacebar to fire</p>
      </footer>
    </div>
  );
};

export default App; 