import { useState, useRef } from 'react'
import * as nbt from 'prismarine-nbt'
import pako from 'pako'
import './App.css'
import { Buffer } from 'buffer'
import LitematicViewer, { getBlockColor } from './LitematicViewer'
import DeepslateViewer from './components/DeepslateViewer'
import PaletteEditor from './PaletteEditor'
import MenuBar from './components/MenuBar'
import StatusBar from './components/StatusBar'
import { Litematic } from './core/Litematic'
import type { TraversalOrder } from './core/BlockStorage'

// Explicitly ensure Buffer is on window if not already there
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

interface LitematicMetadata {
  name: string
  author: string
  description: string
  regions: number
  size: { x: number, y: number, z: number } | string
  timeCreated: string
  timeModified: string
  enclosingSize: { x: number, y: number, z: number } | string
}

function App() {
  const [metadata, setMetadata] = useState<LitematicMetadata | null>(null)
  const [litematicObj, setLitematicObj] = useState<Litematic | null>(null);
  const [fileName, setFileName] = useState<string>('edited.litematic')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showJson, setShowJson] = useState(false)
  
  // New state for unpacking method
  const [unpackingMethod, setUnpackingMethod] = useState<'spanning' | 'non-spanning'>('non-spanning');
  const [traversalOrder, setTraversalOrder] = useState<TraversalOrder>('YZX');
  const [useDeepslate, setUseDeepslate] = useState(true);

  // Panel State
  const [activeTab, setActiveTab] = useState<'metadata' | 'palette' | 'settings'>('metadata');
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(true);
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

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

      // Initialize Core Model
      const litematic = new Litematic(parsed);
      setLitematicObj(litematic);
      setUnpackingMethod(litematic.preferredFormat);

      // Extract Metadata for UI
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
      
      if (!root.Metadata) {
        root.Metadata = { type: 'compound', value: {} }
      }
      
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

  // Helper to format JSON for display
  const getJsonText = () => {
    if (!litematicObj) return ''
    return JSON.stringify(litematicObj.rawNbt, (_key, value) => {
      if (typeof value === 'bigint') return value.toString() + 'n'
      return value
    }, 2)
  }

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
           
           showJson={showJson}
           setShowJson={setShowJson}
           isPropertiesVisible={isMetadataExpanded || isPaletteExpanded || isSettingsExpanded}
           toggleProperties={() => {
              const anyVisible = isMetadataExpanded || isPaletteExpanded || isSettingsExpanded;
              setIsMetadataExpanded(!anyVisible);
              setIsPaletteExpanded(!anyVisible);
              setIsSettingsExpanded(!anyVisible);
           }}
           
           hasFile={!!litematicObj}
        />

        {loading && <span style={{marginLeft: 'auto', marginRight: '15px', fontSize: '12px', color: '#aaa'}}>Processing...</span>}
        {!loading && fileName && <span style={{marginLeft: 'auto', marginRight: '15px', fontSize: '12px', color: '#888'}}>{fileName}</span>}
      </div>

      {/* 2. Main Workspace */}
      <div className="workspace">
        
        {/* Center: Viewport */}
        <div className="viewport-area">
          {error && (
            <div style={{position:'absolute', top: 20, left: 20, right: 20, padding: 10, background: '#522', border: '1px solid #f55', color: '#fff', zIndex: 100}}>
              {error}
            </div>
          )}
          
          {!litematicObj && !loading && (
             <div className="empty-state">
               <div style={{fontSize: '48px', marginBottom: '20px'}}>🧊</div>
               <h3>No Model Loaded</h3>
               <p>Open a .litematic file to begin editing</p>
               <label className="upload-btn-large">
                  Select File
                  <input 
                    type="file" 
                    accept=".litematic,.nbt,.schematic" 
                    onChange={handleFileUpload}
                    style={{display: 'none'}} 
                  />
               </label>
             </div>
          )}

          {litematicObj && (
             <>
                {useDeepslate ? (
                  <DeepslateViewer 
                    litematic={litematicObj} 
                    unpackingMethod={unpackingMethod}
                  />
                ) : (
                  <LitematicViewer 
                    litematic={litematicObj} 
                    unpackingMethod={unpackingMethod} 
                    traversalOrder={traversalOrder}
                  />
                )}
                <div className="viewport-overlay-hint">
                  LMB: Rotate | RMB: Pan | Scroll: Zoom | WASD+Space: Move
                </div>
             </>
          )}
        </div>

        {/* Right: Side Panel */}
        <div className="side-panel">
          <div className="panel-header">
            <span>Properties</span>
          </div>
          
          <div className="panel-content">
             {litematicObj && metadata ? (
               <>
                  {/* Section: Metadata */}
                  <div className="panel-section">
                    <div className="panel-section-title" onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}>
                       <span>Metadata</span>
                       <span>{isMetadataExpanded ? '▼' : '▶'}</span>
                    </div>
                    {isMetadataExpanded && (
                      <div className="panel-section-body">
                         <label className="studio-label">Name</label>
                         <input className="studio-input" value={metadata.name} onChange={(e) => handleMetadataChange('name', e.target.value)} />
                         
                         <label className="studio-label">Author</label>
                         <input className="studio-input" value={metadata.author} onChange={(e) => handleMetadataChange('author', e.target.value)} />
                         
                         <label className="studio-label">Description</label>
                         <textarea className="studio-input" rows={3} value={metadata.description} onChange={(e) => handleMetadataChange('description', e.target.value)} />
                         
                         <div style={{fontSize: '11px', color: '#888', marginTop: '10px'}}>
                            <div>Size: {typeof metadata.size === 'object' ? `${metadata.size.x} x ${metadata.size.y} x ${metadata.size.z}` : metadata.size}</div>
                            <div>Regions: {metadata.regions}</div>
                         </div>
                      </div>
                    )}
                  </div>

                  {/* Section: Palette */}
                  <div className="panel-section">
                    <div className="panel-section-title" onClick={() => setIsPaletteExpanded(!isPaletteExpanded)}>
                       <span>Palette Editor</span>
                       <span>{isPaletteExpanded ? '▼' : '▶'}</span>
                    </div>
                    {isPaletteExpanded && (
                      <div className="panel-section-body" style={{padding: 0}}>
                        <PaletteEditor 
                          nbtData={litematicObj.rawNbt} 
                          onUpdate={handlePaletteUpdate} 
                          getBlockColor={getBlockColor} 
                        />
                      </div>
                    )}
                  </div>

                  {/* Section: Settings */}
                  <div className="panel-section">
                    <div className="panel-section-title" onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}>
                       <span>Advanced Settings</span>
                       <span>{isSettingsExpanded ? '▼' : '▶'}</span>
                    </div>
                    {isSettingsExpanded && (
                      <div className="panel-section-body">
                         <label className="studio-label">Block Unpacking Format</label>
                         <select 
                            className="studio-select"
                            value={unpackingMethod} 
                            onChange={(e) => setUnpackingMethod(e.target.value as any)}
                         >
                            <option value="non-spanning">1.16+ (Non-Spanning)</option>
                            <option value="spanning">1.13-1.15 (Spanning)</option>
                         </select>
                         
                         <label className="studio-label" style={{marginTop: '10px'}}>Traversal Order</label>
                         <select 
                            className="studio-select"
                            value={traversalOrder} 
                            onChange={(e) => setTraversalOrder(e.target.value as any)}
                         >
                            <option value="YZX">YZX (Standard)</option>
                            <option value="XYZ">XYZ</option>
                         </select>

                         <button 
                            className="top-bar-btn" 
                            style={{width: '100%', marginTop: '10px', border: '1px solid #555'}}
                            onClick={() => setShowJson(!showJson)}
                         >
                            {showJson ? 'Hide Raw NBT' : 'Show Raw NBT'}
                         </button>
                      </div>
                    )}
                  </div>
               </>
             ) : (
               <div style={{padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
                  No active selection
               </div>
             )}
          </div>
        </div>
      </div>
      
      {/* Raw NBT Overlay */}
      {showJson && litematicObj && (
        <div style={{
          position: 'absolute', 
          top: '40px', left: 0, right: '320px', bottom: '24px', 
          background: 'rgba(0,0,0,0.9)', 
          zIndex: 50,
          padding: '20px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
           <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#fff'}}>
              <h3>Raw NBT Data</h3>
              <button onClick={() => setShowJson(false)} className="top-bar-btn">Close</button>
           </div>
           <textarea 
             readOnly 
             value={getJsonText()} 
             style={{ flex: 1, fontFamily: 'monospace', background: '#222', color: '#afa', border: 'none', padding: '10px' }}
           />
        </div>
      )}

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
        />
      </div>

    </div>
  )
}

export default App
