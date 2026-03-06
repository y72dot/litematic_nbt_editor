import type { BlockStorage, TraversalOrder } from './BlockStorage';
import { PackedBlockStorage } from './PackedBlockStorage';
import { ArrayBlockStorage } from './ArrayBlockStorage';

// Region structure abstraction
export class Region {
  public name: string;
  public size: { x: number, y: number, z: number };
  public position: { x: number, y: number, z: number };
  public palette: string[];
  public storage: BlockStorage;

  constructor(name: string, rawRegionData: any, defaultMethod: 'spanning' | 'non-spanning' = 'non-spanning') {
    this.name = name;
    
    // Parse dimensions
    const sizeX = rawRegionData.Size.value.x.value;
    const sizeY = rawRegionData.Size.value.y.value;
    const sizeZ = rawRegionData.Size.value.z.value;
    
    const posX = rawRegionData.Position.value.x.value;
    const posY = rawRegionData.Position.value.y.value;
    const posZ = rawRegionData.Position.value.z.value;

    // Handle negative sizes
    this.size = { x: Math.abs(sizeX), y: Math.abs(sizeY), z: Math.abs(sizeZ) };
    
    // Adjust position if size is negative
    // Litematic: if size is negative, the region starts at pos + size (conceptually)
    this.position = {
      x: sizeX < 0 ? posX + sizeX : posX,
      y: sizeY < 0 ? posY + sizeY : posY,
      z: sizeZ < 0 ? posZ + sizeZ : posZ
    };

    // Parse Palette
    // Handle wrapped lists
    let rawPalette = rawRegionData.BlockStatePalette.value;
    if (!Array.isArray(rawPalette) && rawPalette && rawPalette.value && Array.isArray(rawPalette.value)) {
      rawPalette = rawPalette.value;
    }
    
    this.palette = Array.isArray(rawPalette) 
      ? rawPalette.map((p: any) => p.Name ? p.Name.value : "unknown")
      : [];

    // Initialize Storage
    // Default to Packed storage for read efficiency
    // We can auto-detect version or allow override.
    // For now, let's try to detect if the data looks valid with non-spanning (default)
    // or provide a switch.
    
    const blockStates = rawRegionData.BlockStates.value;
    
    // We default to 'non-spanning' (1.16+) as it is modern standard.
    // If we need to support old files, we might need a heuristic or user input.
    this.storage = new PackedBlockStorage(blockStates, this.palette.length, this.size, defaultMethod);
  }

  // Switch to editable storage (unpacks everything)
  enableEditing() {
    if (this.storage instanceof ArrayBlockStorage) return;
    
    const unpacked = this.storage.toArray();
    this.storage = new ArrayBlockStorage(this.size, this.palette.length, unpacked);
  }
  
  // Switch algorithm
  setUnpackingMethod(method: 'spanning' | 'non-spanning') {
      // Only applicable if we are still using PackedBlockStorage and haven't edited
      if (this.storage instanceof PackedBlockStorage) {
        this.storage.version = method;
      }
  }

  setTraversalOrder(order: TraversalOrder) {
    if (this.storage instanceof PackedBlockStorage) {
      this.storage.setTraversalOrder(order);
    }
  }
}
