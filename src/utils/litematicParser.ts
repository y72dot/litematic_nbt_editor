
// Bit manipulation helper for Litematic BlockStates

// Helper to determine bits per block based on palette size
export function getBitsPerBlock(paletteSize: number): number {
  return Math.max(2, Math.ceil(Math.log2(paletteSize)));
}

/**
 * Unpacks BlockStates from Litematic/NBT format.
 * 
 * Litematic files can use different packing schemes depending on the Minecraft version.
 * - 1.16+ (and most modern Litematics): Non-spanning. Indices do not cross long boundaries.
 * - 1.13-1.15: Spanning. Indices are packed tightly and can cross long boundaries.
 * 
 * We will try to detect or default to 1.16+ (Non-spanning) as it is the current standard.
 * 
 * @param packedStates The BigInt64Array or similar from NBT
 * @param paletteSize The number of entries in the palette
 * @param volume The expected number of blocks (width * height * length)
 * @returns An array of block indices into the palette
 */
export function unpackBlockStates(
  packedStates: BigInt64Array | number[] | { [key: number]: number } | any, 
  paletteSize: number, 
  volume: number
): number[] {
  if (packedStates instanceof BigInt64Array) {
      // Convert to regular array of BigInts for easier handling, or keep as typed array
      // Let's keep as typed array if possible, but for mapping let's just use a loop.
      // Actually, let's just use the loop directly on the input.
      // We need to handle the input being potentially a regular array of numbers (if small enough?) 
      // or BigInts.
  } else {
      // Fallback for object-like structures if any
      console.warn("Unknown packedStates type", packedStates);
      return new Array(volume).fill(0);
  }

  // If packedStates is empty, return empty (or zeros)
  if (!packedStates || packedStates.length === 0) {
      return new Array(volume).fill(0);
  }

  const bitsPerBlock = getBitsPerBlock(paletteSize);
  const blocks = new Array(volume).fill(0);
  
  // 1.16+ Non-spanning logic
  // Capacity per long
  const blocksPerLong = Math.floor(64 / bitsPerBlock);
  const mask = (1n << BigInt(bitsPerBlock)) - 1n;

  for (let i = 0; i < volume; i++) {
    const longIndex = Math.floor(i / blocksPerLong);
    const subIndex = i % blocksPerLong;
    const bitOffset = subIndex * bitsPerBlock;
    
    // Check bounds
    // Note: packedStates might be an array or typed array.
    if (longIndex >= packedStates.length) {
       // It's possible for the last few blocks to be implied as 0 if the array is short?
       // Or maybe our volume calc is wrong.
       blocks[i] = 0; 
       continue;
    }

    const val = packedStates[longIndex];
    // Ensure BigInt
    const longVal = typeof val === 'bigint' ? val : BigInt(val);
    
    // Treat as unsigned for bitwise logic
    const unsignedLong = BigInt.asUintN(64, longVal);
    
    // Shift and mask
    const state = (unsignedLong >> BigInt(bitOffset)) & mask;
    blocks[i] = Number(state);
  }

  return blocks;
}

/**
 * Checks visibility for a block at (x, y, z) based on its neighbors.
 * Returns true if at least one neighbor is air (or transparent).
 * 
 * @param x Local x
 * @param y Local y
 * @param z Local z
 * @param width Region width (x size)
 * @param height Region height (y size)
 * @param length Region length (z size)
 * @param blocks 3D array or flat array of block indices
 * @param palette The palette to check for transparency (optional optimization)
 */
export function isBlockVisible(
    x: number, y: number, z: number,
    width: number, height: number, length: number,
    blocks: number[],
    // In the future: palette info to know if a neighbor is transparent (glass, etc.)
): boolean {
    // 6 neighbors
    const neighbors = [
        [x + 1, y, z],
        [x - 1, y, z],
        [x, y + 1, z],
        [x, y - 1, z],
        [x, y, z + 1],
        [x, y, z - 1]
    ];

    for (const [nx, ny, nz] of neighbors) {
        // If neighbor is out of bounds, it's "air" (visible)
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || nz < 0 || nz >= length) {
            return true;
        }

        // Get neighbor block ID
        // Litematic uses (y * length + z) * width + x order usually? 
        // Or (y * width * length) + z * width + x?
        // Standard Minecraft: (y * length + z) * width + x  <-- YZX order?
        // Wait, let's verify index order.
        // Litematic/Schematic usually: YZX or XYZ?
        // Standard NBT usually: Y * (Length * Width) + Z * Width + X  (Y, Z, X)
        // Let's assume standard YZX for now.
        const nIndex = (ny * length + nz) * width + nx;
        
        const neighborBlockId = blocks[nIndex];
        
        // If neighbor is air (ID 0 usually), then current block is visible
        // TODO: Handle transparent blocks like glass
        if (neighborBlockId === 0) {
            return true;
        }
    }

    // All neighbors are solid blocks -> Hidden
    return false;
}
