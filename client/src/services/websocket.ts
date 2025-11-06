import { io, Socket } from 'socket.io-client';

class WebSocketService {
    private socket: Socket | null = null;
    private static instance: WebSocketService;
    private readonly SERVER_URL = import.meta.env.VITE_SERVER_URL || process.env.VITE_SERVER_URL || 'http://localhost:3000';

    // Rate limiting
    private lastMoveTime = 0;
    private readonly MOVE_THROTTLE_MS = 100; // Send moves max 10 times/sec

    // Batching
    private pendingMove: { x: number; y: number; rotation: number; direction?: 'forward' | 'backward' } | null = null;
    private moveTimer: number | null = null;

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
            // CRITICAL: Start with WebSocket for lower latency
            transports: ['websocket', 'polling'],

            // Reconnection settings
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,

            // Performance settings
            upgrade: false, // Don't waste time upgrading
            rememberUpgrade: true,

            withCredentials: false,
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
            // Auto-join the game room so server sends us initial snapshot
            this.socket!.emit('player-join', { id: this.socket!.id });
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
        if (this.moveTimer) {
            clearTimeout(this.moveTimer);
        }
    }

    // Throttled and batched player movement
    sendPlayerMove(x: number, y: number, rotation: number, direction?: 'forward' | 'backward') {
        if (!this.socket) return;

        const now = Date.now();

        // Store the latest move
        this.pendingMove = { x, y, rotation, direction };

        // If we recently sent a move, batch this one
        if (now - this.lastMoveTime < this.MOVE_THROTTLE_MS) {
            // Clear existing timer and set new one
            if (this.moveTimer) {
                clearTimeout(this.moveTimer);
            }

            this.moveTimer = window.setTimeout(() => {
                this.flushMove();
            }, this.MOVE_THROTTLE_MS);
            return;
        }

        // Send immediately if enough time has passed
        this.flushMove();
    }

    private flushMove() {
        if (!this.socket || !this.pendingMove) return;

        this.socket.emit('player-move', this.pendingMove);
        this.lastMoveTime = Date.now();
        this.pendingMove = null;
        this.moveTimer = null;
    }

    // Fire event
    sendPlayerShoot(payload: { id: string; x: number; y: number; direction: { x: number; y: number }; speed: number }) {
        if (this.socket) {
            this.socket.emit('fire', payload);
        }
    }

    sendTankDestroyed(tankId: string) {
        if (this.socket) {
            this.socket.emit('tank-destroyed', { tankId });
        }
    }

    sendScoreUpdate(playerId: string, score: number) {
        if (this.socket) {
            this.socket.emit('score-update', { playerId, score });
        }
    }

    sendHealthUpdate(tankId: string, health: number) {
        if (this.socket) {
            this.socket.emit('health-update', { id: tankId, health });
        }
    }

    sendBulletRemove(bulletId: string) {
        if (this.socket) {
            this.socket.emit('bullet-remove', { id: bulletId });
        }
    }

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

    // New: subscribe to authoritative state snapshots
    onStateUpdate(callback: (state: any) => void) {
        if (this.socket) {
            this.socket.on('state-update', callback);
        }
    }

    // New: initial join payload for the connecting client
    onJoined(callback: (payload: any) => void) {
        if (this.socket) {
            this.socket.on('joined', callback);
        }
    }

    onBulletCreate(callback: (bullet: any) => void) {
        if (this.socket) {
            this.socket.on('bullet-create', callback);
        }
    }

    onFire(callback: (data: any) => void) {
        if (this.socket) {
            this.socket.on('fire', callback);
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

    // Game over for the local player
    onGameOver(callback: (data: { id: string }) => void) {
        if (this.socket) {
            this.socket.on('game-over', callback);
        }
    }

    // Someone died (remove tank)
    onPlayerDead(callback: (data: { id: string }) => void) {
        if (this.socket) {
            this.socket.on('player-dead', callback);
        }
    }

    // Request restart (respawn)
    sendRestart() {
        if (this.socket) {
            this.socket.emit('restart');
        }
    }

    getSocketId(): string | undefined {
        return this.socket?.id;
    }
}

export default WebSocketService;