import type { BlockStorage } from './BlockStorage';

/**
 * A simple array-based block storage.
 * Ideal for editing and rendering.
 */
export class ArrayBlockStorage implements BlockStorage {
  private data: Uint16Array | Uint32Array; // Use typed array for memory efficiency
  private paletteSize: number;
  private size: { x: number, y: number, z: number };

  constructor(
    size: { x: number, y: number, z: number },
    paletteSize: number,
    initialData?: number[] | Uint16Array | Uint32Array
  ) {
    this.size = size;
    this.paletteSize = paletteSize;
    
    const volume = size.x * size.y * size.z;
    
    // Choose appropriate array type based on palette size
    if (paletteSize < 65536) {
      this.data = new Uint16Array(volume);
    } else {
      this.data = new Uint32Array(volume);
    }

    if (initialData) {
      this.data.set(initialData);
    }
  }

  getSize() {
    return this.size;
  }

  getPaletteSize() {
    return this.paletteSize;
  }

  private getLinearIndex(x: number, y: number, z: number): number {
    return (y * this.size.z + z) * this.size.x + x;
  }

  getBlockIndex(x: number, y: number, z: number): number {
    if (x < 0 || x >= this.size.x || y < 0 || y >= this.size.y || z < 0 || z >= this.size.z) {
      return 0; // Air
    }
    return this.data[this.getLinearIndex(x, y, z)];
  }

  setBlockIndex(x: number, y: number, z: number, index: number): void {
    if (x < 0 || x >= this.size.x || y < 0 || y >= this.size.y || z < 0 || z >= this.size.z) {
      return;
    }
    this.data[this.getLinearIndex(x, y, z)] = index;
  }

  toArray(): Uint16Array | Uint32Array {
    return this.data;
  }
}
