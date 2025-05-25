import { io, Socket } from 'socket.io-client';
import { GameState } from '../context/GameContext';

class WebSocketService {
  private socket: Socket | null = null;
  private static instance: WebSocketService;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(url: string): void {
    this.socket = io(url);

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  // Player movement
  sendPlayerMove(x: number, y: number, rotation: number) {
    if (this.socket) {
      this.socket.emit('player-move', { x, y, rotation });
    }
  }

  // Player shooting
  sendPlayerShoot(x: number, y: number, direction: { x: number; y: number }) {
    if (this.socket) {
      this.socket.emit('player-shoot', { x, y, direction });
    }
  }

  // Tank destroyed
  sendTankDestroyed(tankId: string) {
    if (this.socket) {
      this.socket.emit('tank-destroyed', { tankId });
    }
  }

  // Score update
  sendScoreUpdate(playerId: string, score: number) {
    if (this.socket) {
      this.socket.emit('score-update', { playerId, score });
    }
  }

  // Health update
  sendHealthUpdate(tankId: string, health: number) {
    if (this.socket) {
      this.socket.emit('health-update', { id: tankId, health });
    }
  }

  // Event listeners
  onPlayerJoin(callback: (player: any) => void) {
    if (this.socket) {
      this.socket.on('player-join', callback);
    }
  }

  onPlayerLeave(callback: (playerId: string) => void) {
    if (this.socket) {
      this.socket.on('player-leave', callback);
    }
  }

  onPlayerMove(callback: (data: { id: string; x: number; y: number; rotation: number }) => void) {
    if (this.socket) {
      this.socket.on('player-move', callback);
    }
  }

  onHealthUpdate(callback: (data: { id: string; health: number }) => void) {
    if (this.socket) {
      this.socket.on('health-update', callback);
    }
  }

  onGameStateUpdate(callback: (state: any) => void) {
    if (this.socket) {
      this.socket.on('game-state', callback);
    }
  }

  onBulletCreate(callback: (bullet: any) => void) {
    if (this.socket) {
      this.socket.on('bullet-create', callback);
    }
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

export default WebSocketService; 