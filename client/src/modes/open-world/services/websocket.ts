import { io, Socket } from 'socket.io-client';

type Unsubscribe = () => void;

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

  connect(name: string) {
    // Drop a previous connection (e.g. React StrictMode double mount)
    this.disconnect();

    // Same origin as the page; nginx (or the Vite dev proxy) forwards /socket.io
    this.socket = io('/open-world', {
      transports: ['websocket'],
      auth: { name },
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

    this.socket.on('server-full', () => {
      console.warn('Open world is full');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Player input
  sendPlayerInput(input: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    shoot: boolean;
    angle: number | null;
    sequenceId: number;
  }) {
    if (this.socket) {
      this.socket.emit('player-input', input);
    }
  }

  // Subscribe to a server event; the returned function removes the listener
  private on(event: string, callback: (...args: any[]) => void): Unsubscribe {
    const socket = this.socket;
    if (!socket) return () => {};
    socket.on(event, callback);
    return () => {
      socket.off(event, callback);
    };
  }

  // Event listeners
  onPlayerJoin(callback: (player: any) => void) {
    return this.on('player-join', callback);
  }

  onPlayerLeave(callback: (playerId: string) => void) {
    return this.on('player-leave', callback);
  }

  onPlayerDied(callback: (data: { id: string; killerName: string | null; respawnIn: number }) => void) {
    return this.on('player-died', callback);
  }

  onGameStateUpdate(callback: (state: any) => void) {
    return this.on('game-state', callback);
  }

  // Snapshot update
  onSnapshot(callback: (snapshot: {
    t: number;
    p: any[];
    b: any[];
  }) => void) {
    return this.on('s', callback);
  }

  // Map objects and updates
  onMapObjects(callback: (objects: any[]) => void) {
    return this.on('map-objects', callback);
  }

  onServerFull(callback: () => void) {
    return this.on('server-full', callback);
  }

  onMapUpdate(callback: (data: { objectId: string; destroyed: boolean }) => void) {
    return this.on('map-update', callback);
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

export default WebSocketService;
