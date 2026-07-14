import { Region } from './Region';
import { BaseSchematic } from './BaseSchematic';
import type { LitematicMetadata } from '../types';
import { ArrayBlockStorage } from './ArrayBlockStorage';

export class Structure extends BaseSchematic {
  public metadata: LitematicMetadata;
  public regions: Region[] = [];
  public rawNbt: any;

  constructor(nbtData: any) {
    super();
    this.rawNbt = nbtData;
    const root = nbtData.value;

    // Parse Size
    let sizeX = 0, sizeY = 0, sizeZ = 0;

    if (root.size && root.size.value) {
      const sizeVal = root.size.value;
      if (Array.isArray(sizeVal.value)) {
        sizeX = sizeVal.value[0].value;
        sizeY = sizeVal.value[1].value;
        sizeZ = sizeVal.value[2].value;
      } else {
        console.warn("Unknown size structure", root.size);
      }
    }

    const size = { x: sizeX, y: sizeY, z: sizeZ };

    // Parse Palette
    let rawPalette: any[] = [];
    if (root.palette && root.palette.value) {
      rawPalette = root.palette.value.value;
    } else if (root.palettes && root.palettes.value) {
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
    if (root.blocks && root.blocks.value) {
      const blocks = root.blocks.value.value;
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          if (!block.pos || !block.pos.value) continue;

          const posVal = block.pos.value.value;
          const x = posVal[0].value;
          const y = posVal[1].value;
          const z = posVal[2].value;

          const state = block.state ? block.state.value : 0;

          storage.setBlockIndex(x, y, z, state);
        }
      }
    }

    // Create Region
    const region = Region.createFromData("main", size, { x: 0, y: 0, z: 0 }, fullPalette, storage);
    this.regions.push(region);

    // Metadata
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

  // ── Format-specific rawNbt update for renameBlock ────────────

  protected renameBlockInRawNbt(oldName: string, newName: string): void {
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

  // ── Serialize current state back to NBT ──────────────────────

  toNbt(): any {
    const root = this.rawNbt.value;
    const region = this.regions[0];
    if (!region) return this.rawNbt;

    const flatData = region.storage.toArray();
    const { x: sizeX, y: sizeY, z: sizeZ } = region.size;

    // Rebuild blocks list from current storage
    const blockEntries: any[] = [];
    let i = 0;
    for (let y = 0; y < sizeY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          const state = flatData[i++];
          if (state !== 0) {
            const entry: Record<string, any> = {
              type: 'compound',
              value: {
                pos: {
                  type: 'list',
                  value: {
                    type: 'int',
                    value: [
                      { type: 'int', value: x },
                      { type: 'int', value: y },
                      { type: 'int', value: z },
                    ],
                  },
                },
                state: { type: 'int', value: state },
              },
            };
            // Spread properties for prismarine-nbt direct access compatibility
            entry.pos = entry.value.pos;
            entry.state = entry.value.state;
            blockEntries.push(entry);
          }
        }
      }
    }

    root.blocks = {
      type: 'list',
      value: { type: 'compound', value: blockEntries },
    };

    // Rebuild palette from current fullPalette
    const paletteEntries = region.fullPalette.map(p => {
      const entry: Record<string, any> = {
        Name: { type: 'string', value: p.Name },
      };
      if (p.Properties && Object.keys(p.Properties).length > 0) {
        const props: Record<string, any> = {};
        for (const [k, v] of Object.entries(p.Properties)) {
          props[k] = { type: 'string', value: v };
        }
        entry.Properties = { type: 'compound', value: props };
      }
      return entry;
    });

    // Update palette in rawNbt (preserve single palettes or multiple)
    if (root.palette) {
      root.palette.value.value = paletteEntries;
    }
    if (root.palettes) {
      const firstPalette = root.palettes.value.value[0];
      if (firstPalette) {
        firstPalette.value = paletteEntries;
      }
    }

    return this.rawNbt;
  }
}
