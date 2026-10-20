import { FormEvent, useEffect, useRef, useState } from 'react';
import Leaderboard from '../components/Leaderboard';
import { fetchStats, ServerStats } from '../lib/api';
import { cleanName, cleanRoomCode, loadName, NAME_MAX_LENGTH, randomRoomCode, saveName } from '../lib/player';
import { navigate } from '../lib/router';

/** Small pixel tank drawn with CSS boxes (no image request, CSP-friendly) */
const PixelTank = ({ color }: { color: string }) => (
  <div className="relative w-10 h-10 shrink-0" aria-hidden="true">
    <div className="absolute left-[17px] top-0 w-[6px] h-[16px]" style={{ background: color, filter: 'brightness(0.7)' }} />
    <div className="absolute left-[6px] top-[12px] w-[28px] h-[24px]" style={{ background: color }} />
    <div className="absolute left-0 top-[10px] w-[7px] h-[28px] bg-black/60" />
    <div className="absolute right-0 top-[10px] w-[7px] h-[28px] bg-black/60" />
    <div className="absolute left-[13px] top-[18px] w-[14px] h-[12px]" style={{ background: color, filter: 'brightness(1.25)' }} />
  </div>
);

const Home = () => {
  const [name, setName] = useState(() => loadName());
  const [nameError, setNameError] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetchStats().then((s) => !cancelled && setStats(s)).catch(() => {});
    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Every mode needs a nickname; returns false (and highlights the field) when it's missing
  const ensureName = (): boolean => {
    const clean = cleanName(name);
    if (!clean) {
      setNameError(true);
      nameInputRef.current?.focus();
      return false;
    }
    saveName(clean);
    return true;
  };

  const playOpenWorld = () => ensureName() && navigate('/open-world');
  const playSolo = () => ensureName() && navigate(`/missions/${randomRoomCode()}?solo=1`);
  const createRoom = () => ensureName() && navigate(`/missions/${randomRoomCode()}`);
  const joinRoom = (e: FormEvent) => {
    e.preventDefault();
    const code = cleanRoomCode(joinCode);
    if (code.length < 3) return;
    if (ensureName()) navigate(`/missions/${code}`);
  };

  return (
    <div className="bg-bricks min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="text-center mb-8 sm:mb-10">
          <h1
            className="font-pixel text-gold text-4xl sm:text-6xl tracking-wider"
            style={{ textShadow: '4px 4px 0 #8a3b12, 8px 8px 0 rgba(0,0,0,0.6)' }}
          >
            TANK 90
          </h1>
          <p className="font-pixel text-[10px] sm:text-xs text-gray-400 mt-4 tracking-[0.3em]">ONLINE BATTLE</p>
        </header>

        <div className="mx-auto max-w-md mb-8">
          <label htmlFor="callsign" className="font-pixel text-[10px] text-gray-400 block mb-2">YOUR CALLSIGN</label>
          <input
            id="callsign"
            ref={nameInputRef}
            className={`w-full bg-panel border-2 px-4 py-3 text-lg outline-none focus:border-gold ${nameError ? 'border-danger' : 'border-line'}`}
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(false);
            }}
            placeholder="Tank commander"
            autoComplete="nickname"
          />
          {nameError && <p className="text-danger text-sm mt-2">Enter a callsign to play</p>}
        </div>

        <div className="grid gap-5 md:grid-cols-2 mb-8">
          <article className="bg-panel border-2 border-line p-5 flex flex-col">
            <div className="flex items-center gap-4 mb-4">
              <PixelTank color="#ef4444" />
              <div>
                <h2 className="font-pixel text-sm text-white">OPEN WORLD</h2>
                <p className="text-xs text-gray-400 mt-1">Free-for-all on a huge map</p>
              </div>
            </div>
            <ul className="text-sm text-gray-300 space-y-1 mb-5 flex-1">
              <li>▸ 4000×4000 battlefield, everyone shoots everyone</li>
              <li>▸ Bricks break, steel holds, water blocks, trees hide you</li>
              <li>▸ Respawn in 3 s, +100 per kill</li>
              <li>▸ Minimap and touch controls</li>
            </ul>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-400">
                <span className="text-leaf">●</span> {stats ? stats.openWorldPlayers : '–'} online
              </span>
              <button className="btn-pixel bg-danger text-white" onClick={playOpenWorld}>PLAY</button>
            </div>
          </article>

          <article className="bg-panel border-2 border-line p-5 flex flex-col">
            <div className="flex items-center gap-4 mb-4">
              <PixelTank color="#ffd23f" />
              <div>
                <h2 className="font-pixel text-sm text-white">MISSIONS</h2>
                <p className="text-xs text-gray-400 mt-1">Co-op: defend the eagle</p>
              </div>
            </div>
            <ul className="text-sm text-gray-300 space-y-1 mb-5 flex-1">
              <li>▸ Solo or up to 4 friends in a room</li>
              <li>▸ Stop 20 enemy tanks before they hit your base</li>
              <li>▸ Power-ups: ⭐ bullets, 🛡 shield, ⚡ speed, ❤ life</li>
              <li>▸ 3D battlefield</li>
            </ul>
            <div className="text-xs text-gray-400 mb-3">
              <span className="text-leaf">●</span> {stats ? stats.missions.rooms : '–'} active rooms
            </div>
            <div className="flex flex-wrap gap-3 mb-3">
              <button className="btn-pixel bg-gold text-ink flex-1" onClick={playSolo}>PLAY SOLO</button>
              <button className="btn-pixel bg-leaf text-ink flex-1" onClick={createRoom}>CREATE ROOM</button>
            </div>
            <form onSubmit={joinRoom} className="flex gap-3">
              <input
                className="min-w-0 flex-1 bg-ink border-2 border-line px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-gold"
                value={joinCode}
                onChange={(e) => setJoinCode(cleanRoomCode(e.target.value))}
                placeholder="ROOM CODE"
                aria-label="Room code"
                autoComplete="off"
              />
              <button type="submit" className="btn-pixel bg-water text-white" disabled={joinCode.length < 3}>JOIN</button>
            </form>
          </article>
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <Leaderboard />
          <section className="bg-panel border-2 border-line p-4 text-sm text-gray-300">
            <h2 className="font-pixel text-xs text-gold mb-3">CONTROLS</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <dt className="text-gray-500">Move</dt>
              <dd>Arrows / WASD</dd>
              <dt className="text-gray-500">Fire</dt>
              <dd>Space / F</dd>
              <dt className="text-gray-500">Phone</dt>
              <dd>Joystick + fire button</dd>
            </dl>
            <p className="text-xs text-gray-500 mt-4">
              Open World: drive in any direction, diagonals included. Missions: classic 4-way movement.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Home;
