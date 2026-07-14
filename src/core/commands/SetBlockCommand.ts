import type { EditCommand } from './EditCommand';
import type { Schematic } from '../Schematic';

/**
 * Command for setting a single block.
 * Stores the old and new block names so the operation can be undone.
 */
export class SetBlockCommand implements EditCommand {
  private schematic: Schematic;
  private x: number;
  private y: number;
  private z: number;
  private oldName: string;
  private newName: string;

  constructor(
    schematic: Schematic,
    x: number,
    y: number,
    z: number,
    newName: string,
  ) {
    this.schematic = schematic;
    this.x = x;
    this.y = y;
    this.z = z;
    this.newName = newName;

    // Capture current block before the edit
    const current = schematic.getBlock(x, y, z);
    this.oldName = current?.Name ?? 'minecraft:air';
  }

  execute(): void {
    this.schematic.setBlock(this.x, this.y, this.z, this.newName);
  }

  undo(): void {
    this.schematic.setBlock(this.x, this.y, this.z, this.oldName);
  }

  getLabel(): string {
    return `Set block at (${this.x}, ${this.y}, ${this.z}): ${this.oldName} → ${this.newName}`;
  }
}
