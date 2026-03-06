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
}
