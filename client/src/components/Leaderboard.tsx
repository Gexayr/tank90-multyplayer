import React, { useEffect, useState } from 'react';
import './Leaderboard.css';

interface Score {
  playerId: string;
  score: number;
}

const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<Score[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      // Auto-expand on desktop
      if (window.innerWidth > 768) {
        setIsExpanded(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('http://localhost:3000/leaderboard');
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
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h2>Leaderboard</h2>
        <button 
          className="leaderboard-toggle mobile-only"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse leaderboard' : 'Expand leaderboard'}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      {(isExpanded || !isMobile) && (
        <div className="leaderboard-content">
          {error && <p className="leaderboard-error">{error}</p>}
          {scores.length === 0 && !error && (
            <p className="leaderboard-empty">No scores yet</p>
          )}
          <ol className="leaderboard-list">
            {scores.map((score, index) => (
              <li key={index} className="leaderboard-item">
                <span className="leaderboard-rank">{index + 1}.</span>
                <span className="leaderboard-player">{score.playerId}</span>
                <span className="leaderboard-score">{score.score}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
