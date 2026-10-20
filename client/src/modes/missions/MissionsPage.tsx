import { useCallback, useEffect, useRef } from 'react';
import { useSocket, JoinError } from './useSocket';
import { GameCanvas } from './GameScene';
import { HUD } from './HUD';
import { MobileControls } from './MobileControls';
import type { PlayerInput } from '@shared/missions-types';
import { navigate } from '../../lib/router';

const emptyInput: PlayerInput = { up: false, down: false, left: false, right: false, fire: false };

const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const JOIN_ERROR_TEXT: Record<JoinError, string> = {
  'invalid-room': 'This room code is not valid.',
  'room-full': 'This room is full (4 players max).',
  'server-full': 'All mission rooms are busy. Try again in a minute.',
};

interface MissionsPageProps {
  roomCode: string;
  solo: boolean;
  playerName: string;
}

export default function MissionsPage({ roomCode, solo, playerName }: MissionsPageProps) {
  const { status, gameState, socketId, roomId, joinError, joinRoom, startGame, restartGame, sendInput } = useSocket();
  const mobileInputRef = useRef<PlayerInput>({ ...emptyInput });
  const soloStartedRef = useRef(false);
  const isTouch = isTouchDevice();

  // (Re)join whenever the connection comes up
  useEffect(() => {
    if (status === 'connected') joinRoom(roomCode, playerName);
  }, [status, roomCode, playerName, joinRoom]);

  // Solo: start right away instead of waiting for friends
  useEffect(() => {
    if (solo && !soloStartedRef.current && roomId && gameState?.phase === 'waiting') {
      soloStartedRef.current = true;
      startGame();
    }
  }, [solo, roomId, gameState?.phase, startGame]);

  const handleLeave = useCallback(() => {
    mobileInputRef.current = { ...emptyInput };
    navigate('/');
  }, []);

  if (joinError) {
    return (
      <div className="bg-bricks min-h-screen flex items-center justify-center px-4">
        <div className="bg-panel border-2 border-line p-6 max-w-sm text-center space-y-4">
          <h1 className="font-pixel text-sm text-danger">CAN'T JOIN {roomCode}</h1>
          <p className="text-gray-300">{JOIN_ERROR_TEXT[joinError]}</p>
          <button className="btn-pixel bg-gold text-ink" onClick={handleLeave}>MENU</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-gray-900 overflow-hidden relative">
      {gameState && roomId ? (
        <>
          <div className="w-full h-full">
            <GameCanvas
              state={gameState}
              mySocketId={socketId}
              onInput={sendInput}
              mobileInputRef={mobileInputRef}
            />
          </div>
          <HUD
            state={gameState}
            mySocketId={socketId}
            roomId={roomId}
            onStart={startGame}
            onRestart={restartGame}
            onLeave={handleLeave}
            isMobile={isTouch}
          />
          {isTouch && gameState.phase === 'playing' && (
            <MobileControls inputRef={mobileInputRef} />
          )}
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-white text-center space-y-3">
            <div className="font-pixel text-sm">JOINING {roomCode}...</div>
            <div className={`text-sm ${status === 'connected' ? 'text-green-400' : 'text-yellow-400'}`}>{status}</div>
            <button className="btn-pixel bg-panel-2 text-white" onClick={handleLeave}>MENU</button>
          </div>
        </div>
      )}
    </div>
  );
}
