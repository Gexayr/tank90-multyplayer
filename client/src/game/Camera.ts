/**
 * Camera System for Tank 90
 * Handles viewport transformation and boundary clamping
 */

export interface CameraConfig {
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
}

export interface CameraState {
  x: number;
  y: number;
}

export class Camera {
  private config: CameraConfig;
  private state: CameraState;

  constructor(config: CameraConfig) {
    this.config = config;
    this.state = { x: 0, y: 0 };
  }

  /**
   * Update camera position to center on target, with boundary clamping
   * @param targetX Target X position in world coordinates
   * @param targetY Target Y position in world coordinates
   * @returns Camera offset (x, y) to apply to world container
   */
  follow(targetX: number, targetY: number): CameraState {
    // Calculate desired camera position (center target in viewport)
    const desiredX = this.config.viewportWidth / 2 - targetX;
    const desiredY = this.config.viewportHeight / 2 - targetY;

    // Calculate boundary limits
    // Camera offset cannot go beyond these bounds
    const minX = this.config.viewportWidth - this.config.worldWidth;
    const maxX = 0;
    const minY = this.config.viewportHeight - this.config.worldHeight;
    const maxY = 0;

    // Clamp camera position to boundaries
    this.state.x = Math.max(minX, Math.min(desiredX, maxX));
    this.state.y = Math.max(minY, Math.min(desiredY, maxY));

    return { ...this.state };
  }

  /**
   * Get current camera state
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Update viewport size (e.g., on window resize)
   */
  setViewportSize(width: number, height: number): void {
    this.config.viewportWidth = width;
    this.config.viewportHeight = height;
  }

  /**
   * Get viewport size
   */
  getViewportSize(): { width: number; height: number } {
    return {
      width: this.config.viewportWidth,
      height: this.config.viewportHeight,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX + this.state.x,
      y: worldY + this.state.y,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX - this.state.x,
      y: screenY - this.state.y,
    };
  }
}

