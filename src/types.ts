export type ToolMode = 'select' | 'place' | 'erase' | 'fill' | 'pick';

export interface LitematicMetadata {
  name: string
  author: string
  description: string
  regions: number
  size: { x: number, y: number, z: number } | string
  timeCreated: string
  timeModified: string
  enclosingSize: { x: number, y: number, z: number } | string
}
