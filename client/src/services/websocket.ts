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
    
    // Start with polling for better compatibility, then upgrade to WebSocket automatically
    // This ensures connection works even if WebSocket is blocked by proxies/firewalls
    // Polling is more reliable across different network configurations
    this.socket = io(this.SERVER_URL, {
      transports: ['polling', 'websocket'], // Try polling first for reliability, then upgrade to WebSocket
      upgrade: true, // Allow automatic upgrade from polling to WebSocket when available
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10, // More attempts for better reliability
      timeout: 20000, // 20 second connection timeout
      forceNew: false, // Reuse existing connection if available
      // Additional options for better connection handling
      autoConnect: true,
      rememberUpgrade: true, // Remember successful WebSocket upgrade for future connections
    });

    this.socket.on('connect', () => {
      const transport = this.socket?.io.engine.transport.name;
      console.log('✅ Connected to server via', transport);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('⚠️ Connection error:', error.message);
    });

    // Monitor transport upgrades (when polling successfully upgrades to WebSocket)
    this.socket.io.engine.on('upgrade', () => {
      console.log('⬆️ Transport upgraded to:', this.socket?.io.engine.transport.name);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Player movement - now sends only input data and command ID
  sendPlayerMove(commandId: number, rotation: number, direction?: 'forward' | 'backward') {
    if (this.socket) {
      this.socket.emit('player-move', { commandId, rotation, direction });
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

  // State update with command confirmation
  onStateUpdate(callback: (data: { 
    players: any[]; 
    bullets: any[]; 
    latestConfirmedCommandId?: number;
    authoritativeState?: { x: number; y: number; rotation: number };
  }) => void) {
    if (this.socket) {
      this.socket.on('state-update', callback);
    }
  }

  // Map objects and updates
  onMapObjects(callback: (objects: any[]) => void) {
    if (this.socket) {
      this.socket.on('map-objects', callback);
    }
  }

  onMapUpdate(callback: (data: { objectId: string; destroyed: boolean }) => void) {
    if (this.socket) {
      this.socket.on('map-update', callback);
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