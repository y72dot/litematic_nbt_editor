import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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

export default function SelectionPanel({
  interactionMode, onInteractionModeChange,
  selectionMode, onSelectionModeChange,
  selectionModifier, onSelectionModifierChange,
  selectionCount, boundingBox,
  onSelectAll, onDeselectAll,
  onSelectSimilar, onInvertSelection,
}: SelectionPanelProps) {
  const { t } = useTranslation()
  const hasSelection = selectionCount > 0

  const selectionTools = useMemo(() => [
    { id: 'point' as SelectionMode, label: t('selectionPanel.toolPoint'), icon: '\u229F', hint: t('selectionPanel.hintPoint') },
    { id: 'box' as SelectionMode, label: t('selectionPanel.toolBox'), icon: '\u25A6', hint: t('selectionPanel.hintBox') },
    { id: 'similar' as SelectionMode, label: t('selectionPanel.toolSimilar'), icon: '\u2630', hint: t('selectionPanel.hintSimilar') },
  ], [t])

  const modifiers = useMemo(() => [
    { id: 'replace' as SelectionModifier, label: t('selectionPanel.modifierReplace'), hint: t('selectionPanel.hintReplace') },
    { id: 'add' as SelectionModifier, label: t('selectionPanel.modifierAdd'), hint: t('selectionPanel.hintAdd') },
    { id: 'subtract' as SelectionModifier, label: t('selectionPanel.modifierSubtract'), hint: t('selectionPanel.hintSubtract') },
  ], [t])

  const bboxStr = boundingBox
    ? `${boundingBox.maxX - boundingBox.minX + 1}\u00D7${boundingBox.maxY - boundingBox.minY + 1}\u00D7${boundingBox.maxZ - boundingBox.minZ + 1}`
    : null

  return (
    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px' }}>

      {/* Mode Toggle */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>{t('selectionPanel.sectionMode')}</div>
        <div className="mode-toggle-row">
          <button
            className={`mode-toggle-btn ${interactionMode === 'selection' ? 'active' : ''}`}
            onClick={() => onInteractionModeChange('selection')}
          >
            {t('selectionPanel.modeSelection')}
          </button>
          <button
            className={`mode-toggle-btn ${interactionMode === 'editing' ? 'active' : ''}`}
            onClick={() => onInteractionModeChange('editing')}
          >
            {t('selectionPanel.modeEditing')}
          </button>
        </div>
      </div>

      {/* Selection Tools */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>{t('selectionPanel.sectionSelectionTools')}</div>
        <div className="tool-grid tool-grid-3">
          {selectionTools.map(t => (
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
        <div className="studio-label" style={{ marginBottom: '4px' }}>{t('selectionPanel.sectionModifier')}</div>
        <div className="tool-grid tool-grid-3">
          {modifiers.map(m => (
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
        <div className="keyboard-hint">{t('selectionPanel.keyboardHint')}</div>
      </div>

      {/* Selection Count + BBox */}
      <div className={`selection-count ${hasSelection ? 'has-selection' : ''}`}>
        <div>
          {hasSelection
            ? t('selectionPanel.selectedCount', { count: selectionCount })
            : t('selectionPanel.noBlocksSelected')}
        </div>
        {bboxStr && (
          <div className="selection-bbox">{t('selectionPanel.bbox', { size: bboxStr })}</div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button className="studio-btn" onClick={onSelectAll}>
          {t('selectionPanel.selectAll')}
        </button>
        <button className="studio-btn" onClick={onDeselectAll} disabled={!hasSelection}>
          {t('selectionPanel.deselect')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className="studio-btn"
          onClick={onSelectSimilar}
          disabled={!hasSelection}
          title={t('selectionPanel.hintSelectSimilar')}
        >
          {t('selectionPanel.selectSimilar')}
        </button>
        <button
          className="studio-btn"
          onClick={onInvertSelection}
          title={t('selectionPanel.hintInvert')}
        >
          {t('selectionPanel.invert')}
        </button>
      </div>

      {/* Mode hint */}
      <div className="selection-mode-hint">
        {interactionMode === 'selection'
          ? t('selectionPanel.modeHintSelection')
          : t('selectionPanel.modeHintEditing')}
      </div>
    </div>
  )
}
