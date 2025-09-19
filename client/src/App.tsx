import React from 'react';
import GameCanvas from './components/GameCanvas';
import Leaderboard from './components/Leaderboard';

const App: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      backgroundColor: '#1a1a1a',
      minHeight: '100vh',
      color: 'white'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Tank 90 Multiplayer</h1>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
        <GameCanvas />
        <Leaderboard />
      </div>
      <div style={{ marginTop: '20px' }}>
        <p>Controls: Arrow keys to move, Spacebar to fire</p>
      </div>
    </div>
  );
};

export default App; 