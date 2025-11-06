import React, { useEffect, useState } from 'react';

interface Score {
  playerId: string;
  score: number;
}

const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<Score[]>([]);
  const [error, setError] = useState<string | null>(null);
  const backurl: string = import.meta.env.VITE_SERVER_URL || process.env.VITE_SERVER_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${backurl}/leaderboard`);
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }
        const data = await response.json();
        setScores(data);
      } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('An unknown error occurred');
        }
      }
    };

    fetchLeaderboard();
    // Fetch every 10 seconds
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: '300px',
      margin: '20px auto',
      padding: '20px',
      backgroundColor: '#2a2a2a',
      borderRadius: '8px',
      color: 'white'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Leaderboard</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ol style={{ paddingLeft: '20px' }}>
        {scores.map((score, index) => (
          <li key={index} style={{ marginBottom: '10px' }}>
            <span>{score.playerId}</span>
            <span style={{ float: 'right' }}>{score.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default Leaderboard;
