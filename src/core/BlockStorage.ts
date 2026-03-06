// Abstract interface for accessing block data
// This allows us to have different implementations:
// 1. BitPackedBlockStorage: Reads directly from packed longs (ReadOnly, Memory efficient)
// 2. ArrayBlockStorage: Unpacked UintArray (ReadWrite, Fast)

export type TraversalOrder = 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX';

export interface BlockStorage {
  getSize(): { x: number, y: number, z: number };
  getPaletteSize(): number;
  
  // Access a block index (index into the palette)
  getBlockIndex(x: number, y: number, z: number): number;
  
  // Set a block index (only supported by some implementations)
  setBlockIndex(x: number, y: number, z: number, index: number): void;
  
  // Convert to a flat array (useful for meshing)
  // Returns indices
  toArray(): Uint16Array | Uint32Array | number[];
}
