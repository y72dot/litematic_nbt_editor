import { useState, useMemo } from 'react'
import type { Schematic } from '../../core/Schematic'

interface SwatchesPanelProps {
  litematicObj: Schematic | null
  onUpdate: () => void
  getBlockColor: (blockId: string) => string
  selectedBlocks?: Set<string>
  activeBlockType?: string
  onActiveBlockChange?: (blockName: string) => void
}

export default function SwatchesPanel({
  litematicObj, onUpdate, getBlockColor, selectedBlocks,
  activeBlockType, onActiveBlockChange,
}: SwatchesPanelProps) {
  const [search, setSearch] = useState('')
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const uniqueBlocks = useMemo(() => {
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
    if (!search) return uniqueBlocks
    const q = search.toLowerCase()
    return uniqueBlocks.filter(b => b.toLowerCase().includes(q))
  }, [uniqueBlocks, search])

  const hasSelection = selectedBlocks && selectedBlocks.size > 0

  const handleStartRename = (blockName: string) => {
    setEditingBlock(blockName)
    setEditValue(blockName)
  }

  const handleSaveRename = () => {
    if (!editingBlock || !editValue || editValue === editingBlock || !litematicObj) {
      setEditingBlock(null)
      return
    }
    litematicObj.renameBlock(editingBlock, editValue)
    onUpdate()
    setEditingBlock(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveRename()
    else if (e.key === 'Escape') setEditingBlock(null)
  }

  const shortName = (name: string) => name.replace('minecraft:', '')

  if (!litematicObj) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
        No file loaded
      </div>
    )
  }

  return (
    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>

      {/* Search */}
      <input
        className="studio-input"
        placeholder="Search blocks..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Swatch Grid */}
      <div className="swatch-grid">
        {filteredBlocks.map(blockName => {
          const isEditing = editingBlock === blockName
          const isActive = activeBlockType === blockName

          return (
            <div
              key={blockName}
              className={`swatch-chip ${isActive ? 'active' : ''} ${hasSelection ? 'has-replace' : ''}`}
              title={`${blockName}${hasSelection ? '\nClick to set as active block' : '\nClick to set active | Double-click to rename'}`}
            >
              {isEditing ? (
                <input
                  autoFocus
                  className="swatch-rename-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <>
                  <div
                    className="swatch-color"
                    style={{ backgroundColor: getBlockColor(blockName) }}
                    onClick={() => {
                      if (onActiveBlockChange) {
                        onActiveBlockChange(blockName)
                      }
                    }}
                    onDoubleClick={() => handleStartRename(blockName)}
                  />
                  <div
                    className="swatch-label"
                    onClick={() => handleStartRename(blockName)}
                  >
                    {shortName(blockName)}
                  </div>
                  {hasSelection && (
                    <div className="swatch-replace-badge" title="Active block for editing">
                      A
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {filteredBlocks.length === 0 && (
        <div style={{ fontSize: '11px', color: '#666', padding: '10px', textAlign: 'center' }}>
          No blocks match "{search}"
        </div>
      )}

      {/* Footer hint */}
      <div className="swatch-footer">
        {hasSelection
          ? 'Click to set active block for editing'
          : 'Double-click to rename | Click to set active block'}
      </div>
    </div>
  )
}
