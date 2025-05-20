import { io, Socket } from 'socket.io-client';

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

  connect() {
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
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