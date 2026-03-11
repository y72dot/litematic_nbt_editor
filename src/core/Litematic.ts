import { Region } from './Region';

export class Litematic {
  public metadata: any;
  public regions: Region[] = [];
  public rawNbt: any;
  public version: number = 6; // Default to 6 (1.16+)
  public preferredFormat: 'spanning' | 'non-spanning' = 'non-spanning';

  constructor(nbtData: any) {
    this.rawNbt = nbtData;
    
    // Parse Version
    if (nbtData.value && nbtData.value.Version) {
      this.version = nbtData.value.Version.value;
    }

    // Determine preferred format based on version
    // Version 6+ -> 1.16+ (non-spanning)
    // Version < 6 -> 1.13-1.15 (spanning)
    if (this.version < 6) {
      this.preferredFormat = 'spanning';
    }

    // Parse Metadata
    if (nbtData.value && nbtData.value.Metadata) {
      this.metadata = nbtData.value.Metadata.value;
    }

    // Parse Regions
    if (nbtData.value && nbtData.value.Regions) {
      const regionsMap = nbtData.value.Regions.value;
      Object.keys(regionsMap).forEach(name => {
        this.regions.push(new Region(name, regionsMap[name].value, this.preferredFormat));
      });
    }
  }

  // Get a region by name
  getRegion(name: string): Region | undefined {
    return this.regions.find(r => r.name === name);
  }

  // Get block at global coordinates
  getBlock(x: number, y: number, z: number): { Name: string, Properties?: Record<string, string> } | null {
    for (const region of this.regions) {
      const rx = x - region.position.x;
      const ry = y - region.position.y;
      const rz = z - region.position.z;

      // Check if inside region bounds
      if (rx >= 0 && rx < region.size.x &&
          ry >= 0 && ry < region.size.y &&
          rz >= 0 && rz < region.size.z) {
        
        // Found the region!
        // We need to access region's storage, but Region class currently hides it or doesn't expose getBlockIndex easily
        // Let's assume Region has a getBlockState method or we add one.
        // Checking Region.ts...
        // Region has 'storage' public, and 'fullPalette' public.
        
        try {
            // PackedBlockStorage usually needs to be initialized or used carefully.
            // Let's check Region.ts again.
            // The storage has getBlockIndex(x, y, z).
            const index = region.storage.getBlockIndex(rx, ry, rz);
            if (index >= 0 && index < region.fullPalette.length) {
                return region.fullPalette[index];
            }
        } catch (e) {
            console.error('Error getting block from region:', e);
        }
      }
    }
    return null;
  }
}
