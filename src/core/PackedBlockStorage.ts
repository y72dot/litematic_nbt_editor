import type { BlockStorage, TraversalOrder } from './BlockStorage';

// Bit manipulation helper
function getBitsPerBlock(paletteSize: number): number {
  return Math.max(2, Math.ceil(Math.log2(paletteSize)));
}

/**
 * Handles packed block states from Litematic/NBT.
 * Supports both Spanning (1.13-1.15) and Non-spanning (1.16+) formats.
 */
export class PackedBlockStorage implements BlockStorage {
  private packedData: BigInt64Array;
  private paletteSize: number;
  private size: { x: number, y: number, z: number };
  private bitsPerBlock: number;
  private mask: bigint;
  public version: 'spanning' | 'non-spanning';
  public traversalOrder: TraversalOrder = 'YZX';

  constructor(
    packedData: BigInt64Array | number[] | any,
    paletteSize: number,
    size: { x: number, y: number, z: number },
    version: 'spanning' | 'non-spanning' = 'non-spanning' // Default to 1.16+
  ) {
    // Normalize data
    if (packedData instanceof BigInt64Array) {
      this.packedData = packedData;
    } else if (Array.isArray(packedData)) {
      this.packedData = new BigInt64Array(packedData.map(v => BigInt(v)));
    } else {
      console.warn("PackedBlockStorage: Unknown data format, initializing empty");
      this.packedData = new BigInt64Array(0);
    }

    this.paletteSize = paletteSize;
    this.size = size;
    this.version = version;
    this.bitsPerBlock = getBitsPerBlock(paletteSize);
    this.mask = (1n << BigInt(this.bitsPerBlock)) - 1n;
  }

  getSize() {
    return this.size;
  }

  getPaletteSize() {
    return this.paletteSize;
  }

  setTraversalOrder(order: TraversalOrder) {
    this.traversalOrder = order;
  }

  // Calculate linear index from (x, y, z)
  // Default Litematic order: (y * length + z) * width + x  (YZX)
  private getLinearIndex(x: number, y: number, z: number): number {
    const { x: sx, y: sy, z: sz } = this.size;
    switch (this.traversalOrder) {
        case 'YZX': return (y * sz + z) * sx + x;
        case 'YXZ': return (y * sx + x) * sz + z;
        case 'XYZ': return (x * sy + y) * sz + z;
        case 'XZY': return (x * sz + z) * sy + y;
        case 'ZXY': return (z * sx + x) * sy + y;
        case 'ZYX': return (z * sy + y) * sx + x;
        default: return (y * sz + z) * sx + x;
    }
  }

  getBlockIndex(x: number, y: number, z: number): number {
    const index = this.getLinearIndex(x, y, z);
    
    if (this.version === 'non-spanning') {
      return this.readNonSpanning(index);
    } else {
      return this.readSpanning(index);
    }
  }

  // 1.16+ Logic: items do not span across longs
  private readNonSpanning(index: number): number {
    const blocksPerLong = Math.floor(64 / this.bitsPerBlock);
    const longIndex = Math.floor(index / blocksPerLong);
    const subIndex = index % blocksPerLong;
    const bitOffset = subIndex * this.bitsPerBlock;

    if (longIndex < 0 || longIndex >= this.packedData.length) return 0;

    const longVal = this.packedData[longIndex];
    // Treat as unsigned for bitwise logic
    const unsignedLong = BigInt.asUintN(64, longVal);
    const state = (unsignedLong >> BigInt(bitOffset)) & this.mask;
    return Number(state);
  }

  // 1.13-1.15 Logic: items are packed tightly and can span across longs
  private readSpanning(index: number): number {
    const startBit = BigInt(index) * BigInt(this.bitsPerBlock);
    const startLongIndex = Number(startBit / 64n);
    const bitOffset = Number(startBit % 64n);
    const endLongIndex = Number((startBit + BigInt(this.bitsPerBlock) - 1n) / 64n);

    if (startLongIndex < 0 || startLongIndex >= this.packedData.length) return 0;

    if (startLongIndex === endLongIndex) {
      // Simple case: fits in one long
      const longVal = this.packedData[startLongIndex];
      const unsignedLong = BigInt.asUintN(64, longVal);
      return Number((unsignedLong >> BigInt(bitOffset)) & this.mask);
    } else {
      // Complex case: spans two longs
      // Read first part
      const bitsInFirst = 64 - bitOffset;
      const val1 = BigInt.asUintN(64, this.packedData[startLongIndex]) >> BigInt(bitOffset);
      
      // Read second part (if within bounds)
      let val2 = 0n;
      if (endLongIndex < this.packedData.length) {
        val2 = BigInt.asUintN(64, this.packedData[endLongIndex]);
        // Mask for the remaining bits: (1 << (bitsPerBlock - bitsInFirst)) - 1
        const remainingBits = this.bitsPerBlock - bitsInFirst;
        const mask2 = (1n << BigInt(remainingBits)) - 1n;
        val2 = val2 & mask2;
      }

      // Combine: (val2 << bitsInFirst) | val1
      return Number((val2 << BigInt(bitsInFirst)) | val1);
    }
  }

  setBlockIndex(_x: number, _y: number, _z: number, _index: number): void {
    throw new Error("PackedBlockStorage is Read-Only. Convert to ArrayBlockStorage to edit.");
  }

  toArray(): Uint32Array {
    const volume = this.size.x * this.size.y * this.size.z;
    const arr = new Uint32Array(volume);
    
    // Iterate in standard YZX order
    // This ensures that the output array is always compatible with the viewer's loop
    // regardless of how the data is packed internally (traversalOrder).
    
    let i = 0;
    const { x: sizeX, y: sizeY, z: sizeZ } = this.size;

    for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
            for (let x = 0; x < sizeX; x++) {
                // getBlockIndex will handle the internal coordinate mapping
                // based on traversalOrder and version
                arr[i] = this.getBlockIndex(x, y, z);
                i++;
            }
        }
    }
    return arr;
  }
}
