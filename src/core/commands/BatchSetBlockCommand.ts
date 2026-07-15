import type { EditCommand } from './EditCommand';
import type { Schematic } from '../Schematic';

interface BlockChange {
  x: number;
  y: number;
  z: number;
  oldName: string;
  newName: string;
}

/**
 * Command for setting multiple blocks at once (e.g., batch replace).
 * All changes are applied/undone together as a single atomic operation.
 */
export class BatchSetBlockCommand implements EditCommand {
  private schematic: Schematic;
  private changes: BlockChange[];
  private label: string;

  constructor(
    schematic: Schematic,
    positions: Array<{ x: number; y: number; z: number }>,
    newName: string,
  ) {
    this.schematic = schematic;
    this.label = `Replace ${positions.length} blocks with ${newName}`;

    this.changes = positions.map(pos => {
      const current = schematic.getBlock(pos.x, pos.y, pos.z);
      return {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        oldName: current?.Name ?? 'minecraft:air',
        newName,
      };
    });
  }

  execute(): void {
    for (const c of this.changes) {
      this.schematic.setBlock(c.x, c.y, c.z, c.newName);
    }
  }

  undo(): void {
    for (const c of this.changes) {
      this.schematic.setBlock(c.x, c.y, c.z, c.oldName);
    }
  }

  getLabel(): string {
    return this.label;
  }
}
