// client/src/game/ClientPrediction.ts

interface PlayerInput {
  sequenceNumber: number; // Unique ID for this input
  timestamp: number;
  x: number;
  y: number;
  rotation: number;
  velocityX?: number;
  velocityY?: number;
  keys?: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
}

interface ServerStateUpdate {
  id: string;
  x: number;
  y: number;
  rotation: number;
  serverTime: number;
  lastProcessedInput?: number; // Server tells us which input it processed
}

export class ClientPrediction {
  private inputHistory: PlayerInput[] = [];
  private readonly MAX_HISTORY = 120; // 2 seconds at 60fps
  private readonly RECONCILIATION_THRESHOLD = 3; // pixels
  private sequenceNumber = 0;
  
  // Predicted state (what player sees)
  public x = 0;
  public y = 0;
  public rotation = 0;
  
  // Server-confirmed state
  private serverX = 0;
  private serverY = 0;
  private serverRotation = 0;
  private lastProcessedInput = -1;
  
  // Physics/movement parameters (match your game exactly!)
  private MOVE_SPEED = 2; // pixels per frame
  private ROTATION_SPEED = 0.05; // radians per frame
  
  constructor(initialX = 0, initialY = 0, initialRotation = 0) {
    this.x = initialX;
    this.y = initialY;
    this.rotation = initialRotation;
    this.serverX = initialX;
    this.serverY = initialY;
    this.serverRotation = initialRotation;
  }

  /**
   * Process player input and predict new position
   * Call this EVERY FRAME before rendering
   * 
   * @param keys - Current keyboard state
   * @returns The input that was created (send this to server!)
   */
  processInput(keys: { up: boolean; down: boolean; left: boolean; right: boolean }): PlayerInput {
    // Create input record
    const input: PlayerInput = {
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      keys: { ...keys }
    };
    
    // Apply movement logic (CLIENT-SIDE PREDICTION)
    const newState = this.applyInput(input);
    this.x = newState.x;
    this.y = newState.y;
    this.rotation = newState.rotation;
    
    // Store in history for reconciliation
    this.inputHistory.push(input);
    if (this.inputHistory.length > this.MAX_HISTORY) {
      this.inputHistory.shift();
    }
    
    return input;
  }

  /**
   * Apply movement logic - MUST MATCH SERVER EXACTLY!
   * This is your core movement function
   */
  private applyInput(input: PlayerInput): { x: number; y: number; rotation: number } {
    let x = input.x;
    let y = input.y;
    let rotation = input.rotation;

    if (!input.keys) return { x, y, rotation };

    // D-Pad style controls (Tank 1990): arrows set facing to a cardinal direction and move along that axis while held
    // Priority if multiple keys are held: Left > Right > Up > Down (prevents diagonal movement)
    const { up, down, left, right } = input.keys;

    if (left) {
      rotation = (3 * Math.PI) / 2; // 270°
      x -= this.MOVE_SPEED;
    } else if (right) {
      rotation = Math.PI / 2; // 90°
      x += this.MOVE_SPEED;
    } else if (up) {
      rotation = 0; // 0° (up)
      y -= this.MOVE_SPEED;
    } else if (down) {
      rotation = Math.PI; // 180° (down)
      y += this.MOVE_SPEED;
    }

    // Clamp to map bounds (world 800x600, tank is 40x40 centered -> margin 20)
    const WORLD_WIDTH = 800;
    const WORLD_HEIGHT = 600;
    const MARGIN = 20;
    if (x < MARGIN) x = MARGIN;
    if (x > WORLD_WIDTH - MARGIN) x = WORLD_WIDTH - MARGIN;
    if (y < MARGIN) y = MARGIN;
    if (y > WORLD_HEIGHT - MARGIN) y = WORLD_HEIGHT - MARGIN;

    return { x, y, rotation };
  }

  /**
   * Reconcile with authoritative server state
   * Call this when receiving state update from server
   * 
   * @param serverState - Authoritative state from server
   * @returns Whether reconciliation caused a correction
   */
  reconcileWithServer(serverState: ServerStateUpdate): boolean {
    // Update server-confirmed position
    this.serverX = serverState.x;
    this.serverY = serverState.y;
    this.serverRotation = serverState.rotation;
    
    // If server tells us which input it processed, use that
    if (serverState.lastProcessedInput !== undefined) {
      this.lastProcessedInput = serverState.lastProcessedInput;
    }
    
    // Remove inputs older than what server processed
    if (this.lastProcessedInput >= 0) {
      this.inputHistory = this.inputHistory.filter(
        input => input.sequenceNumber > this.lastProcessedInput
      );
    } else {
      // Fallback: remove inputs older than server timestamp
      this.inputHistory = this.inputHistory.filter(
        input => input.timestamp > serverState.serverTime
      );
    }
    
    // Calculate prediction error
    const errorX = this.x - serverState.x;
    const errorY = this.y - serverState.y;
    const errorDistance = Math.sqrt(errorX * errorX + errorY * errorY);
    
    // If prediction is close enough, no correction needed
    if (errorDistance < this.RECONCILIATION_THRESHOLD) {
      return false;
    }
    
    console.log(`[Reconciliation] Error: ${errorDistance.toFixed(2)}px, replaying ${this.inputHistory.length} inputs`);
    
    // Start from server state
    this.x = serverState.x;
    this.y = serverState.y;
    this.rotation = serverState.rotation;
    
    // Replay all unconfirmed inputs
    for (const input of this.inputHistory) {
      const newState = this.applyInput(input);
      this.x = newState.x;
      this.y = newState.y;
      this.rotation = newState.rotation;
    }
    
    return true; // Correction was applied
  }

  /**
   * Interpolate other players for smooth movement
   * Call this for OTHER players (not your own)
   */
  static interpolate(
    current: { x: number; y: number; rotation: number },
    target: { x: number; y: number; rotation: number },
    alpha: number // 0-1, how much to move towards target
  ): { x: number; y: number; rotation: number } {
    return {
      x: current.x + (target.x - current.x) * alpha,
      y: current.y + (target.y - current.y) * alpha,
      rotation: current.rotation + (target.rotation - current.rotation) * alpha
    };
  }

  /**
   * Get current predicted state (for rendering)
   */
  getState(): { x: number; y: number; rotation: number } {
    return {
      x: this.x,
      y: this.y,
      rotation: this.rotation
    };
  }

  /**
   * Get server-confirmed state (for debugging)
   */
  getServerState(): { x: number; y: number; rotation: number } {
    return {
      x: this.serverX,
      y: this.serverY,
      rotation: this.serverRotation
    };
  }
  
  /**
   * Get prediction error (for debugging)
   */
  getPredictionError(): number {
    const dx = this.x - this.serverX;
    const dy = this.y - this.serverY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Reset state (when respawning, etc)
   */
  reset(x = 0, y = 0, rotation = 0): void {
    this.x = x;
    this.y = y;
    this.rotation = rotation;
    this.serverX = x;
    this.serverY = y;
    this.serverRotation = rotation;
    this.inputHistory = [];
    this.sequenceNumber = 0;
    this.lastProcessedInput = -1;
  }
  
  /**
   * Update movement parameters (if they change)
   */
  setMovementParams(moveSpeed: number, rotationSpeed: number): void {
    // Update if needed
  }
}

export default ClientPrediction;