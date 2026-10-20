/**
 * Camera System for Tank 90
 * Handles viewport transformation and boundary clamping
 */

export interface CameraConfig {
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  /** World scale on screen; below 1 shows more of the map */
  zoom: number;
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
    const { zoom } = this.config;
    const desiredX = this.config.viewportWidth / 2 - targetX * zoom;
    const desiredY = this.config.viewportHeight / 2 - targetY * zoom;

    // Calculate boundary limits
    // Camera offset cannot go beyond these bounds
    const minX = this.config.viewportWidth - this.config.worldWidth * zoom;
    const maxX = 0;
    const minY = this.config.viewportHeight - this.config.worldHeight * zoom;
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
   * Update zoom (e.g., when a phone rotates)
   */
  setZoom(zoom: number): void {
    this.config.zoom = zoom;
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
      x: worldX * this.config.zoom + this.state.x,
      y: worldY * this.config.zoom + this.state.y,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.state.x) / this.config.zoom,
      y: (screenY - this.state.y) / this.config.zoom,
    };
  }
}

