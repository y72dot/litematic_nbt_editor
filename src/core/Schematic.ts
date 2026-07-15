import { Region } from './Region';
import type { LitematicMetadata } from '../types';

export interface Schematic {
  // Common metadata
  metadata: LitematicMetadata;
  
  // List of regions (Litematic can have multiple, Structure usually has one)
  regions: Region[];
  
  // Raw NBT data for debugging or saving
  rawNbt: any;
  
  // Convert current state to NBT format suitable for saving
  toNbt(): any;

  // Helper to get a region by name
  getRegion(name: string): Region | undefined;

  // Get block at global coordinates
  getBlock(x: number, y: number, z: number): { Name: string, Properties?: Record<string, string> } | null;

  // Rename a block globally
  renameBlock(oldName: string, newName: string): void;

  // Set a block at global coordinates (memory only, rawNbt sync happens in toNbt)
  setBlock(x: number, y: number, z: number, blockName: string): boolean;
}
