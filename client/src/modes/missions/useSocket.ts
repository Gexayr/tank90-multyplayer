import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, NetGameState, PlayerInput, Wall } from '@shared/missions-types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type JoinError = 'invalid-room' | 'room-full' | 'server-full';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [netState, setNetState] = useState<NetGameState | null>(null);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<JoinError | null>(null);

  useEffect(() => {
    // Same origin as the page; nginx (or the Vite dev proxy) forwards /socket.io
    const socket = io('/missions', { transports: ['websocket'] });
    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', () => {
      setStatus('connected');
      setSocketId(socket.id ?? null);
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
      setSocketId(null);
    });

    socket.on('mission-init', ({ walls: initial }: { walls: Wall[] }) => {
      setWalls(initial);
    });

    socket.on('walls-removed', (ids: string[]) => {
      const removed = new Set(ids);
      setWalls((prev) => prev.filter((w) => !removed.has(w.id)));
    });

    socket.on('game-state', (state: NetGameState) => {
      setNetState(state);
    });

    socket.on('joined', ({ socketId: sid, roomId: rid }: { socketId: string; roomId: string }) => {
      setSocketId(sid);
      setRoomId(rid);
      setJoinError(null);
    });

    socket.on('join-error', ({ reason }: { reason: JoinError }) => {
      setJoinError(reason);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const gameState: GameState | null = useMemo(
    () => (netState ? { ...netState, walls } : null),
    [netState, walls]
  );

  const joinRoom = useCallback((room: string, name: string) => {
    socketRef.current?.emit('join-room', { roomId: room, name });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit('start-game');
  }, []);

  const restartGame = useCallback(() => {
    socketRef.current?.emit('restart-game');
  }, []);

  const sendInput = useCallback((input: PlayerInput) => {
    socketRef.current?.emit('player-input', input);
  }, []);

  return {
    status,
    gameState,
    socketId,
    roomId,
    joinError,
    joinRoom,
    startGame,
    restartGame,
    sendInput,
  };
}
