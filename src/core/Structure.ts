import { Region } from './Region';
import type { Schematic } from './Schematic';
import type { LitematicMetadata } from '../types';
import { ArrayBlockStorage } from './ArrayBlockStorage';

export class Structure implements Schematic {
  public metadata: LitematicMetadata;
  public regions: Region[] = [];
  public rawNbt: any;

  constructor(nbtData: any) {
    this.rawNbt = nbtData;
    const root = nbtData.value;
    
    // Parse Size (List of 3 Ints)
    // Structure format uses a List of 3 Ints for size
    let sizeX = 0, sizeY = 0, sizeZ = 0;
    
    if (root.size && root.size.value) {
       const sizeVal = root.size.value;
       // Check if it's a list of Int tags or just array
       if (Array.isArray(sizeVal.value)) {
           // It's likely an array of tags
           sizeX = sizeVal.value[0].value;
           sizeY = sizeVal.value[1].value;
           sizeZ = sizeVal.value[2].value;
       } else {
           // Fallback/Unknown structure
           console.warn("Unknown size structure", root.size);
       }
    }

    const size = { x: sizeX, y: sizeY, z: sizeZ };

    // Parse Palette
    // Structure files can have 'palette' (List) or 'palettes' (List of Lists)
    let rawPalette: any[] = [];
    if (root.palette && root.palette.value) {
        rawPalette = root.palette.value.value;
    } else if (root.palettes && root.palettes.value) {
        // Just take the first palette for now
        const palettes = root.palettes.value.value;
        if (palettes.length > 0) {
            rawPalette = palettes[0].value;
        }
    }

    const fullPalette = rawPalette.map((p: any) => {
        const props: Record<string, string> = {};
        if (p.Properties && p.Properties.value) {
            Object.entries(p.Properties.value).forEach(([key, val]: [string, any]) => {
                props[key] = val.value;
            });
        }
        return {
            Name: p.Name ? p.Name.value : "minecraft:air",
            Properties: Object.keys(props).length > 0 ? props : undefined
        };
    });

    // Initialize Storage
    const storage = new ArrayBlockStorage(size, fullPalette.length);
    
    // Parse Blocks
    // 'blocks' is a List of Compounds
    if (root.blocks && root.blocks.value) {
        const blocks = root.blocks.value.value;
        if (Array.isArray(blocks)) {
            for (const block of blocks) {
                if (!block.pos || !block.pos.value) continue;
                
                const posVal = block.pos.value.value; // List of Ints -> Array of Tags
                const x = posVal[0].value;
                const y = posVal[1].value;
                const z = posVal[2].value;
                
                const state = block.state ? block.state.value : 0;
                
                storage.setBlockIndex(x, y, z, state);
            }
        }
    }

    // Create Region
    // Structure blocks are usually relative to (0,0,0)
    const region = Region.createFromData("main", size, {x:0, y:0, z:0}, fullPalette, storage);
    this.regions.push(region);

    // Metadata
    // Structure files don't have standard metadata like Litematic
    this.metadata = {
        name: "structure.nbt",
        author: "Unknown",
        description: "Imported from .nbt structure file",
        regions: 1,
        size: size,
        enclosingSize: size,
        timeCreated: new Date().toLocaleString(),
        timeModified: new Date().toLocaleString()
    };
  }

  toNbt(): any {
      // Return rawNbt for now
      return this.rawNbt;
  }

  getRegion(name: string): Region | undefined {
      return this.regions.find(r => r.name === name);
  }

  getBlock(x: number, y: number, z: number): { Name: string, Properties?: Record<string, string> } | null {
    for (const region of this.regions) {
        const rx = x - region.position.x;
        const ry = y - region.position.y;
        const rz = z - region.position.z;

        if (rx >= 0 && rx < region.size.x &&
            ry >= 0 && ry < region.size.y &&
            rz >= 0 && rz < region.size.z) {
            
            try {
                const index = region.storage.getBlockIndex(rx, ry, rz);
                if (index >= 0 && index < region.fullPalette.length) {
                    return region.fullPalette[index];
                }
            } catch (e) {
                // ignore
            }
        }
    }
    return null;
  }

  renameBlock(oldName: string, newName: string): void {
    // 1. Update in-memory regions
    this.regions.forEach(region => {
      region.fullPalette.forEach(p => {
        if (p.Name === oldName) p.Name = newName;
      });
      region.palette = region.fullPalette.map(p => p.Name);
    });

    // 2. Update raw NBT
    const root = this.rawNbt.value;
    
    const updatePaletteList = (list: any[]) => {
        list.forEach((p: any) => {
            if (p.Name && p.Name.value === oldName) {
                p.Name.value = newName;
            }
        });
    };

    if (root.palette && root.palette.value) {
        const list = root.palette.value.value;
        if (Array.isArray(list)) updatePaletteList(list);
    }
    
    if (root.palettes && root.palettes.value) {
        const lists = root.palettes.value.value;
        if (Array.isArray(lists)) {
            lists.forEach((l: any) => {
                if (l.value && Array.isArray(l.value)) {
                    updatePaletteList(l.value);
                }
            });
        }
    }
  }
}
