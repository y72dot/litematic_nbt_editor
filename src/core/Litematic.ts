import { Region } from './Region';
import { BaseSchematic } from './BaseSchematic';
import type { LitematicMetadata } from '../types';
import { getBitsPerBlock } from '../utils/litematicParser';

export class Litematic extends BaseSchematic {
  public metadata: LitematicMetadata;
  public regions: Region[] = [];
  public rawNbt: any;
  public version: number = 6;
  public preferredFormat: 'spanning' | 'non-spanning' = 'non-spanning';

  constructor(nbtData: any) {
    super();
    this.rawNbt = nbtData;
    const root = nbtData.value || {};

    // Parse Version
    if (root.Version) {
      this.version = root.Version.value;
    }

    // Determine preferred format based on version
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

    // Convert to editable storage on load (Phase 1.2)
    for (const region of this.regions) {
      region.enableEditing();
    }
  }

  // ── Format-specific rawNbt update for renameBlock ────────────

  protected renameBlockInRawNbt(oldName: string, newName: string): void {
    if (this.rawNbt.value && this.rawNbt.value.Regions) {
      const regionsMap = this.rawNbt.value.Regions.value;
      Object.keys(regionsMap).forEach(key => {
        const regionComp = regionsMap[key].value;
        let palette = regionComp.BlockStatePalette.value;
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

  // ── Serialize current state back to NBT ──────────────────────

  toNbt(): any {
    const root = this.rawNbt.value;

    // Update metadata
    if (!root.Metadata) root.Metadata = { type: 'compound', value: {} };
    const metaVal = root.Metadata.value;
    metaVal.Name = { type: 'string', value: this.metadata.name };
    metaVal.Author = { type: 'string', value: this.metadata.author };
    metaVal.Description = { type: 'string', value: this.metadata.description };

    const now = Date.now();
    metaVal.TimeModified = { type: 'long', value: (typeof BigInt !== 'undefined') ? BigInt(now) : [0, now] };

    // Update each region's BlockStates and palette from current storage
    if (root.Regions) {
      const regionsMap = root.Regions.value;

      for (const region of this.regions) {
        const regionComp = regionsMap[region.name]?.value;
        if (!regionComp) continue;

        // Encode block states from current storage
        const flatData = region.storage.toArray();
        const paletteSize = Math.max(2, region.fullPalette.length);
        const bitsPerBlock = getBitsPerBlock(paletteSize);
        const encoded = BaseSchematic.encodeBlockStates(flatData, bitsPerBlock, region.size, this.preferredFormat);
        regionComp.BlockStates = { type: 'longArray', value: encoded };

        // Build palette entries in NBT format
        const newPaletteEntries = region.fullPalette.map(p => {
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

        // Sync palette into rawNbt (handle both wrapped and unwrapped formats)
        const paletteTag = regionComp.BlockStatePalette;
        if (paletteTag) {
          const paletteVal = paletteTag.value;
          if (Array.isArray(paletteVal)) {
            // Wrapped: .value is directly the array
            paletteTag.value = newPaletteEntries;
          } else if (paletteVal && paletteVal.value && Array.isArray(paletteVal.value)) {
            // Standard: .value.value is the array
            paletteVal.value = newPaletteEntries;
          }
        }
      }
    }

    return this.rawNbt;
  }
}
