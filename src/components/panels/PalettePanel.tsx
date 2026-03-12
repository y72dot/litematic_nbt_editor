import { useState, useMemo } from 'react';
import type { Schematic } from '../../core/Schematic';

interface PalettePanelProps {
  litematicObj: Schematic | null;
  onUpdate: () => void;
  getBlockColor: (blockId: string) => string;
}

export default function PalettePanel({ litematicObj, onUpdate, getBlockColor }: PalettePanelProps) {
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Extract all unique block types and their counts across all regions
  const { blockCounts } = useMemo(() => {
    const counts: Record<string, number> = {};

    if (!litematicObj) {
      return { blockCounts: {} };
    }

    litematicObj.regions.forEach(region => {
      // Use fullPalette to get names
      const palette = region.fullPalette;
      
      // We should count occurrences in storage to be accurate, 
      // but for palette list, just listing what's in palette is usually enough.
      // However, the original code counted them.
      // Original code:
      // "Object.keys(regions).forEach... blockCounts[name] = (blockCounts[name] || 0) + 1;"
      // Wait, the original code counted how many *regions* use this block? 
      // Or if a block appears multiple times in palette? (Unlikely)
      // Actually, original code iterates regions, then iterates palette of that region.
      // So if "stone" is in Region A and Region B, count is 2.
      
      palette.forEach(p => {
        counts[p.Name] = (counts[p.Name] || 0) + 1;
      });
    });

    return { blockCounts: counts };
  }, [litematicObj]);

  const uniqueBlocks = Object.keys(blockCounts).sort();

  const handleStartEdit = (blockName: string) => {
    setEditingBlock(blockName);
    setEditValue(blockName);
  };

  const handleSaveEdit = () => {
    if (!editingBlock || !editValue || editValue === editingBlock || !litematicObj) {
      setEditingBlock(null);
      return;
    }

    litematicObj.renameBlock(editingBlock, editValue);
    
    onUpdate();
    setEditingBlock(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingBlock(null);
    }
  };

  if (!litematicObj) {
     return (
       <div style={{padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
          No file loaded
       </div>
     );
  }

  return (
    <div className="panel-section-body" style={{ height: '100%', overflowY: 'auto', padding: '10px' }}>
      <p style={{fontSize: '11px', color: '#888', marginBottom: '10px', marginTop: 0}}>
        Click a block name to rename it globally.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {uniqueBlocks.map(blockName => (
          <div key={blockName} style={{
             display: 'flex', 
             alignItems: 'center', 
             padding: '4px', 
             background: '#252525', 
             borderRadius: '3px',
             border: '1px solid #333'
          }}>
            {/* Color Preview */}
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: getBlockColor(blockName),
              marginRight: '8px',
              borderRadius: '2px',
              border: '1px solid #444',
              flexShrink: 0
            }} />
            
            {/* Name or Input */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingBlock === blockName ? (
                <input 
                  autoFocus
                  className="studio-input"
                  style={{ margin: 0, padding: '2px 4px' }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <span 
                  onClick={() => handleStartEdit(blockName)}
                  title="Click to rename"
                  style={{ 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    color: '#ddd',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#ddd'}
                >
                  {blockName}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
