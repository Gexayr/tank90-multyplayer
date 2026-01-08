/**
 * Game Simulation for Client-Side Prediction
 * Simulates tank movement locally to provide immediate feedback
 */

export interface TankState {
  x: number;
  y: number;
  rotation: number;
}

export interface MovementCommand {
  commandId: number;
  rotation: number;
  direction?: 'forward' | 'backward';
  left?: boolean;
  right?: boolean;
  timestamp: number;
}

export class GameSimulation {
  private readonly SPEED = 3.5 * 25 * 3.2; // Units per second (matching server)
  private readonly ROTATION_SPEED = 0.1 * 25 * 3.6; // Rad per second (matching server)
  private readonly WORLD_WIDTH = 4000;
  private readonly WORLD_HEIGHT = 4000;
  private readonly TANK_RADIUS = 20;

  /**
   * Apply a single movement command to a tank state
   */
  applyCommand(state: TankState, command: MovementCommand, dt: number = 1/60): TankState {
    const newState: TankState = {
      x: state.x,
      y: state.y,
      rotation: state.rotation,
    };

    // Apply rotation
    if (command.left) {
      newState.rotation -= this.ROTATION_SPEED * dt;
    }
    if (command.right) {
      newState.rotation += this.ROTATION_SPEED * dt;
    }
    
    // Normalize rotation
    while (newState.rotation < 0) newState.rotation += Math.PI * 2;
    while (newState.rotation >= Math.PI * 2) newState.rotation -= Math.PI * 2;

    // Apply movement if direction is provided
    if (command.direction) {
      const dirX = Math.sin(newState.rotation);
      const dirY = -Math.cos(newState.rotation);

      const moveDist = this.SPEED * dt;

      if (command.direction === 'forward') {
        newState.x += dirX * moveDist;
        newState.y += dirY * moveDist;
      } else {
        newState.x -= dirX * moveDist;
        newState.y -= dirY * moveDist;
      }

      // Clamp to world bounds
      newState.x = Math.max(this.TANK_RADIUS, Math.min(newState.x, this.WORLD_WIDTH - this.TANK_RADIUS));
      newState.y = Math.max(this.TANK_RADIUS, Math.min(newState.y, this.WORLD_HEIGHT - this.TANK_RADIUS));
    }

    return newState;
  }

  /**
   * Re-simulate a series of commands from a starting state
   * Used for reconciliation when server state arrives
   */
  reSimulateCommands(
    startState: TankState,
    commands: MovementCommand[]
  ): TankState {
    let currentState = { ...startState };

    // When re-simulating, we don't have the original dt easily if it was variable.
    // But since server ticks at 25Hz, we can assume each command represents one tick (40ms).
    const SERVER_TICK_DT = 1 / 25;

    for (const command of commands) {
      currentState = this.applyCommand(currentState, command, SERVER_TICK_DT);
    }

    return currentState;
  }

  /**
   * Calculate rotation change based on input keys
   */
  calculateRotation(
    currentRotation: number,
    leftPressed: boolean,
    rightPressed: boolean,
    dt: number = 1/60
  ): number {
    let newRotation = currentRotation;

    if (leftPressed) {
      newRotation -= this.ROTATION_SPEED * dt;
    }
    if (rightPressed) {
      newRotation += this.ROTATION_SPEED * dt;
    }

    // Normalize rotation to [0, 2π)
    while (newRotation < 0) newRotation += Math.PI * 2;
    while (newRotation >= Math.PI * 2) newRotation -= Math.PI * 2;

    return newRotation;
  }
}

