import { Region } from './Region';
import type { Schematic } from './Schematic';
import type { LitematicMetadata } from '../types';

export class Litematic implements Schematic {
  public metadata: LitematicMetadata;
  public regions: Region[] = [];
  public rawNbt: any;
  public version: number = 6; // Default to 6 (1.16+)
  public preferredFormat: 'spanning' | 'non-spanning' = 'non-spanning';

  constructor(nbtData: any) {
    this.rawNbt = nbtData;
    const root = nbtData.value || {};
    
    // Parse Version
    if (root.Version) {
      this.version = root.Version.value;
    }

    // Determine preferred format based on version
    // Version 6+ -> 1.16+ (non-spanning)
    // Version < 6 -> 1.13-1.15 (spanning)
    if (this.version < 6) {
      this.preferredFormat = 'spanning';
    }

    // Parse Metadata
    const meta = root.Metadata?.value || {};
    const enclosingSize = meta.EnclosingSize?.value || {};

    this.metadata = {
      name: meta.Name?.value || '',
      author: meta.Author?.value || '',
      description: meta.Description?.value || '',
      regions: root.Regions?.value ? Object.keys(root.Regions.value).length : 0,
      size: enclosingSize.x ? 
        { x: enclosingSize.x.value, y: enclosingSize.y.value, z: enclosingSize.z.value } : 
        'Unknown',
      enclosingSize: enclosingSize.x ? 
        { x: enclosingSize.x.value, y: enclosingSize.y.value, z: enclosingSize.z.value } : 
        'Unknown',
      timeCreated: meta.TimeCreated?.value ? new Date(Number(meta.TimeCreated.value)).toLocaleString() : 'Unknown',
      timeModified: meta.TimeModified?.value ? new Date(Number(meta.TimeModified.value)).toLocaleString() : 'Unknown'
    };

    // Parse Regions
    if (root.Regions) {
      const regionsMap = root.Regions.value;
      Object.keys(regionsMap).forEach(name => {
        this.regions.push(new Region(name, regionsMap[name].value, this.preferredFormat));
      });
    }
  }

  // Get a region by name
  getRegion(name: string): Region | undefined {
    return this.regions.find(r => r.name === name);
  }

  toNbt(): any {
    const root = this.rawNbt.value;
    if (!root.Metadata) root.Metadata = { type: 'compound', value: {} };
    const metaVal = root.Metadata.value;
    
    metaVal.Name = { type: 'string', value: this.metadata.name };
    metaVal.Author = { type: 'string', value: this.metadata.author };
    metaVal.Description = { type: 'string', value: this.metadata.description };
    
    const now = Date.now();
    // Use BigInt for long if environment supports it, usually required for NBT long
    metaVal.TimeModified = { type: 'long', value: (typeof BigInt !== 'undefined') ? BigInt(now) : [0, now] };

    return this.rawNbt;
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
        
        try {
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

  renameBlock(oldName: string, newName: string): void {
    // 1. Update in-memory regions
    this.regions.forEach(region => {
      // Update fullPalette objects (references)
      region.fullPalette.forEach(p => {
        if (p.Name === oldName) p.Name = newName;
      });
      // Re-generate palette string array
      region.palette = region.fullPalette.map(p => p.Name);
    });

    // 2. Update raw NBT data
    // Litematic stores palette in each region under BlockStatePalette
    if (this.rawNbt.value && this.rawNbt.value.Regions) {
        const regionsMap = this.rawNbt.value.Regions.value;
        Object.keys(regionsMap).forEach(key => {
            const regionComp = regionsMap[key].value;
            let palette = regionComp.BlockStatePalette.value;
            // Handle if it's wrapped
            if (!Array.isArray(palette) && palette && palette.value && Array.isArray(palette.value)) {
                palette = palette.value;
            }
            if (Array.isArray(palette)) {
                palette.forEach((p: any) => {
                    if (p.Name && p.Name.value === oldName) {
                        p.Name.value = newName;
                    }
                });
            }
        });
    }
  }
}
