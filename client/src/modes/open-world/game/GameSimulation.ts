/**
 * Game Simulation for Client-Side Prediction
 * Simulates tank movement locally to provide immediate feedback
 */
import type { MovementCommand } from './CommandBuffer';

export interface TankState {
  x: number;
  y: number;
  rotation: number;
}

export class GameSimulation {
  private readonly SPEED = 3.5 * 25 * 3.2; // Units per second (matching server)
  private readonly WORLD_WIDTH = 4000;
  private readonly WORLD_HEIGHT = 4000;
  private readonly TANK_RADIUS = 20;

  /**
   * Apply a single movement command: the tank faces the heading and drives that way
   */
  applyCommand(state: TankState, command: Pick<MovementCommand, 'heading'>, dt: number = 1/60): TankState {
    if (command.heading === undefined) return { ...state };

    const rotation = command.heading;
    const moveDist = this.SPEED * dt;
    return {
      rotation,
      x: Math.max(this.TANK_RADIUS, Math.min(state.x + Math.sin(rotation) * moveDist, this.WORLD_WIDTH - this.TANK_RADIUS)),
      y: Math.max(this.TANK_RADIUS, Math.min(state.y - Math.cos(rotation) * moveDist, this.WORLD_HEIGHT - this.TANK_RADIUS)),
    };
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
}
