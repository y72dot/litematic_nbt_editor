import { useState, useRef } from 'react'
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
import type { TraversalOrder } from './core/BlockStorage'
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
  const [litematicObj, setLitematicObj] = useState<Litematic | null>(null);
  const [fileName, setFileName] = useState<string>('edited.litematic')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Settings State
  const [unpackingMethod, setUnpackingMethod] = useState<'spanning' | 'non-spanning'>('non-spanning');
  const [traversalOrder, setTraversalOrder] = useState<TraversalOrder>('YZX');
  const [useDeepslate, setUseDeepslate] = useState(true);
  
  // Interaction State
  const [highlightedBlock, setHighlightedBlock] = useState<{ x: number, y: number, z: number, name: string } | null>(null);

  // File Handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setMetadata(null)
    setLitematicObj(null)
    setFileName(file.name)
    setLoading(true)

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

      const litematic = new Litematic(parsed);
      setLitematicObj(litematic);
      setUnpackingMethod(litematic.preferredFormat);

      const root = parsed.value as any
      const meta = root.Metadata?.value || {}
      const enclosingSize = meta.EnclosingSize?.value || {}
      
      const extractedMeta: LitematicMetadata = {
        name: meta.Name?.value || '',
        author: meta.Author?.value || '',
        description: meta.Description?.value || '',
        regions: root.Regions?.value ? Object.keys(root.Regions.value).length : 0,
        size: enclosingSize.x ? 
          { x: enclosingSize.x.value, y: enclosingSize.y.value, z: enclosingSize.z.value } : 
          'Unknown',
        enclosingSize: enclosingSize.x ? 
          { x: enclosingSize.x.value, y: enclosingSize.y.value, z: enclosingSize.z.value } : 
          'Unknown',
        timeCreated: meta.TimeCreated?.value ? new Date(Number(meta.TimeCreated.value)).toLocaleString() : 'Unknown',
        timeModified: meta.TimeModified?.value ? new Date(Number(meta.TimeModified.value)).toLocaleString() : 'Unknown'
      }

      setMetadata(extractedMeta)

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

  const handlePaletteUpdate = (newNbt: any) => {
    const newLitematic = new Litematic(newNbt);
    setLitematicObj(newLitematic);
  };

  const handleSave = () => {
    if (!litematicObj || !metadata) return

    try {
      const root = litematicObj.rawNbt.value
      if (!root.Metadata) root.Metadata = { type: 'compound', value: {} }
      const metaVal = root.Metadata.value
      
      metaVal.Name = { type: 'string', value: metadata.name }
      metaVal.Author = { type: 'string', value: metadata.author }
      metaVal.Description = { type: 'string', value: metadata.description }
      
      const now = Date.now()
      metaVal.TimeModified = { type: 'long', value: BigInt(now) }

      const newBuffer = nbt.writeUncompressed(litematicObj.rawNbt)
      const compressed = pako.gzip(new Uint8Array(newBuffer))

      const blob = new Blob([compressed], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
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
          />
        );
      case 'metadata':
        return <MetadataPanel metadata={metadata} onChange={handleMetadataChange} />;
      case 'palette':
        return (
          <PalettePanel 
            nbtData={litematicObj?.rawNbt} 
            onUpdate={handlePaletteUpdate} 
            getBlockColor={getBlockColor} 
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
        />
      </div>

    </div>
  )
}

export default App
