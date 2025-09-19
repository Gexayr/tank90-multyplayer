import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private static instance: WebSocketService;
  private readonly SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect() {
    console.log('Connecting to server:', this.SERVER_URL);
    this.socket = io(this.SERVER_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Player movement
  sendPlayerMove(x: number, y: number, rotation: number, direction?: 'forward' | 'backward') {
    if (this.socket) {
      this.socket.emit('player-move', { x, y, rotation, direction });
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

  onBulletRemove(callback: (bulletId: string) => void) {
    if (this.socket) {
      this.socket.on('bullet-remove', callback);
    }
  }

  onScoreUpdate(callback: (data: { playerId: string; score: number }) => void) {
    if (this.socket) {
      this.socket.on('score-update', callback);
    }
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

export default WebSocketService; 