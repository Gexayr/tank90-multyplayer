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
  timestamp: number;
}

export class GameSimulation {
  private readonly SPEED = 5;
  private readonly ROTATION_SPEED = 0.1;
  private readonly WORLD_WIDTH = 4000;
  private readonly WORLD_HEIGHT = 4000;
  private readonly TANK_RADIUS = 20;

  /**
   * Apply a single movement command to a tank state
   */
  applyCommand(state: TankState, command: MovementCommand): TankState {
    const newState: TankState = {
      x: state.x,
      y: state.y,
      rotation: command.rotation,
    };

    // Apply rotation
    newState.rotation = command.rotation;

    // Apply movement if direction is provided
    if (command.direction) {
      const dirX = Math.sin(newState.rotation);
      const dirY = -Math.cos(newState.rotation);

      if (command.direction === 'forward') {
        newState.x += dirX * this.SPEED;
        newState.y += dirY * this.SPEED;
      } else {
        newState.x -= dirX * this.SPEED;
        newState.y -= dirY * this.SPEED;
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

    for (const command of commands) {
      currentState = this.applyCommand(currentState, command);
    }

    return currentState;
  }

  /**
   * Calculate rotation change based on input keys
   */
  calculateRotation(
    currentRotation: number,
    leftPressed: boolean,
    rightPressed: boolean
  ): number {
    let newRotation = currentRotation;

    if (leftPressed) {
      newRotation -= this.ROTATION_SPEED;
    }
    if (rightPressed) {
      newRotation += this.ROTATION_SPEED;
    }

    // Normalize rotation to [0, 2π)
    while (newRotation < 0) newRotation += Math.PI * 2;
    while (newRotation >= Math.PI * 2) newRotation -= Math.PI * 2;

    return newRotation;
  }
}

