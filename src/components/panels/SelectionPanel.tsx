import type { InteractionMode } from '../../types'

interface SelectionPanelProps {
  selectionCount: number
  boundingBox: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null
  interactionMode: InteractionMode
  onSelectAll: () => void
  onDeselectAll: () => void
  onSelectSimilar: () => void
  onInvertSelection: () => void
}

export default function SelectionPanel({
  selectionCount, boundingBox, interactionMode,
  onSelectAll, onDeselectAll,
  onSelectSimilar, onInvertSelection,
}: SelectionPanelProps) {
  const hasSelection = selectionCount > 0

  const bboxStr = boundingBox
    ? `${boundingBox.maxX - boundingBox.minX + 1}\u00D7${boundingBox.maxY - boundingBox.minY + 1}\u00D7${boundingBox.maxZ - boundingBox.minZ + 1}`
    : null

  return (
    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>

      {/* Selection Count + BBox */}
      <div className={`selection-count ${hasSelection ? 'has-selection' : ''}`}>
        <div>
          {hasSelection
            ? `\u25CF ${selectionCount} block${selectionCount !== 1 ? 's' : ''} selected`
            : '\u25CB No blocks selected'}
        </div>
        {bboxStr && (
          <div className="selection-bbox">BBox: {bboxStr}</div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button className="studio-btn" onClick={onSelectAll}>
          Select All
        </button>
        <button className="studio-btn" onClick={onDeselectAll} disabled={!hasSelection}>
          Deselect
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className="studio-btn"
          onClick={onSelectSimilar}
          disabled={!hasSelection}
          title="Select all blocks of the same types within the selection"
        >
          Select Similar
        </button>
        <button
          className="studio-btn"
          onClick={onInvertSelection}
          title="Invert current selection"
        >
          Invert
        </button>
      </div>

      {/* Mode hint */}
      <div className="selection-mode-hint">
        {interactionMode === 'selection'
          ? 'Select blocks, then switch to Editing mode to modify them.'
          : 'Selection restricts editing. Switch to Selection mode to change selection.'}
      </div>
    </div>
  )
}
