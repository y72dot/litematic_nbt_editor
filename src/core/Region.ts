import type { BlockStorage, TraversalOrder } from './BlockStorage';
import { PackedBlockStorage } from './PackedBlockStorage';
import { ArrayBlockStorage } from './ArrayBlockStorage';

// Region structure abstraction
export class Region {
  public name: string;
  public size: { x: number, y: number, z: number };
  public position: { x: number, y: number, z: number };
  public palette: string[];
  public fullPalette: { Name: string, Properties?: Record<string, string> }[];
  public storage: BlockStorage;

  constructor(name: string, rawRegionData: any, defaultMethod: 'spanning' | 'non-spanning' = 'non-spanning') {
    this.name = name;
    
    if (rawRegionData) {
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

      this.fullPalette = Array.isArray(rawPalette)
        ? rawPalette.map((p: any) => {
            const props: Record<string, string> = {};
            if (p.Properties && p.Properties.value) {
              Object.entries(p.Properties.value).forEach(([key, val]: [string, any]) => {
                props[key] = val.value;
              });
            }
            return {
              Name: p.Name ? p.Name.value : "unknown",
              Properties: Object.keys(props).length > 0 ? props : undefined
            };
          })
        : [];

      // Initialize Storage
      // Default to Packed storage for read efficiency
      const blockStates = rawRegionData.BlockStates.value;
      this.storage = new PackedBlockStorage(blockStates, this.palette.length, this.size, defaultMethod);
    } else {
      // Manual initialization path
      this.size = { x: 0, y: 0, z: 0 };
      this.position = { x: 0, y: 0, z: 0 };
      this.palette = [];
      this.fullPalette = [];
      this.storage = new ArrayBlockStorage({x:0, y:0, z:0}, 0, new Int32Array(0));
    }
  }

  static createFromData(name: string, size: {x: number, y: number, z: number}, position: {x: number, y: number, z: number}, fullPalette: {Name: string, Properties?: Record<string, string>}[], storage: BlockStorage): Region {
    const region = new Region(name, null);
    region.size = size;
    region.position = position;
    region.fullPalette = fullPalette;
    region.palette = fullPalette.map(p => p.Name);
    region.storage = storage;
    return region;
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
