import { useEffect, useRef, useState } from 'react';
import type { GameState, PlayerTank, PowerUpType } from '@shared/missions-types';

import { BASE_TANK_SPEED, PLAYER_COLORS } from './constants';
import { POWERUP_INFO, POWERUP_TYPES, powerUpIconUrl } from './powerUpIcons';

function PowerUpIcon({ type, size }: { type: PowerUpType; size: number }) {
  return <img src={powerUpIconUrl(type)} width={size} height={size} alt={POWERUP_INFO[type].label} title={POWERUP_INFO[type].effect} className="inline-block align-middle" />;
}

/** Bonuses a player currently has (life is just the counter) */
function ActiveBonuses({ player, size }: { player: PlayerTank; size: number }) {
  return (
    <>
      {player.hasStar && <PowerUpIcon type="star" size={size} />}
      {player.hasShield && <PowerUpIcon type="shield" size={size} />}
      {player.speed > BASE_TANK_SPEED && <PowerUpIcon type="speed" size={size} />}
    </>
  );
}

function PowerUpLegend({ size, compact }: { size: number; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-1' : 'grid grid-cols-2 gap-x-4 gap-y-2 text-left'}>
      {POWERUP_TYPES.map(type => (
        <div key={type} className="flex items-center gap-2">
          <PowerUpIcon type={type} size={size} />
          <span>
            <span className="font-bold" style={{ color: POWERUP_INFO[type].color }}>{POWERUP_INFO[type].label}</span>
            <span className="text-gray-300"> {POWERUP_INFO[type].effect}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

interface PickupToast {
  key: number;
  type: PowerUpType;
  playerName: string;
  color: string;
}

/** Bonus that vanished from the map was picked up by the nearest player tank */
function usePickupToasts(state: GameState) {
  const prevRef = useRef(state.powerUps);
  const nextKey = useRef(0);
  const [toasts, setToasts] = useState<PickupToast[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state.powerUps;
    if (state.phase !== 'playing' || prev === state.powerUps) return;
    const remaining = new Set(state.powerUps.map(pu => pu.id));
    const picked: PickupToast[] = [];
    for (const pu of prev) {
      if (remaining.has(pu.id)) continue;
      const taker = state.players.find(p => p.isAlive &&
        Math.abs(p.position.x - pu.position.x) < 1.2 && Math.abs(p.position.z - pu.position.z) < 1.2);
      if (!taker) continue;
      picked.push({ key: nextKey.current++, type: pu.type, playerName: taker.name, color: PLAYER_COLORS[taker.colorIndex] });
    }
    if (picked.length === 0) return;
    setToasts(t => [...t, ...picked].slice(-3));
    const keys = new Set(picked.map(p => p.key));
    setTimeout(() => setToasts(t => t.filter(x => !keys.has(x.key))), 2500);
  }, [state.powerUps, state.players, state.phase]);

  return toasts;
}

interface HUDProps {
  state: GameState;
  mySocketId: string | null;
  roomId: string | null;
  onStart: () => void;
  onRestart: () => void;
  onLeave: () => void;
  isMobile?: boolean;
}

function copyInviteLink() {
  const url = `${window.location.origin}${window.location.pathname}`;
  navigator.clipboard?.writeText(url).catch(() => {});
}

export function HUD({ state, mySocketId, roomId, onStart, onRestart, onLeave, isMobile }: HUDProps) {
  const me = state.players.find(p => p.id === mySocketId);
  const others = state.players.filter(p => p.id !== mySocketId);
  const remaining = state.totalEnemies - state.enemiesDefeated;
  const activeEnemies = state.enemies.filter(e => e.isAlive).length;
  const toasts = usePickupToasts(state);

  return (
    <div className="absolute inset-0 pointer-events-none select-none">

      {/* Room + enemy count — top center */}
      {roomId && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-2 py-1 rounded font-mono flex items-center gap-2"
          style={{ fontSize: isMobile ? 10 : 12 }}>
          <span className="text-gray-400">ROOM:</span>
          <span className="text-yellow-400 font-bold tracking-widest">{roomId}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">👾 {activeEnemies} / {remaining}</span>
        </div>
      )}

      {/* Pickup toasts — under the room bar */}
      {toasts.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 font-mono" style={{ top: isMobile ? 34 : 44 }}>
          {toasts.map(t => (
            <div key={t.key} className="bg-black/80 text-white rounded px-3 py-1 flex items-center gap-2 border"
              style={{ borderColor: POWERUP_INFO[t.type].color, fontSize: isMobile ? 11 : 14 }}>
              <PowerUpIcon type={t.type} size={isMobile ? 18 : 24} />
              <span style={{ color: t.color }} className="font-bold">{t.playerName}</span>
              <span>{POWERUP_INFO[t.type].label}: {POWERUP_INFO[t.type].effect}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bonus legend while playing (desktop has room for it) */}
      {!isMobile && state.phase === 'playing' && (
        <div className="absolute top-2 left-2 bg-black/70 text-white rounded-lg font-mono p-2" style={{ fontSize: 11 }}>
          <div className="text-gray-400 mb-1">BONUSES</div>
          <PowerUpLegend size={18} compact />
        </div>
      )}

      {/* My player panel */}
      {me && (
        <div
          className="absolute bg-black/75 text-white rounded-lg font-mono"
          style={{
            top: isMobile ? 8 : undefined,
            left: isMobile ? 8 : undefined,
            bottom: isMobile ? undefined : 16,
            padding: isMobile ? '4px 8px' : '12px',
            fontSize: isMobile ? 11 : 13,
          }}
        >
          <div className="font-bold" style={{ color: PLAYER_COLORS[me.colorIndex] }}>
            ▶ {me.name}
          </div>
          <div className="flex gap-2">
            <span>❤ {me.lives}</span>
            <span className="text-yellow-400">{me.score}pts</span>
            <ActiveBonuses player={me} size={isMobile ? 14 : 18} />
          </div>
          {!isMobile && (
            <div className="text-gray-500 mt-1" style={{ fontSize: 10 }}>↑↓←→/WASD + Space/F</div>
          )}
        </div>
      )}

      {/* Others panel */}
      {others.length > 0 && (
        <div
          className="absolute bg-black/75 text-white rounded-lg font-mono space-y-1"
          style={{
            top: isMobile ? 8 : undefined,
            right: isMobile ? 8 : undefined,
            bottom: isMobile ? undefined : 16,
            padding: isMobile ? '4px 8px' : '12px',
            fontSize: isMobile ? 10 : 12,
          }}
        >
          {others.map(p => (
            <div key={p.id}>
              <div className="font-bold" style={{ color: PLAYER_COLORS[p.colorIndex] }}>{p.name}</div>
              <div className="flex gap-1">
                <span>❤{p.lives}</span>
                <span className="text-yellow-400">{p.score}</span>
                <ActiveBonuses player={p} size={isMobile ? 12 : 16} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Waiting overlay */}
      {state.phase === 'waiting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-auto">
          <div className="bg-gray-900 rounded-2xl text-center font-mono shadow-2xl"
            style={{ padding: isMobile ? '24px 20px' : '32px', margin: isMobile ? '0 16px' : 0 }}>
            <div className="text-yellow-400 font-bold mb-2" style={{ fontSize: isMobile ? 20 : 24 }}>
              WAITING FOR PLAYERS
            </div>
            <div className="text-gray-300 mb-4" style={{ fontSize: isMobile ? 13 : 14 }}>
              Room: <span className="text-yellow-400 font-bold">{roomId}</span><br/>
              <span className="text-gray-500">Share this code with friends</span>
            </div>
            <div className="bg-black/40 rounded-lg p-3 mb-4" style={{ fontSize: isMobile ? 11 : 13 }}>
              <div className="text-gray-400 mb-2">Drive over a bonus to pick it up</div>
              <PowerUpLegend size={isMobile ? 22 : 28} />
            </div>
            <div className="text-gray-400 mb-4" style={{ fontSize: isMobile ? 12 : 14 }}>
              Players: {state.players.length} connected<br/>
              {state.players.map(p => (
                <span key={p.id} className="inline-block mr-2" style={{ color: PLAYER_COLORS[p.colorIndex] }}>
                  {p.id === mySocketId ? `▶ ${p.name}` : p.name}
                </span>
              ))}
            </div>
            <button
              onClick={onStart}
              className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
              style={{ fontSize: isMobile ? 16 : 18 }}
            >
              START GAME
            </button>
            <div className="flex gap-2 justify-center mt-3">
              <button
                onClick={copyInviteLink}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                COPY INVITE LINK
              </button>
              <button
                onClick={onLeave}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                MENU
              </button>
            </div>
            <div className="mt-3 text-gray-500" style={{ fontSize: 11 }}>Any player can start</div>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {state.phase === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-auto">
          <div className="bg-gray-900 rounded-2xl text-center font-mono shadow-2xl"
            style={{ padding: isMobile ? '24px 20px' : '32px', margin: isMobile ? '0 16px' : 0, minWidth: isMobile ? 0 : 288 }}>
            <div
              className={`font-bold mb-2 ${state.baseDestroyed ? 'text-red-400' : 'text-yellow-400'}`}
              style={{ fontSize: isMobile ? 26 : 36 }}
            >
              {state.baseDestroyed ? 'BASE DESTROYED' : state.winner ? `${state.winner} WINS!` : 'GAME OVER'}
            </div>
            <div className="text-gray-400 mb-4" style={{ fontSize: isMobile ? 12 : 14 }}>
              Enemies defeated: {state.enemiesDefeated}/{state.totalEnemies}
            </div>
            <div className="space-y-2 mb-5">
              {[...state.players].sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className="flex justify-between" style={{ color: PLAYER_COLORS[p.colorIndex], fontSize: isMobile ? 13 : 14 }}>
                  <span>{i === 0 ? '🏆' : `${i + 1}.`} {p.name}</span>
                  <span className="text-white ml-6">{p.score} pts</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onRestart}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
                style={{ fontSize: isMobile ? 14 : 16 }}
              >
                PLAY AGAIN
              </button>
              <button
                onClick={onLeave}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white font-bold rounded-lg transition-colors"
                style={{ fontSize: isMobile ? 14 : 16 }}
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Respawn notice */}
      {me && !me.isAlive && me.lives > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-mono text-center pointer-events-none">
          <div className="font-bold text-red-400" style={{ fontSize: isMobile ? 18 : 24 }}>YOU WERE HIT</div>
          <div className="text-gray-300" style={{ fontSize: isMobile ? 14 : 18 }}>Respawning...</div>
          <div className="text-gray-500 mt-1" style={{ fontSize: isMobile ? 11 : 14 }}>Lives: {me.lives}</div>
        </div>
      )}

      {me && me.lives <= 0 && !me.isAlive && state.phase === 'playing' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-mono text-center pointer-events-none">
          <div className="font-bold text-red-500" style={{ fontSize: isMobile ? 20 : 24 }}>ELIMINATED</div>
          <div className="text-gray-400 mt-1" style={{ fontSize: isMobile ? 12 : 14 }}>Watching...</div>
        </div>
      )}
    </div>
  );
}
