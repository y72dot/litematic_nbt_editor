import type { Schematic } from './Schematic';
import type { Region } from './Region';
import type { LitematicMetadata } from '../types';

/**
 * Abstract base class for Schematic implementations (Litematic, Structure).
 * Provides common logic for getRegion, getBlock, renameBlock, and setBlock.
 */
export abstract class BaseSchematic implements Schematic {
  abstract metadata: LitematicMetadata;
  abstract regions: Region[];
  abstract rawNbt: any;

  abstract toNbt(): any;

  // ── Common: get region by name ───────────────────────────────

  getRegion(name: string): Region | undefined {
    return this.regions.find(r => r.name === name);
  }

  // ── Common: get block at global coordinates ──────────────────

  getBlock(x: number, y: number, z: number): { Name: string; Properties?: Record<string, string> } | null {
    for (const region of this.regions) {
      const rx = x - region.position.x;
      const ry = y - region.position.y;
      const rz = z - region.position.z;

      if (
        rx >= 0 && rx < region.size.x &&
        ry >= 0 && ry < region.size.y &&
        rz >= 0 && rz < region.size.z
      ) {
        try {
          const index = region.storage.getBlockIndex(rx, ry, rz);
          if (index >= 0 && index < region.fullPalette.length) {
            return region.fullPalette[index];
          }
        } catch (_e) {
          // ignore
        }
      }
    }
    return null;
  }

  // ── Common: rename block (memory part) ───────────────────────

  renameBlock(oldName: string, newName: string): void {
    // Update in-memory regions
    this.regions.forEach(region => {
      region.fullPalette.forEach(p => {
        if (p.Name === oldName) p.Name = newName;
      });
      region.palette = region.fullPalette.map(p => p.Name);
    });

    // Delegate rawNbt update to subclass
    this.renameBlockInRawNbt(oldName, newName);
  }

  /** Subclasses implement this to update their format-specific rawNbt palette entries. */
  protected abstract renameBlockInRawNbt(oldName: string, newName: string): void;

  // ── Common: set a block at global coordinates (memory only) ──

  setBlock(x: number, y: number, z: number, blockName: string): boolean {
    for (const region of this.regions) {
      const rx = x - region.position.x;
      const ry = y - region.position.y;
      const rz = z - region.position.z;

      if (
        rx >= 0 && rx < region.size.x &&
        ry >= 0 && ry < region.size.y &&
        rz >= 0 && rz < region.size.z
      ) {
        // Ensure storage is editable (lazy conversion from packed to array)
        region.enableEditing();

        // Find or create palette entry
        let paletteIndex = region.fullPalette.findIndex(p => p.Name === blockName);
        if (paletteIndex === -1) {
          region.fullPalette.push({ Name: blockName });
          region.palette.push(blockName);
          paletteIndex = region.fullPalette.length - 1;
        }

        region.storage.setBlockIndex(rx, ry, rz, paletteIndex);
        return true;
      }
    }
    return false;
  }

  // ── Static: encode flat block data → packed BigInt64Array ────

  public static encodeBlockStates(
    data: Uint16Array | Uint32Array | number[],
    bitsPerBlock: number,
    size: { x: number; y: number; z: number },
    version: 'spanning' | 'non-spanning',
  ): BigInt64Array {
    const volume = size.x * size.y * size.z;
    const longCount = Math.max(1, Math.ceil((volume * bitsPerBlock) / 64));
    const result = new BigInt64Array(longCount);
    const mask = (1n << BigInt(bitsPerBlock)) - 1n;

    if (version === 'non-spanning') {
      const blocksPerLong = Math.floor(64 / bitsPerBlock);
      for (let i = 0; i < volume; i++) {
        const value = BigInt(data[i]);
        if (value === 0n) continue;
        const longIndex = Math.floor(i / blocksPerLong);
        const bitOffset = (i % blocksPerLong) * bitsPerBlock;
        result[longIndex] |= (value & mask) << BigInt(bitOffset);
      }
    } else {
      // Spanning: values may cross long boundaries
      for (let i = 0; i < volume; i++) {
        const value = BigInt(data[i]);
        if (value === 0n) continue;
        const startBit = BigInt(i) * BigInt(bitsPerBlock);
        const startLongIndex = Number(startBit / 64n);
        const bitOffset = Number(startBit % 64n);
        const endLongIndex = Number((startBit + BigInt(bitsPerBlock) - 1n) / 64n);

        if (startLongIndex === endLongIndex) {
          result[startLongIndex] |= (value & mask) << BigInt(bitOffset);
        } else {
          const bitsInFirst = 64 - bitOffset;
          const lowerMask = (1n << BigInt(bitsInFirst)) - 1n;
          result[startLongIndex] |= (value & lowerMask) << BigInt(bitOffset);
          if (endLongIndex < longCount) {
            const remainingBits = bitsPerBlock - bitsInFirst;
            result[endLongIndex] |= (value >> BigInt(bitsInFirst)) & ((1n << BigInt(remainingBits)) - 1n);
          }
        }
      }
    }

    return result;
  }
}
