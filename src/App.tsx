import { useState, useRef, useEffect, useCallback } from 'react'
import * as nbt from 'prismarine-nbt'
import pako from 'pako'
import './App.css'
import 'flexlayout-react/style/dark.css' // Import FlexLayout dark theme
import { Buffer } from 'buffer'
import { Layout, Model, Actions, DockLocation } from 'flexlayout-react'
import type { TabNode, IJsonModel } from 'flexlayout-react'

import { getBlockColor } from './LitematicViewer'
import MenuBar from './components/MenuBar'
import StatusBar from './components/StatusBar'
import { Litematic } from './core/Litematic'
import { Structure } from './core/Structure'
import type { Schematic } from './core/Schematic'
import type { TraversalOrder } from './core/BlockStorage'
import { EditHistory } from './core/commands/EditHistory'
import { SetBlockCommand } from './core/commands/SetBlockCommand'
import { BatchSetBlockCommand } from './core/commands/BatchSetBlockCommand'
import type { LitematicMetadata } from './types'

// Panel Components
import ViewerPanel from './components/panels/ViewerPanel'
import MetadataPanel from './components/panels/MetadataPanel'
import PalettePanel from './components/panels/PalettePanel'
import SettingsPanel from './components/panels/SettingsPanel'
import NbtPanel from './components/panels/NbtPanel'

// Explicitly ensure Buffer is on window if not already there
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

// --- Default Layout Configuration ---
const defaultLayout: IJsonModel = {
  global: {
    tabEnableClose: true,
    tabEnableRename: false,
    tabSetEnableMaximize: true,
  },
  borders: [],
  layout: {
    type: 'row',
    id: 'root',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 70,
        selected: 0,
        children: [
          {
            type: 'tab',
            name: '3D Viewer',
            component: 'viewer',
            enableClose: false, // Viewer should always be open
          }
        ]
      },
      {
        type: 'row',
        weight: 30,
        children: [
          {
            type: 'tabset',
            weight: 50,
            children: [
              {
                type: 'tab',
                name: 'Metadata',
                component: 'metadata'
              },
              {
                type: 'tab',
                name: 'Palette',
                component: 'palette'
              }
            ]
          },
          {
            type: 'tabset',
            weight: 50,
            children: [
              {
                type: 'tab',
                name: 'Settings',
                component: 'settings'
              },
              {
                type: 'tab',
                name: 'Raw NBT',
                component: 'nbt'
              }
            ]
          }
        ]
      }
    ]
  }
};

