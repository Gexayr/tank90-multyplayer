/**
 * Command Buffer for Client-Side Prediction
 * Stores movement commands with sequential IDs for reconciliation
 */

export interface MovementCommand {
  commandId: number;
  rotation: number;
  direction?: 'forward' | 'backward';
  timestamp: number;
}

export class CommandBuffer {
  private commands: MovementCommand[] = [];
  private nextCommandId: number = 1;
  private readonly MAX_BUFFER_SIZE = 100;

  /**
   * Add a new movement command to the buffer
   * @returns The command ID assigned to this command
   */
  addCommand(rotation: number, direction?: 'forward' | 'backward'): number {
    const commandId = this.nextCommandId++;
    const command: MovementCommand = {
      commandId,
      rotation,
      direction,
      timestamp: Date.now(),
    };

    this.commands.push(command);

    // Prevent buffer overflow
    if (this.commands.length > this.MAX_BUFFER_SIZE) {
      this.commands.shift();
    }

    return commandId;
  }

  /**
   * Get all commands with commandId > confirmedId
   */
  getUnconfirmedCommands(confirmedId: number): MovementCommand[] {
    return this.commands.filter(cmd => cmd.commandId > confirmedId);
  }

  /**
   * Remove all commands up to and including the confirmed command ID
   */
  removeConfirmedCommands(confirmedId: number): void {
    this.commands = this.commands.filter(cmd => cmd.commandId > confirmedId);
  }

  /**
   * Get the latest command ID
   */
  getLatestCommandId(): number {
    return this.commands.length > 0 
      ? this.commands[this.commands.length - 1].commandId 
      : 0;
  }

  /**
   * Clear all commands
   */
  clear(): void {
    this.commands = [];
    this.nextCommandId = 1;
  }

  /**
   * Get all commands (for debugging)
   */
  getAllCommands(): MovementCommand[] {
    return [...this.commands];
  }
}

