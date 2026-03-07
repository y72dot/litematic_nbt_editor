import { useState, useMemo } from 'react';

interface PalettePanelProps {
  nbtData: any;
  onUpdate: (newNbt: any) => void;
  getBlockColor: (blockId: string) => string;
}

export default function PalettePanel({ nbtData, onUpdate, getBlockColor }: PalettePanelProps) {
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Extract all unique block types and their counts across all regions
  const { blockCounts } = useMemo(() => {
    const blockCounts: Record<string, number> = {};

    if (!nbtData || !nbtData.value || !nbtData.value.Regions) {
      return { blockCounts: {} };
    }

    const regions = nbtData.value.Regions.value;

    Object.keys(regions).forEach(regionName => {
      const region = regions[regionName].value;
      
      let rawPalette = region.BlockStatePalette.value;
      if (!Array.isArray(rawPalette) && rawPalette && rawPalette.value && Array.isArray(rawPalette.value)) {
        rawPalette = rawPalette.value;
      }
      
      if (Array.isArray(rawPalette)) {
        rawPalette.forEach((p: any) => {
          if (p.Name && p.Name.value) {
            const name = p.Name.value;
            blockCounts[name] = (blockCounts[name] || 0) + 1;
          }
        });
      }
    });

    return { blockCounts };
  }, [nbtData]);

  const uniqueBlocks = Object.keys(blockCounts).sort();

  const handleStartEdit = (blockName: string) => {
    setEditingBlock(blockName);
    setEditValue(blockName);
  };

  const handleSaveEdit = () => {
    if (!editingBlock || !editValue || editValue === editingBlock) {
      setEditingBlock(null);
      return;
    }

    const newNbt = { ...nbtData };
    const regions = newNbt.value.Regions.value;

    Object.keys(regions).forEach(regionName => {
      const region = regions[regionName].value;
      let palette = region.BlockStatePalette.value;
      
      if (!Array.isArray(palette) && palette && palette.value && Array.isArray(palette.value)) {
        palette = palette.value;
      }

      palette.forEach((p: any) => {
        if (p.Name && p.Name.value === editingBlock) {
          p.Name.value = editValue;
        }
      });
    });

    onUpdate(newNbt);
    setEditingBlock(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingBlock(null);
    }
  };

  if (!nbtData) {
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
