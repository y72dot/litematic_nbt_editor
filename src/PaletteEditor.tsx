import { useState, useMemo } from 'react'
import './PaletteEditor.css'

interface PaletteEditorProps {
  nbtData: any;
  onUpdate: (newNbt: any) => void;
  // Function to get color for preview
  getBlockColor: (blockId: string) => string;
}

export default function PaletteEditor({ nbtData, onUpdate, getBlockColor }: PaletteEditorProps) {
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
      
      // Handle wrapped lists (similar to Region.ts)
      let rawPalette = region.BlockStatePalette.value;
      if (!Array.isArray(rawPalette) && rawPalette && rawPalette.value && Array.isArray(rawPalette.value)) {
        rawPalette = rawPalette.value;
      }
      
      if (Array.isArray(rawPalette)) {
        rawPalette.forEach((p: any) => {
          if (p.Name && p.Name.value) {
            const name = p.Name.value;
            blockCounts[name] = (blockCounts[name] || 0) + 1;
            // We just store one example for now if needed
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

    // Clone NBT structure deeply to avoid mutation issues
    // For simplicity, we can do a JSON clone, but we lose BigInts.
    // So we must traverse and update in place carefully, or use a library that supports deep cloning with BigInt.
    // Here we will update the existing object in place for performance, but trigger a re-render by creating a shallow copy of the root.
    
    // We need to find ALL occurrences of this block in ALL regions' palettes and update them.
    const newNbt = { ...nbtData };
    const regions = newNbt.value.Regions.value;

    Object.keys(regions).forEach(regionName => {
      const region = regions[regionName].value;
      let palette = region.BlockStatePalette.value;
      
      // Handle wrapped palette
      if (!Array.isArray(palette) && palette && palette.value && Array.isArray(palette.value)) {
        palette = palette.value;
      }

      // Update palette entries
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

  return (
    <div className="palette-editor">
      <h3>Palette Editor</h3>
      <p style={{fontSize: '0.8em', color: '#666', marginBottom: '10px'}}>
        Click a block name to rename it globally.
      </p>
      
      <div className="palette-list">
        {uniqueBlocks.map(blockName => (
          <div key={blockName} className="palette-item">
            <div 
              className="palette-color" 
              style={{ backgroundColor: getBlockColor(blockName) }}
            />
            
            <div className="palette-info">
              {editingBlock === blockName ? (
                <input 
                  autoFocus
                  className="edit-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <span 
                  className="block-name" 
                  onClick={() => handleStartEdit(blockName)}
                  title="Click to rename"
                >
                  {blockName}
                </span>
              )}
              {/* Count is not accurate yet without full unpack, so maybe hide it or show 'Present' */}
              {/* <span className="block-count">In {blockCounts[blockName]} regions</span> */}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
