import React from 'react';
import GameCanvas from './components/GameCanvas';

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
      <h1 style={{ marginBottom: '20px' }}>Tank 90</h1>
      <GameCanvas />
      <div style={{ marginTop: '20px' }}>
        <p>Controls: Arrow keys to move, Spacebar to fire</p>
      </div>
    </div>
  );
};

export default App; 