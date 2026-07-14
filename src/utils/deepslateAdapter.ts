import { Structure } from 'deepslate';
import type { Schematic } from '../core/Schematic';

/**
 * Convert a Schematic to a standalone deepslate Structure.
 * Used for initial data loading; for live editing, use SchematicStructureProvider instead.
 */
export function convertToDeepslateStructure(litematic: Schematic): Structure {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  if (litematic.regions.length === 0) {
      return new Structure([1, 1, 1]);
  }

  // Calculate global bounds
  litematic.regions.forEach(region => {
    const { x, y, z } = region.position;
    const { x: sizeX, y: sizeY, z: sizeZ } = region.size;
    
    // Note: Region size is always positive in our Region class (Math.abs used in constructor)
    // Position is already adjusted to be the minimal corner.
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    
    maxX = Math.max(maxX, x + sizeX);
    maxY = Math.max(maxY, y + sizeY);
    maxZ = Math.max(maxZ, z + sizeZ);
  });

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const depth = Math.max(1, maxZ - minZ);
  
  const structure = new Structure([width, height, depth]);

  // Iterate and add blocks
  litematic.regions.forEach(region => {
      const { x: rX, y: rY, z: rZ } = region.position;
      const { x: sizeX, y: sizeY, z: sizeZ } = region.size;
      const palette = region.fullPalette;
      
      for (let x = 0; x < sizeX; x++) {
          for (let y = 0; y < sizeY; y++) {
              for (let z = 0; z < sizeZ; z++) {
                  const blockIndex = region.storage.getBlockIndex(x, y, z);
                  const blockState = palette[blockIndex];
                  
                  if (blockState && blockState.Name !== 'minecraft:air') {
                      const globalX = rX + x - minX;
                      const globalY = rY + y - minY;
                      const globalZ = rZ + z - minZ;
                      
                      structure.addBlock(
                          [globalX, globalY, globalZ], 
                          blockState.Name, 
                          blockState.Properties
                      );
                  }
              }
          }
      }
  });

  return structure;
}