function App() {
  const [model] = useState(() => Model.fromJson(defaultLayout));
  
  // App State
  const [metadata, setMetadata] = useState<LitematicMetadata | null>(null)
  const [litematicObj, setLitematicObj] = useState<Schematic | null>(null);
  const [fileName, setFileName] = useState<string>('edited.litematic')

  // Edit history for undo/redo
  const editHistoryRef = useRef(new EditHistory());
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [redoLabel, setRedoLabel] = useState<string | null>(null);

  const syncHistoryState = useCallback(() => {
    const h = editHistoryRef.current;
    setUndoLabel(h.undoLabel);
    setRedoLabel(h.redoLabel);
  }, []);

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Settings State
  const [unpackingMethod, setUnpackingMethod] = useState<'spanning' | 'non-spanning'>('non-spanning');
  const [traversalOrder, setTraversalOrder] = useState<TraversalOrder>('YZX');
  const [useDeepslate, setUseDeepslate] = useState(true);
  
  // Interaction State
  const [highlightedBlock, setHighlightedBlock] = useState<{ x: number, y: number, z: number, name: string } | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const selectedBlockType = 'minecraft:stone';
  const [structureVersion, setStructureVersion] = useState(0);

  // Handle block click (select single, or shift+click for multi-select)
  const handleBlockClick = (x: number, y: number, z: number, shiftKey: boolean) => {
    const key = `${x},${y},${z}`;
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      if (shiftKey) {
        // Toggle selection
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
      } else {
        // Replace selection
        next.clear();
        next.add(key);
      }
      return next;
    });
  };

  // Batch replace all selected blocks with target block type
  const handleReplaceBlocks = (blockName: string) => {
    if (!litematicObj || selectedBlocks.size === 0) return;
    const positions = Array.from(selectedBlocks).map(key => {
      const [x, y, z] = key.split(',').map(Number);
      return { x, y, z };
    });
    const command = new BatchSetBlockCommand(litematicObj, positions, blockName);
    editHistoryRef.current.execute(command);
    syncHistoryState();
    setSelectedBlocks(new Set());
    setStructureVersion(v => v + 1);
    forceUpdate();
  };

  // Set block at global coordinates (via EditHistory for undo support)
  const handleSetBlock = (x: number, y: number, z: number, blockName?: string) => {
    if (!litematicObj) return;
    const name = blockName ?? selectedBlockType;
    const command = new SetBlockCommand(litematicObj, x, y, z, name);
    editHistoryRef.current.execute(command);
    syncHistoryState();
    forceUpdate();
  };

  // File Handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setMetadata(null)
    setLitematicObj(null)
    setFileName(file.name)
    setLoading(true)
    setSelectedBlocks(new Set())
    editHistoryRef.current.clear()
    syncHistoryState()

    try {
      const arrayBuffer = await file.arrayBuffer()
      
      let buffer: Buffer;
      try {
        const unzipped = pako.ungzip(new Uint8Array(arrayBuffer))
        buffer = Buffer.from(unzipped)
      } catch (e) {
        console.warn('Gzip decompression failed, trying raw buffer', e)
        buffer = Buffer.from(arrayBuffer)
      }

      const { parsed } = await nbt.parse(buffer)
      console.log('Parsed NBT:', parsed)

      let schematic: Schematic;
      const root = parsed.value || {};
      
      // Determine format
      if (root.Regions || root.Metadata || (root.Version && root.Version.value)) {
        schematic = new Litematic(parsed);
      } else if (root.blocks && (root.palette || root.palettes) && root.size) {
        schematic = new Structure(parsed);
      } else {
        // Try fallback to Structure if it looks like one, otherwise Litematic or Error
        if (root.blocks) {
             schematic = new Structure(parsed);
        } else {
             schematic = new Litematic(parsed); // Hope for the best
        }
      }

      setLitematicObj(schematic);
      
      // Set initial unpacking method if it's Litematic
      if (schematic instanceof Litematic) {
        setUnpackingMethod(schematic.preferredFormat);
      } else {
        // Structure is always unpacked effectively, but we can set default
        setUnpackingMethod('non-spanning');
      }

      setMetadata(schematic.metadata);


    } catch (err: any) {
      console.error(err)
      setError(`Failed to parse file: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleMetadataChange = (field: keyof LitematicMetadata, value: string) => {
    if (!metadata) return
    setMetadata({ ...metadata, [field]: value })
  }

  const handlePaletteUpdate = () => {
    // Force re-render as the schematic object has been mutated in place
    forceUpdate();
  };

  const handleSave = (format?: 'litematic' | 'nbt') => {
    if (!litematicObj || !metadata) return

    try {
      // Update object metadata with current UI state
      litematicObj.metadata = { ...litematicObj.metadata, ...metadata };

      // Determine format to save
      // If format is not specified, use the current object's natural format
      // Litematic -> .litematic
      // Structure -> .nbt
      // But if we want to "Export As...", we might need conversion.
      
      // Since our Schematic interface doesn't strictly support cross-conversion yet in a single method call,
      // we might need to handle it here or enhance the classes.
      
      // For now, let's assume we save in the format of the current object 
      // UNLESS a specific format is requested that differs.
      
      let nbtData: any;
      let targetFileName = fileName;

      if (format === 'nbt' && litematicObj instanceof Litematic) {
          // Convert Litematic -> Structure NBT
          // This requires creating a new Structure instance from Litematic regions
          // But Structure constructor expects NBT.
          // We should add a static method or utility to create Structure from Regions.
          // For now, let's keep it simple: We need a way to convert.
          
          // Let's implement a simple on-the-fly conversion here or inside Structure class
          // ideally: const structure = Structure.fromSchematic(litematicObj);
          // nbtData = structure.toNbt();
          
          // Since we haven't implemented that yet, let's just warn and save as original for now, 
          // but we will implement it in next steps.
          console.warn("Litematic -> Structure conversion triggered");
          // Placeholder:
          nbtData = litematicObj.toNbt(); 
          if (!targetFileName.endsWith('.litematic')) targetFileName += '.litematic';
      } else if (format === 'litematic' && litematicObj instanceof Structure) {
          // Convert Structure -> Litematic NBT
          console.warn("Structure -> Litematic conversion triggered");
          // Placeholder:
          nbtData = litematicObj.toNbt();
          if (!targetFileName.endsWith('.nbt')) targetFileName += '.nbt';
      } else {
          // No conversion needed
          nbtData = litematicObj.toNbt();
          
          // Fix extension if needed
          if (format === 'litematic' && !targetFileName.endsWith('.litematic')) {
              targetFileName = targetFileName.replace(/\.\w+$/, '') + '.litematic';
          } else if (format === 'nbt' && !targetFileName.endsWith('.nbt')) {
              targetFileName = targetFileName.replace(/\.\w+$/, '') + '.nbt';
          }
      }

      const newBuffer = nbt.writeUncompressed(nbtData)
      const compressed = pako.gzip(new Uint8Array(newBuffer))

      const blob = new Blob([compressed], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = targetFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (err: any) {
      console.error('Save failed:', err)
      setError(`Failed to save file: ${err.message}`)
    }
  }

  // Force update wrapper to re-render App when layout changes
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  // --- Layout Factory ---
  const factory = (node: TabNode) => {
    const component = node.getComponent();
    
    switch (component) {
      case 'viewer':
        return (
          <ViewerPanel
            litematicObj={litematicObj}
            loading={loading}
            error={error}
            onFileUpload={handleFileUpload}
            useDeepslate={useDeepslate}
            unpackingMethod={unpackingMethod}
            traversalOrder={traversalOrder}
            onHoverBlock={setHighlightedBlock}
            onBlockClick={handleBlockClick}
            selectedBlocks={selectedBlocks}
            selectedBlockType={selectedBlockType}
            structureVersion={structureVersion}
          />
        );
      case 'metadata':
        return <MetadataPanel metadata={metadata} onChange={handleMetadataChange} />;
      case 'palette':
        return (
          <PalettePanel
            litematicObj={litematicObj}
            onUpdate={handlePaletteUpdate}
            getBlockColor={getBlockColor}
            selectedBlocks={selectedBlocks}
            onReplaceBlocks={handleReplaceBlocks}
          />
        );
      case 'settings':
        return (
          <SettingsPanel 
            unpackingMethod={unpackingMethod}
            setUnpackingMethod={setUnpackingMethod}
            traversalOrder={traversalOrder}
            setTraversalOrder={setTraversalOrder}
            useDeepslate={useDeepslate}
            setUseDeepslate={setUseDeepslate}
          />
        );
      case 'nbt':
        return <NbtPanel litematicObj={litematicObj} />;
      default:
        return <div>Unknown Component</div>;
    }
  }

  // --- Menu Handlers ---
  const togglePanel = (component: string, name: string) => {
    // Attempt to find existing node
    let existingNode: TabNode | null = null;
    model.visitNodes((node) => {
      if (node.getType() === 'tab' && node.getComponent() === component) {
        existingNode = node as TabNode;
      }
    });

    if (existingNode) {
      // If it exists, close it (toggle behavior)
      model.doAction(Actions.deleteTab((existingNode as TabNode).getId()));
    } else {
      // If not, add it
      
      // Smart Positioning: Try to add to an existing sidebar TabSet if possible
      let targetNodeId = 'root';
      let location = DockLocation.RIGHT;
      
      let bestTabSetId: string | null = null;
      model.visitNodes((node) => {
          if (node.getType() === 'tabset') {
              // Check if this tabset contains any of our sidebar panels
              const children = node.getChildren();
              for (const child of children) {
                  // FlexLayout types might need casting if getChildren returns generic nodes
                  const comp = (child as TabNode).getComponent();
                  if (['metadata', 'palette', 'settings', 'nbt'].includes(comp as string)) {
                      bestTabSetId = node.getId();
                      break;
                  }
              }
          }
      });

      if (bestTabSetId) {
          targetNodeId = bestTabSetId;
          location = DockLocation.CENTER; // Add as a new tab in this set
      }

      model.doAction(Actions.addNode({
          type: 'tab',
          component: component,
          name: name,
          enableClose: true,
      }, targetNodeId, location, -1));
    }
  };

  // ── Keyboard shortcuts (Ctrl+Z / Ctrl+Y) ─────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+Z = Redo
          const label = editHistoryRef.current.redo();
          if (label) {
            syncHistoryState();
            setStructureVersion(v => v + 1);
            forceUpdate();
          }
        } else {
          // Ctrl+Z = Undo
          const label = editHistoryRef.current.undo();
          if (label) {
            syncHistoryState();
            setStructureVersion(v => v + 1);
            forceUpdate();
          }
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        // Ctrl+Y = Redo
        const label = editHistoryRef.current.redo();
        if (label) {
          syncHistoryState();
          setStructureVersion(v => v + 1);
          forceUpdate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [syncHistoryState]);

  const isPanelOpen = (component: string) => {
     let isOpen = false;
     model.visitNodes((node) => {
       // Check if node exists in the tree and is a tab with matching component
       // We do NOT check isVisible() because that only returns true for the actively selected tab
       // We want to show the checkmark if the tab exists anywhere in the layout (even if in background)
       if (node.getType() === 'tab' && node.getComponent() === component) {
         isOpen = true;
       }
     });
     return isOpen;
  };

  return (
    <div className="studio-container">
      {/* 1. Top Bar */}
      <div className="top-bar" style={{padding: 0}}>
        <div style={{padding: '0 15px', display: 'flex', alignItems: 'center', borderRight: '1px solid #111', height: '100%'}}>
           <span className="top-bar-title" style={{margin: 0}}>Litematic Studio</span>
        </div>
        
        <MenuBar 
           onOpenFile={handleFileUpload}
           onSaveFile={handleSave}
           onReset={() => { setLitematicObj(null); setMetadata(null); setFileName('edited.litematic'); }}
           onAbout={() => alert('Litematic Studio v1.0\nBy CYQ\nPowered by Deepslate & React')}
           
           useDeepslate={useDeepslate}
           setUseDeepslate={setUseDeepslate}
           unpackingMethod={unpackingMethod}
           setUnpackingMethod={setUnpackingMethod}
           traversalOrder={traversalOrder}
           setTraversalOrder={setTraversalOrder}
           
           togglePanel={togglePanel}
           isPanelOpen={isPanelOpen}
           
           hasFile={!!litematicObj}
        />

        {loading && <span style={{marginLeft: 'auto', marginRight: '15px', fontSize: '12px', color: '#aaa'}}>Processing...</span>}
        {!loading && fileName && <span style={{marginLeft: 'auto', marginRight: '15px', fontSize: '12px', color: '#888'}}>{fileName}</span>}
      </div>

      {/* 2. Main Workspace (FlexLayout) */}
      <div className="workspace" style={{position: 'relative'}}>
         <Layout 
            model={model} 
            factory={factory} 
            onModelChange={() => forceUpdate()} // Sync layout state with React state
         />
      </div>

      {/* 3. Status Bar */}
      <div style={{ flex: '0 0 24px', zIndex: 100 }}>
        <StatusBar 
           loading={loading}
           error={error}
           statusMessage={litematicObj ? "Ready. Use WASD to move, Drag to rotate." : "Waiting for file..."}
           
           hasFile={!!litematicObj}
           regions={metadata?.regions || 0}
           size={metadata?.size || null}
           
           useDeepslate={useDeepslate}
           unpackingMethod={unpackingMethod}
           traversalOrder={traversalOrder}

           highlightedBlock={highlightedBlock}
           undoLabel={undoLabel}
           redoLabel={redoLabel}
        />
      </div>

    </div>
  )
}

export default App
