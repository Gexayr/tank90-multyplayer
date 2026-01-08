/**
 * Network Interpolation for smooth remote tank movement
 * Interpolates between received server positions to hide network jitter
 * Uses entity interpolation with configurable delay for smooth rendering
 */

export interface InterpolatedState {
  x: number;
  y: number;
  rotation: number;
}

export interface ServerState {
  x: number;
  y: number;
  rotation: number;
  timestamp: number; // High-precision timestamp (performance.now())
}

export class NetworkInterpolation {
  private interpolationDelay: number; // Delay in ms (e.g., 100ms)
  private history: ServerState[] = [];
  private readonly MAX_HISTORY = 20; // Increased buffer for better interpolation
  private lastUpdateTime: number = 0;
  private estimatedLatency: number = 0; // Estimated network latency

  constructor(interpolationDelay: number = 100) {
    this.interpolationDelay = interpolationDelay;
  }

  /**
   * Add a new server state to the interpolation buffer
   * States should be added as they arrive from the server
   */
  addState(state: ServerState): void {
    const now = performance.now();
    
    // Estimate latency based on time between updates
    if (this.lastUpdateTime > 0) {
      const timeSinceLastUpdate = now - this.lastUpdateTime;
      // Simple moving average for latency estimation
      this.estimatedLatency = this.estimatedLatency * 0.7 + timeSinceLastUpdate * 0.3;
    }
    this.lastUpdateTime = now;

    // Ensure timestamp is set if not provided (use current time)
    if (!state.timestamp || state.timestamp === 0) {
      state.timestamp = now;
    }

    // Remove duplicate states (same timestamp or very close)
    this.history = this.history.filter(
      s => Math.abs(s.timestamp - state.timestamp) > 5 // 5ms minimum difference
    );

    this.history.push(state);
    
    // Keep history size manageable
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    // Sort by timestamp (ensure chronological order)
    this.history.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get interpolated state at the current time
   * Uses entity interpolation with delay to smooth out network updates
   */
  getInterpolatedState(currentTime: number): InterpolatedState | null {
    if (this.history.length === 0) {
      return null;
    }

    // If we only have one state, return it (no interpolation possible)
    if (this.history.length === 1) {
      const latest = this.history[this.history.length - 1];
      return { 
        x: latest.x, 
        y: latest.y, 
        rotation: latest.rotation 
      };
    }

    // Calculate the target time (current time minus interpolation delay)
    // This creates a small delay that allows us to interpolate between states
    const targetTime = currentTime - this.interpolationDelay;

    // Find the two states that bracket the target time
    let state1: ServerState | null = null;
    let state2: ServerState | null = null;
    let state1Index = -1;

    // Search for the bracket
    for (let i = 0; i < this.history.length - 1; i++) {
      if (this.history[i].timestamp <= targetTime && this.history[i + 1].timestamp >= targetTime) {
        state1 = this.history[i];
        state2 = this.history[i + 1];
        state1Index = i;
        break;
      }
    }

    // Handle edge cases
    if (!state1 || !state2) {
      const oldestTime = this.history[0].timestamp;
      const newestTime = this.history[this.history.length - 1].timestamp;

      if (targetTime < oldestTime) {
        // Target time is before all states - use oldest two states
        state1 = this.history[0];
        state2 = this.history[1];
      } else if (targetTime >= newestTime) {
        // Target time is after all states - extrapolate from newest two states
        state1 = this.history[this.history.length - 2];
        state2 = this.history[this.history.length - 1];
        
        // Extrapolate forward
        return this.extrapolate(state1, state2, targetTime);
      } else {
        // Should not happen, but fallback to latest state
        const latest = this.history[this.history.length - 1];
        return { 
          x: latest.x, 
          y: latest.y, 
          rotation: latest.rotation 
        };
      }
    }

    // Calculate interpolation factor (0 to 1)
    const timeDiff = state2.timestamp - state1.timestamp;
    if (timeDiff <= 0) {
      // Same timestamp, return state2
      return { 
        x: state2.x, 
        y: state2.y, 
        rotation: state2.rotation 
      };
    }

    const t = (targetTime - state1.timestamp) / timeDiff;
    
    // Clamp t between 0 and 1 for interpolation
    // Allow slight extrapolation (up to 1.2) for smoothness when slightly ahead
    const clampedT = Math.max(0, Math.min(1.2, t));

    // Interpolate position using linear interpolation
    const x = state1.x + (state2.x - state1.x) * clampedT;
    const y = state1.y + (state2.y - state1.y) * clampedT;

    // Interpolate rotation (handle wrap-around for shortest path)
    const rotation = this.interpolateRotation(state1.rotation, state2.rotation, clampedT);

    return { x, y, rotation };
  }

  /**
   * Interpolate rotation taking into account wrap-around (shortest path)
   */
  private interpolateRotation(rot1: number, rot2: number, t: number): number {
    // Normalize rotations to [0, 2π]
    while (rot1 < 0) rot1 += Math.PI * 2;
    while (rot1 >= Math.PI * 2) rot1 -= Math.PI * 2;
    while (rot2 < 0) rot2 += Math.PI * 2;
    while (rot2 >= Math.PI * 2) rot2 -= Math.PI * 2;

    // Find shortest rotation path
    let diff = rot2 - rot1;
    if (Math.abs(diff) > Math.PI) {
      // Take the shorter path around the circle
      diff = diff > 0 ? diff - Math.PI * 2 : diff + Math.PI * 2;
    }

    let result = rot1 + diff * t;
    
    // Normalize result
    while (result < 0) result += Math.PI * 2;
    while (result >= Math.PI * 2) result -= Math.PI * 2;
    
    return result;
  }

  /**
   * Extrapolate state when we're ahead of the interpolation buffer
   * Uses velocity-based extrapolation for smooth movement
   */
  private extrapolate(state1: ServerState, state2: ServerState, targetTime: number): InterpolatedState {
    const timeDiff = state2.timestamp - state1.timestamp;
    if (timeDiff <= 0) {
      return { 
        x: state2.x, 
        y: state2.y, 
        rotation: state2.rotation 
      };
    }

    // Calculate velocity
    const dx = state2.x - state1.x;
    const dy = state2.y - state1.y;
    const dt = targetTime - state2.timestamp;

    // Extrapolate position (simple linear extrapolation)
    // Limit extrapolation to prevent wild predictions
    const maxExtrapolation = 100; // ms
    const extrapolationFactor = Math.min(1.0, dt / maxExtrapolation);
    
    const x = state2.x + (dx / timeDiff) * dt * extrapolationFactor;
    const y = state2.y + (dy / timeDiff) * dt * extrapolationFactor;

    // Extrapolate rotation
    const rotation = this.interpolateRotation(state2.rotation, state1.rotation, -dt / timeDiff);

    return { x, y, rotation };
  }

  /**
   * Clear old states (older than specified time)
   */
  clearOldStates(currentTime: number, maxAge: number = 2000): void {
    const cutoffTime = currentTime - maxAge;
    const before = this.history.length;
    
    // Filter out old states, but always keep at least the most recent one
    if (before > 0) {
      const latestState = this.history[this.history.length - 1];
      this.history = this.history.filter(state => state.timestamp > cutoffTime);
      
      // If we filtered out everything, keep at least the most recent state
      if (this.history.length === 0 && latestState) {
        this.history = [latestState];
      }
    }
  }

  /**
   * Get the number of buffered states
   */
  getBufferSize(): number {
    return this.history.length;
  }

  /**
   * Get estimated latency
   */
  getEstimatedLatency(): number {
    return this.estimatedLatency;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.lastUpdateTime = 0;
    this.estimatedLatency = 0;
  }
}

