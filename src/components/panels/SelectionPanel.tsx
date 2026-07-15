import type { InteractionMode, SelectionMode, SelectionModifier } from '../../types'

interface SelectionPanelProps {
  interactionMode: InteractionMode
  onInteractionModeChange: (mode: InteractionMode) => void
  selectionMode: SelectionMode
  onSelectionModeChange: (mode: SelectionMode) => void
  selectionModifier: SelectionModifier
  onSelectionModifierChange: (mod: SelectionModifier) => void
  selectionCount: number
  boundingBox: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null
  onSelectAll: () => void
  onDeselectAll: () => void
  onSelectSimilar: () => void
  onInvertSelection: () => void
}

const SELECTION_TOOLS: { id: SelectionMode; label: string; icon: string; hint: string }[] = [
  { id: 'point', label: 'Point', icon: '\u229F', hint: 'Click to select a single block' },
  { id: 'box', label: 'Box', icon: '\u25A6', hint: 'Drag to box-select blocks' },
  { id: 'similar', label: 'Similar', icon: '\u2630', hint: 'Select all blocks of the same type' },
]

const MODIFIERS: { id: SelectionModifier; label: string; hint: string }[] = [
  { id: 'replace', label: 'Replace', hint: 'Replace current selection' },
  { id: 'add', label: 'Add', hint: 'Add to current selection' },
  { id: 'subtract', label: 'Subtract', hint: 'Remove from current selection' },
]

export default function SelectionPanel({
  interactionMode, onInteractionModeChange,
  selectionMode, onSelectionModeChange,
  selectionModifier, onSelectionModifierChange,
  selectionCount, boundingBox,
  onSelectAll, onDeselectAll,
  onSelectSimilar, onInvertSelection,
}: SelectionPanelProps) {
  const hasSelection = selectionCount > 0

  const bboxStr = boundingBox
    ? `${boundingBox.maxX - boundingBox.minX + 1}\u00D7${boundingBox.maxY - boundingBox.minY + 1}\u00D7${boundingBox.maxZ - boundingBox.minZ + 1}`
    : null

  return (
    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px' }}>

      {/* Mode Toggle */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>MODE</div>
        <div className="mode-toggle-row">
          <button
            className={`mode-toggle-btn ${interactionMode === 'selection' ? 'active' : ''}`}
            onClick={() => onInteractionModeChange('selection')}
          >
            Selection
          </button>
          <button
            className={`mode-toggle-btn ${interactionMode === 'editing' ? 'active' : ''}`}
            onClick={() => onInteractionModeChange('editing')}
          >
            Editing
          </button>
        </div>
      </div>

      {/* Selection Tools */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>SELECTION TOOLS</div>
        <div className="tool-grid tool-grid-3">
          {SELECTION_TOOLS.map(t => (
            <button
              key={t.id}
              className={`tool-btn ${selectionMode === t.id ? 'active' : ''}`}
              title={t.hint}
              onClick={() => onSelectionModeChange(t.id)}
            >
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modifier */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>MODIFIER</div>
        <div className="tool-grid tool-grid-3">
          {MODIFIERS.map(m => (
            <button
              key={m.id}
              className={`tool-btn modifier-btn ${selectionModifier === m.id ? 'active' : ''}`}
              title={m.hint}
              onClick={() => onSelectionModifierChange(m.id)}
            >
              <span className="tool-label">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="keyboard-hint">Ctrl+Click = Add | Alt+Click = Subtract</div>
      </div>

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
