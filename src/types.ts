export type InteractionMode = 'selection' | 'editing';

export type SelectionMode = 'point' | 'box' | 'similar';
export type SelectionModifier = 'replace' | 'add' | 'subtract';

export type EditMode = 'place' | 'erase' | 'fill' | 'pick';

export interface BoxSelectionState {
  active: boolean
  startX: number; startY: number; startZ: number
  endX: number; endY: number; endZ: number
}

export type HistoryEntryStatus = 'done' | 'current' | 'undone';

export interface HistoryEntry {
  index: number
  label: string
  status: HistoryEntryStatus
}

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
