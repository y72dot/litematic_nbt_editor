import { useState, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { InteractionMode, EditMode } from '../../types'
import type { Schematic } from '../../core/Schematic'

interface ToolPanelProps {
  interactionMode: InteractionMode
  onInteractionModeChange: (mode: InteractionMode) => void
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  activeBlockType: string
  onBlockTypeChange: (blockName: string) => void
  litematicObj: Schematic | null
  getBlockColor: (blockId: string) => string
}

export default function ToolPanel({
  interactionMode, onInteractionModeChange,
  editMode, onEditModeChange,
  activeBlockType, onBlockTypeChange,
  litematicObj, getBlockColor,
}: ToolPanelProps) {
  const { t } = useTranslation()
  const [blockSearch, setBlockSearch] = useState('')
  const recentRef = useRef<string[]>([])

  const editTools = useMemo(() => [
    { id: 'place' as EditMode, label: t('toolPanel.toolPlace'), icon: '\u25A0', hint: t('toolPanel.hintPlace') },
    { id: 'replace' as EditMode, label: t('toolPanel.toolReplace'), icon: '\u25C6', hint: t('toolPanel.hintReplace') },
    { id: 'erase' as EditMode, label: t('toolPanel.toolErase'), icon: '\u2205', hint: t('toolPanel.hintErase') },
    { id: 'fill' as EditMode, label: t('toolPanel.toolFill'), icon: '\u25A6', hint: t('toolPanel.hintFill') },
    { id: 'pick' as EditMode, label: t('toolPanel.toolPick'), icon: '\u21F1', hint: t('toolPanel.hintPick') },
  ], [t])

  // Track recent blocks whenever activeBlockType changes
  if (activeBlockType && recentRef.current[0] !== activeBlockType) {
    recentRef.current = [activeBlockType, ...recentRef.current.filter(b => b !== activeBlockType)].slice(0, 6)
  }

  const paletteBlocks = useMemo(() => {
    if (!litematicObj) return []
    const nameSet = new Set<string>()
    for (const region of litematicObj.regions) {
      for (const p of region.fullPalette) {
        nameSet.add(p.Name)
      }
    }
    return [...nameSet].sort()
  }, [litematicObj])

  const filteredBlocks = useMemo(() => {
    if (!blockSearch) return paletteBlocks.slice(0, 50)
    const q = blockSearch.toLowerCase()
    return paletteBlocks.filter(b => b.toLowerCase().includes(q)).slice(0, 50)
  }, [paletteBlocks, blockSearch])

  const handleRecentRightClick = useCallback((blockName: string, e: React.MouseEvent) => {
    e.preventDefault()
    onBlockTypeChange(blockName)
  }, [onBlockTypeChange])

  if (!litematicObj) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
        {t('common.noFileLoaded')}
      </div>
    )
  }

  return (
    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px' }}>

      {/* Mode Toggle */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>{t('toolPanel.sectionMode')}</div>
        <div className="mode-toggle-row">
          <button
            className={`mode-toggle-btn ${interactionMode === 'selection' ? 'active' : ''}`}
            onClick={() => onInteractionModeChange('selection')}
          >
            {t('toolPanel.modeSelection')}
          </button>
          <button
            className={`mode-toggle-btn ${interactionMode === 'editing' ? 'active' : ''}`}
            onClick={() => onInteractionModeChange('editing')}
          >
            {t('toolPanel.modeEditing')}
          </button>
        </div>
      </div>

      {/* Editing Tools — always visible */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>{t('toolPanel.sectionEditingTools')}</div>
        <div className="tool-grid tool-grid-5">
          {editTools.map(t => (
            <button
              key={t.id}
              className={`tool-btn ${editMode === t.id ? 'active' : ''}`}
              title={t.hint}
              onClick={() => onEditModeChange(t.id)}
            >
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Block — always visible */}
      <div>
        <div className="studio-label" style={{ marginBottom: '4px' }}>{t('toolPanel.sectionActiveBlock')}</div>
        <div className="active-block-display">
          <div className="active-block-swatch" style={{ backgroundColor: getBlockColor(activeBlockType) }} />
          <span className="active-block-name">{activeBlockType}</span>
        </div>
      </div>

      {/* Quick Search */}
      <input
        className="studio-input"
        style={{ marginBottom: 0 }}
        placeholder={t('toolPanel.searchPlaceholder')}
        value={blockSearch}
        onChange={e => setBlockSearch(e.target.value)}
      />

      {/* Filtered Block List */}
      <div className="block-quick-list">
        {filteredBlocks.map(name => (
          <button
            key={name}
            className={`block-quick-item ${name === activeBlockType ? 'active' : ''}`}
            onClick={() => onBlockTypeChange(name)}
            title={name}
          >
            <div className="block-quick-swatch" style={{ backgroundColor: getBlockColor(name) }} />
            <span>{name}</span>
          </button>
        ))}
        {filteredBlocks.length === 0 && (
          <div style={{ fontSize: '11px', color: '#666', padding: '4px', textAlign: 'center' }}>
            {t('toolPanel.noBlocksMatch')}
          </div>
        )}
      </div>

      {/* Recent Blocks */}
      {recentRef.current.length > 1 && (
        <div>
          <div className="studio-label" style={{ marginBottom: '4px' }}>{t('toolPanel.sectionRecent')}</div>
          <div className="recent-grid">
            {recentRef.current.slice(0, 6).map(name => (
              <div
                key={name}
                className={`recent-swatch ${name === activeBlockType ? 'active' : ''}`}
                style={{ backgroundColor: getBlockColor(name) }}
                title={t('toolPanel.recentTooltip', { name })}
                onClick={() => onBlockTypeChange(name)}
                onContextMenu={(e) => handleRecentRightClick(name, e)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
