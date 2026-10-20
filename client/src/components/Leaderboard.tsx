import { useEffect, useState } from 'react';
import { fetchLeaderboard, GameMode, ScoreRow } from '../lib/api';

const TABS: { mode: GameMode; label: string }[] = [
  { mode: 'open-world', label: 'Open World' },
  { mode: 'missions', label: 'Missions' },
];

interface LeaderboardProps {
  /** Show only one mode (in-game sidebar); without it the tabs are shown */
  mode?: GameMode;
  className?: string;
}

const Leaderboard = ({ mode, className = '' }: LeaderboardProps) => {
  const [tab, setTab] = useState<GameMode>(mode ?? 'open-world');
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const activeMode = mode ?? tab;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchLeaderboard(activeMode);
        if (!cancelled) {
          setScores(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Leaderboard unavailable');
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeMode]);

  return (
    <section className={`bg-panel border-2 border-line p-4 ${className}`}>
      <h2 className="font-pixel text-xs text-gold mb-3">LEADERBOARD</h2>
      {!mode && (
        <div className="flex mb-3 border-2 border-line" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.mode}
              role="tab"
              aria-selected={tab === t.mode}
              onClick={() => setTab(t.mode)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                tab === t.mode ? 'bg-gold text-ink' : 'bg-panel-2 text-gray-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && scores.length === 0 && <p className="text-sm text-gray-400">No scores yet. Be the first!</p>}
      <ol className="space-y-1">
        {scores.map((row, index) => (
          <li key={row.name} className="flex items-center gap-3 text-sm bg-panel-2 px-3 py-2">
            <span className={`font-pixel text-[10px] w-6 ${index < 3 ? 'text-gold' : 'text-gray-500'}`}>{index + 1}</span>
            <span className="flex-1 truncate">{row.name}</span>
            <span className="font-mono text-gold">{row.score}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default Leaderboard;
