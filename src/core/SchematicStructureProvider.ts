import { BlockState, type StructureProvider } from 'deepslate';
import type { Schematic } from './Schematic';

/**
 * A StructureProvider that wraps a Schematic data model directly.
 *
 * Unlike deepslate's built-in Structure class, this provider reads live data
 * from the Schematic's ArrayBlockStorage. Editing the Schematic (via setBlock)
 * automatically reflects in getBlock / getBlocks with zero-copy overhead.
 *
 * Coordinate system: deepslate uses local coordinates starting at (0,0,0).
 * This provider computes the bounding box of all regions and subtracts the
 * global min corner so that getBlock/getBlocks return local positions.
 */
export class SchematicStructureProvider implements StructureProvider {
  private schematic: Schematic;
  public readonly minX: number;
  public readonly minY: number;
  public readonly minZ: number;
  private size: [number, number, number];
  private blockStateCache: Map<string, BlockState> = new Map();

  constructor(schematic: Schematic) {
    this.schematic = schematic;

    // Calculate global bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const region of schematic.regions) {
      const { x, y, z } = region.position;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x + region.size.x);
      maxY = Math.max(maxY, y + region.size.y);
      maxZ = Math.max(maxZ, z + region.size.z);
    }

    if (schematic.regions.length === 0) {
      minX = minY = minZ = 0;
      maxX = maxY = maxZ = 1;
    }

    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.size = [maxX - minX, maxY - minY, maxZ - minZ];
  }

  getSize(): [number, number, number] {
    return this.size;
  }

  getBlock(pos: [number, number, number]): { pos: [number, number, number]; state: BlockState } | null {
    const gx = pos[0] + this.minX;
    const gy = pos[1] + this.minY;
    const gz = pos[2] + this.minZ;

    const block = this.schematic.getBlock(gx, gy, gz);
    if (!block || block.Name === 'minecraft:air') return null;

    const state = this.getOrCreateBlockState(block.Name, block.Properties);
    return { pos, state };
  }

  getBlocks(): { pos: [number, number, number]; state: BlockState }[] {
    const result: { pos: [number, number, number]; state: BlockState }[] = [];

    for (const region of this.schematic.regions) {
      const { x: rX, y: rY, z: rZ } = region.position;
      const { x: sX, y: sY, z: sZ } = region.size;

      for (let x = 0; x < sX; x++) {
        for (let y = 0; y < sY; y++) {
          for (let z = 0; z < sZ; z++) {
            const idx = region.storage.getBlockIndex(x, y, z);
            const block = region.fullPalette[idx];
            if (!block || block.Name === 'minecraft:air') continue;

            const state = this.getOrCreateBlockState(block.Name, block.Properties);
            result.push({
              pos: [rX + x - this.minX, rY + y - this.minY, rZ + z - this.minZ],
              state,
            });
          }
        }
      }
    }

    return result;
  }

  private getOrCreateBlockState(name: string, properties?: Record<string, string>): BlockState {
    const key = name + (properties ? '|' + JSON.stringify(properties) : '');
    let state = this.blockStateCache.get(key);
    if (!state) {
      state = new BlockState(name, properties);
      this.blockStateCache.set(key, state);
    }
    return state;
  }
}
