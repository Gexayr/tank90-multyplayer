import GameCanvas from './components/GameCanvas';
import Leaderboard from '../../components/Leaderboard';
import { navigate } from '../../lib/router';

interface OpenWorldPageProps {
  playerName: string;
}

const OpenWorldPage = ({ playerName }: OpenWorldPageProps) => (
  <div className="min-h-screen flex flex-col bg-ink">
    <header className="flex items-center gap-4 px-4 py-3 bg-panel border-b-2 border-line">
      <button className="btn-pixel bg-panel-2 text-white !px-3 !py-2 !text-[10px]" onClick={() => navigate('/')}>
        ← MENU
      </button>
      <h1 className="font-pixel text-xs sm:text-sm text-gold">OPEN WORLD</h1>
      <p className="hidden md:block ml-auto text-xs text-gray-400">↑↓←→/WASD move · Space/F fire</p>
    </header>
    <main className="flex-1 flex flex-col xl:flex-row gap-4 p-2 sm:p-4 items-start justify-center">
      <div className="w-full max-w-[1280px]">
        <GameCanvas playerName={playerName} />
      </div>
      <Leaderboard mode="open-world" className="w-full xl:w-72" />
    </main>
  </div>
);

export default OpenWorldPage;
