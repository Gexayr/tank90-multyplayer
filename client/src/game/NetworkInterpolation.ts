/**
 * Network Interpolation for smooth remote tank movement
 * Interpolates between received server positions to hide network jitter
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
  timestamp: number;
}

export class NetworkInterpolation {
  private interpolationDelay: number; // Delay in ms (e.g., 100ms)
  private history: ServerState[] = [];
  private readonly MAX_HISTORY = 10;

  constructor(interpolationDelay: number = 100) {
    this.interpolationDelay = interpolationDelay;
  }

  /**
   * Add a new server state to the interpolation buffer
   */
  addState(state: ServerState): void {
    this.history.push(state);
    
    // Keep history size manageable
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    // Sort by timestamp (should already be sorted, but safety check)
    this.history.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get interpolated state at the current time
   */
  getInterpolatedState(currentTime: number): InterpolatedState | null {
    if (this.history.length < 2) {
      // Not enough history, return latest or null
      if (this.history.length === 1) {
        const latest = this.history[this.history.length - 1];
        return { x: latest.x, y: latest.y, rotation: latest.rotation };
      }
      return null;
    }

    // Calculate the target time (current time minus interpolation delay)
    const targetTime = currentTime - this.interpolationDelay;

    // Find the two states to interpolate between
    let state1: ServerState | null = null;
    let state2: ServerState | null = null;

    for (let i = 0; i < this.history.length - 1; i++) {
      if (this.history[i].timestamp <= targetTime && this.history[i + 1].timestamp >= targetTime) {
        state1 = this.history[i];
        state2 = this.history[i + 1];
        break;
      }
    }

    // If target time is before all states, use oldest two
    if (!state1 || !state2) {
      if (targetTime < this.history[0].timestamp) {
        state1 = this.history[0];
        state2 = this.history[1];
      } else {
        // Target time is after all states, use newest two
        state1 = this.history[this.history.length - 2];
        state2 = this.history[this.history.length - 1];
      }
    }

    if (!state1 || !state2) {
      const latest = this.history[this.history.length - 1];
      return { x: latest.x, y: latest.y, rotation: latest.rotation };
    }

    // Calculate interpolation factor (0 to 1)
    const timeDiff = state2.timestamp - state1.timestamp;
    const t = timeDiff > 0 
      ? (targetTime - state1.timestamp) / timeDiff 
      : 1;

    // Clamp t between 0 and 1
    const clampedT = Math.max(0, Math.min(1, t));

    // Interpolate position
    const x = state1.x + (state2.x - state1.x) * clampedT;
    const y = state1.y + (state2.y - state1.y) * clampedT;

    // Interpolate rotation (handle wrap-around)
    let rotation = state1.rotation;
    const rotationDiff = state2.rotation - state1.rotation;
    // Handle shortest rotation path
    let normalizedDiff = rotationDiff;
    if (Math.abs(rotationDiff) > Math.PI) {
      normalizedDiff = rotationDiff > 0 
        ? rotationDiff - Math.PI * 2 
        : rotationDiff + Math.PI * 2;
    }
    rotation = state1.rotation + normalizedDiff * clampedT;
    // Normalize rotation
    while (rotation < 0) rotation += Math.PI * 2;
    while (rotation >= Math.PI * 2) rotation -= Math.PI * 2;

    return { x, y, rotation };
  }

  /**
   * Clear old states (older than specified time)
   */
  clearOldStates(currentTime: number, maxAge: number = 1000): void {
    const cutoffTime = currentTime - maxAge;
    this.history = this.history.filter(state => state.timestamp > cutoffTime);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
  }
}

