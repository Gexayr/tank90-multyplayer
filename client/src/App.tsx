import { lazy, Suspense } from 'react';
import Home from './pages/Home';
import NameGate from './components/NameGate';
import { useLocation } from './lib/router';
import { cleanRoomCode } from './lib/player';

// Each mode is its own chunk: PixiJS (open world) and three.js (missions) load only when needed
const OpenWorldPage = lazy(() => import('./modes/open-world/OpenWorldPage'));
const MissionsPage = lazy(() => import('./modes/missions/MissionsPage'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center font-pixel text-xs text-gold">LOADING...</div>
);

const App = () => {
  const { path, query } = useLocation();

  let page = <Home />;
  if (path === '/open-world') {
    page = <NameGate>{(name) => <OpenWorldPage playerName={name} />}</NameGate>;
  } else if (path.startsWith('/missions/')) {
    const code = cleanRoomCode(path.slice('/missions/'.length));
    if (code.length >= 3) {
      page = (
        <NameGate>
          {(name) => <MissionsPage key={code} roomCode={code} solo={query.get('solo') === '1'} playerName={name} />}
        </NameGate>
      );
    }
  }

  return <Suspense fallback={<Loading />}>{page}</Suspense>;
};

export default App;
