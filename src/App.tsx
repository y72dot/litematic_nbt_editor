import { useState } from 'react'
import * as nbt from 'prismarine-nbt'
import pako from 'pako'
import './App.css'
import { Buffer } from 'buffer'
import LitematicViewer, { getBlockColor } from './LitematicViewer'
import DeepslateViewer from './components/DeepslateViewer'
import PaletteEditor from './PaletteEditor'
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
  
  // We keep the raw NBT for saving, and the Litematic object for viewing/editing
  // Actually, we should probably make Litematic object the source of truth for saving too,
  // but for now let's keep rawNbt as the "file" and litematicObj as the "view model".
  // When saving, we might need to sync back.
  // OR: Litematic object wraps the rawNbt, so modifying Litematic.rawNbt is enough?
  // Yes, our Litematic class stores reference to rawNbt.
  
  const [litematicObj, setLitematicObj] = useState<Litematic | null>(null);
  const [fileName, setFileName] = useState<string>('edited.litematic')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showJson, setShowJson] = useState(false)
  
  // New state for unpacking method
  const [unpackingMethod, setUnpackingMethod] = useState<'spanning' | 'non-spanning'>('non-spanning');
  const [traversalOrder, setTraversalOrder] = useState<TraversalOrder>('YZX');
  const [useDeepslate, setUseDeepslate] = useState(true);

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
    // When palette updates, we need to refresh the Litematic object
    // Since we are modifying the raw NBT in place (in PaletteEditor), 
    // we can just trigger a re-render or recreate the wrapper.
    // Ideally PaletteEditor should call a method on Litematic object.
    // For now, let's just recreate the wrapper to be safe and trigger effects.
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
    <div className="container">
      <h1>Litematic Viewer & Editor</h1>
      
      <div className="upload-section">
        <input 
          type="file" 
          accept=".litematic,.nbt,.schematic" 
          onChange={handleFileUpload} 
        />
        <p>Upload a <code>.litematic</code> file to analyze and edit.</p>
      </div>

      {loading && <p>Parsing file...</p>}
      {error && <div className="error">{error}</div>}

      {/* Main Content Area: Split View */}
      {litematicObj && !loading && (
        <div className="main-content" style={{ display: 'flex', gap: '20px', width: '100%', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          {/* Left: 3D Viewer */}
          <div className="viewer-section" style={{ flex: '1', minWidth: '300px', maxWidth: '800px' }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                <h2>3D Preview</h2>
                
                {/* Unpacking Method Switcher */}
                <div style={{fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <div>
                        <label style={{marginRight: '10px'}}>Renderer:</label>
                        <select 
                            value={useDeepslate ? 'deepslate' : 'three'} 
                            onChange={(e) => setUseDeepslate(e.target.value === 'deepslate')}
                            style={{padding: '4px'}}
                        >
                            <option value="deepslate">Deepslate (High Quality)</option>
                            <option value="three">Simple (Three.js)</option>
                        </select>
                    </div>
                    {/* Only show unpacking options for Three.js viewer or if we want to debug logic globally */}
                    {/* Actually DeepslateViewer also depends on Litematic parsing which uses these settings, so keep them visible */}
                    <div>
                        <label style={{marginRight: '10px'}}>Format:</label>
                        <select 
                            value={unpackingMethod} 
                            onChange={(e) => setUnpackingMethod(e.target.value as any)}
                            style={{padding: '4px'}}
                        >
                            <option value="non-spanning">1.16+ (Non-Spanning)</option>
                            <option value="spanning">1.13-1.15 (Spanning)</option>
                        </select>
                    </div>
                    <div>
                        <label style={{marginRight: '10px'}}>Order:</label>
                        <select 
                            value={traversalOrder} 
                            onChange={(e) => setTraversalOrder(e.target.value as any)}
                            style={{padding: '4px'}}
                        >
                            <option value="YZX">YZX (Standard)</option>
                            <option value="XYZ">XYZ</option>
                            <option value="YXZ">YXZ</option>
                            <option value="XZY">XZY</option>
                            <option value="ZXY">ZXY</option>
                            <option value="ZYX">ZYX</option>
                        </select>
                    </div>
                </div>
            </div>
            
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
            <p className="hint">Left click to rotate, Right click to pan, Scroll to zoom</p>
          </div>

          {/* Right: Palette Editor */}
          <div className="palette-section" style={{ flex: '0 0 300px' }}>
            <PaletteEditor 
              nbtData={litematicObj.rawNbt} 
              onUpdate={handlePaletteUpdate} 
              getBlockColor={getBlockColor} 
            />
          </div>

        </div>
      )}

      {/* Metadata Editor Section */}
      {metadata && (
        <div className="metadata-card" style={{ marginTop: '20px' }}>
          <h2>File Metadata (Editable)</h2>
          <div className="form-group">
            <label>Name:</label>
            <input 
              type="text" 
              value={metadata.name} 
              onChange={(e) => handleMetadataChange('name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Author:</label>
            <input 
              type="text" 
              value={metadata.author} 
              onChange={(e) => handleMetadataChange('author', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Description:</label>
            <textarea 
              value={metadata.description} 
              onChange={(e) => handleMetadataChange('description', e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="read-only-info">
            <ul>
              <li><strong>Regions Count:</strong> {metadata.regions}</li>
              <li><strong>Enclosing Size:</strong> {typeof metadata.size === 'object' ? `${metadata.size.x} x ${metadata.size.y} x ${metadata.size.z}` : metadata.size}</li>
              <li><strong>Created:</strong> {metadata.timeCreated}</li>
              <li><strong>Modified:</strong> {metadata.timeModified} (Will update on save)</li>
            </ul>
          </div>

          <button className="save-button" onClick={handleSave}>
            Save & Download .litematic
          </button>
        </div>
      )}

      {/* JSON Toggle */}
      {litematicObj && (
        <div style={{width: '100%', maxWidth: '800px', marginTop: '20px'}}>
           <button onClick={() => setShowJson(!showJson)} style={{marginBottom: '10px'}}>
             {showJson ? 'Hide Raw NBT Data' : 'Show Raw NBT Data'}
           </button>
           
           {showJson && (
            <div className="json-viewer">
              <textarea 
                readOnly 
                value={getJsonText()} 
                style={{ width: '100%', height: '400px', fontFamily: 'monospace' }}
              />
            </div>
           )}
        </div>
      )}
    </div>
  )
}

export default App
