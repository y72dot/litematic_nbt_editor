import { useState, useMemo } from 'react'
import type { ToolMode } from '../../types'
import type { Schematic } from '../../core/Schematic'

interface ToolsPanelProps {
  activeTool: ToolMode
  onToolChange: (tool: ToolMode) => void
  activeBlockType: string
  onBlockTypeChange: (blockName: string) => void
  selectionCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  onReplaceSelection: (blockName: string) => void
  onDeleteSelection: () => void
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
  onUndo: () => void
  onRedo: () => void
  litematicObj: Schematic | null
  getBlockColor: (blockId: string) => string
}

const TOOLS: { id: ToolMode; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'Select', icon: '\u229F', hint: 'Click to select, Shift+Click to toggle' },
  { id: 'place', label: 'Place', icon: '\u25A0', hint: 'Click to place active block' },
  { id: 'erase', label: 'Erase', icon: '\u2205', hint: 'Click to erase (set to air)' },
  { id: 'fill', label: 'Fill', icon: '\u25A6', hint: 'Click to flood-fill connected area' },
  { id: 'pick', label: 'Pick', icon: '\u21F1', hint: 'Click to pick block type from scene' },
]

export default function ToolsPanel({
  activeTool,
  onToolChange,
  activeBlockType,
  onBlockTypeChange,
  selectionCount,
  onSelectAll,
  onDeselectAll,
  onReplaceSelection,
  onDeleteSelection,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
  litematicObj,
  getBlockColor,
}: ToolsPanelProps) {
  const [blockSearch, setBlockSearch] = useState('')

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
    if (!blockSearch) return paletteBlocks
    const q = blockSearch.toLowerCase()
    return paletteBlocks.filter(b => b.toLowerCase().includes(q))
  }, [paletteBlocks, blockSearch])

  const hasSelection = selectionCount > 0

  if (!litematicObj) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
        No file loaded
      </div>
    )
  }

  return (
    <div className="panel-section-body" style={{ height: '100%', overflowY: 'auto', padding: '10px' }}>

      {/* ── Section: Tool Mode ──────────────────────────────── */}
      <div className="studio-label" style={{ marginBottom: '6px' }}>Tool Mode</div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            title={t.hint}
            onClick={() => onToolChange(t.id)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: activeTool === t.id ? 'bold' : 'normal',
              background: activeTool === t.id ? '#1a5a3a' : '#2a2a2a',
              color: activeTool === t.id ? '#5f5' : '#ccc',
              border: activeTool === t.id ? '1px solid #3a7a4a' : '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: '1 1 auto',
              minWidth: '44px',
              textAlign: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              if (activeTool !== t.id) {
                e.currentTarget.style.background = '#333'
                e.currentTarget.style.color = '#fff'
              }
            }}
            onMouseLeave={e => {
              if (activeTool !== t.id) {
                e.currentTarget.style.background = '#2a2a2a'
                e.currentTarget.style.color = '#ccc'
              }
            }}
          >
            <div style={{ fontSize: '16px', lineHeight: 1 }}>{t.icon}</div>
            <div style={{ marginTop: '2px' }}>{t.label}</div>
          </button>
        ))}
      </div>

      {/* ── Section: Active Block ───────────────────────────── */}
      <div className="studio-label" style={{ marginBottom: '6px' }}>Active Block</div>

      {/* Current block indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        background: '#1a2a1a',
        border: '1px solid #2a4a2a',
        borderRadius: '4px',
        marginBottom: '8px',
      }}>
        <div style={{
          width: '18px',
          height: '18px',
          backgroundColor: getBlockColor(activeBlockType),
          marginRight: '8px',
          borderRadius: '2px',
          border: '1px solid #555',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '12px', color: '#8f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeBlockType}
        </span>
      </div>

      {/* Block search */}
      <input
        className="studio-input"
        style={{ marginBottom: '6px', width: '100%', boxSizing: 'border-box' }}
        placeholder="Search blocks..."
        value={blockSearch}
        onChange={e => setBlockSearch(e.target.value)}
      />

      {/* Block list */}
      <div style={{
        maxHeight: '180px',
        overflowY: 'auto',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {filteredBlocks.map(name => (
          <button
            key={name}
            onClick={() => onBlockTypeChange(name)}
            title={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '3px 6px',
              background: name === activeBlockType ? '#1a3a1a' : '#252525',
              border: name === activeBlockType ? '1px solid #3a6a3a' : '1px solid transparent',
              borderRadius: '3px',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontSize: '11px',
              color: name === activeBlockType ? '#8f8' : '#ccc',
            }}
            onMouseEnter={e => {
              if (name !== activeBlockType) {
                e.currentTarget.style.background = '#303030'
              }
            }}
            onMouseLeave={e => {
              if (name !== activeBlockType) {
                e.currentTarget.style.background = '#252525'
              }
            }}
          >
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: getBlockColor(name),
              marginRight: '6px',
              borderRadius: '2px',
              border: '1px solid #555',
              flexShrink: 0,
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          </button>
        ))}
        {filteredBlocks.length === 0 && (
          <div style={{ fontSize: '11px', color: '#666', padding: '8px', textAlign: 'center' }}>
            No blocks match "{blockSearch}"
          </div>
        )}
      </div>

      {/* ── Section: Selection ──────────────────────────────── */}
      <div className="studio-label" style={{ marginBottom: '6px' }}>Selection</div>

      {/* Selection count */}
      <div style={{
        fontSize: '11px',
        color: hasSelection ? '#8f8' : '#666',
        marginBottom: '6px',
        padding: '4px 8px',
        background: hasSelection ? '#1a2a1a' : '#1a1a1a',
        borderRadius: '3px',
      }}>
        {hasSelection
          ? `${selectionCount} block${selectionCount !== 1 ? 's' : ''} selected`
          : 'No blocks selected'}
      </div>

      {/* Selection buttons */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={onSelectAll}
          style={miniBtnStyle}
          onMouseEnter={e => { e.currentTarget.style.background = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a' }}
        >
          Select All
        </button>
        <button
          onClick={onDeselectAll}
          disabled={!hasSelection}
          style={{ ...miniBtnStyle, opacity: hasSelection ? 1 : 0.4 }}
          onMouseEnter={e => { if (hasSelection) e.currentTarget.style.background = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a' }}
        >
          Deselect
        </button>
        <button
          onClick={onDeleteSelection}
          disabled={!hasSelection}
          style={{
            ...miniBtnStyle,
            background: hasSelection ? '#3a1a1a' : '#2a2a2a',
            border: hasSelection ? '1px solid #5a2a2a' : '1px solid #444',
            color: hasSelection ? '#f88' : '#666',
            opacity: hasSelection ? 1 : 0.4,
          }}
          onMouseEnter={e => { if (hasSelection) { e.currentTarget.style.background = '#5a2a2a'; e.currentTarget.style.color = '#faa' } }}
          onMouseLeave={e => { e.currentTarget.style.background = '#3a1a1a'; e.currentTarget.style.color = '#f88' }}
        >
          Delete
        </button>
        <button
          onClick={() => onReplaceSelection(activeBlockType)}
          disabled={!hasSelection}
          style={{
            ...miniBtnStyle,
            background: hasSelection ? '#1a3a1a' : '#2a2a2a',
            border: hasSelection ? '1px solid #3a6a3a' : '1px solid #444',
            color: hasSelection ? '#8f8' : '#666',
            opacity: hasSelection ? 1 : 0.4,
          }}
          onMouseEnter={e => { if (hasSelection) { e.currentTarget.style.background = '#3a5a3a'; e.currentTarget.style.color = '#afa' } }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1a3a1a'; e.currentTarget.style.color = '#8f8' }}
        >
          Replace
        </button>
      </div>

      {/* ── Section: Quick Actions ───────────────────────────── */}
      <div className="studio-label" style={{ marginBottom: '6px' }}>Quick Actions</div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title={undoLabel ?? undefined}
          style={{
            ...miniBtnStyle,
            flex: 1,
            opacity: canUndo ? 1 : 0.4,
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a' }}
        >
          {undoLabel ? `Undo: ${undoLabel}` : 'Undo'}
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title={redoLabel ?? undefined}
          style={{
            ...miniBtnStyle,
            flex: 1,
            opacity: canRedo ? 1 : 0.4,
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          onMouseEnter={e => { if (canRedo) e.currentTarget.style.background = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a' }}
        >
          {redoLabel ? `Redo: ${redoLabel}` : 'Redo'}
        </button>
      </div>
    </div>
  )
}

const miniBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '11px',
  background: '#2a2a2a',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: '3px',
  cursor: 'pointer',
}
