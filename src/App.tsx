import { useState, Suspense } from 'react'
import * as nbt from 'prismarine-nbt'
import pako from 'pako'
import './App.css'
import { Buffer } from 'buffer'
import LitematicViewer from './LitematicViewer'

// Explicitly ensure Buffer is on window if not already there,
// though the polyfill plugin should handle this.
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
  const [originalNbt, setOriginalNbt] = useState<any | null>(null)
  const [fileName, setFileName] = useState<string>('edited.litematic')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setMetadata(null)
    setOriginalNbt(null)
    setFileName(file.name)
    setLoading(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      
      // 1. Ungzip the file
      let buffer: Buffer;
      try {
        const unzipped = pako.ungzip(new Uint8Array(arrayBuffer))
        buffer = Buffer.from(unzipped)
      } catch (e) {
        console.warn('Gzip decompression failed, trying raw buffer', e)
        buffer = Buffer.from(arrayBuffer)
      }

      // 2. Parse NBT
      const { parsed } = await nbt.parse(buffer)
      setOriginalNbt(parsed)
      console.log('Parsed NBT:', parsed)

      // 3. Extract Metadata
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

  const handleSave = () => {
    if (!originalNbt || !metadata) return

    try {
      const root = originalNbt.value
      
      if (!root.Metadata) {
        root.Metadata = { type: 'compound', value: {} }
      }
      
      const metaVal = root.Metadata.value
      
      metaVal.Name = { type: 'string', value: metadata.name }
      metaVal.Author = { type: 'string', value: metadata.author }
      metaVal.Description = { type: 'string', value: metadata.description }
      
      const now = Date.now()
      metaVal.TimeModified = { type: 'long', value: BigInt(now) }

      const newBuffer = nbt.writeUncompressed(originalNbt)
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
    if (!originalNbt) return ''
    return JSON.stringify(originalNbt, (key, value) => {
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

      {/* 3D Viewer Section */}
      {originalNbt && !loading && (
        <div className="viewer-section">
          <h2>3D Preview</h2>
          <Suspense fallback={<div>Loading 3D Scene...</div>}>
            <LitematicViewer nbtData={originalNbt} />
          </Suspense>
          <p className="hint">Left click to rotate, Right click to pan, Scroll to zoom</p>
        </div>
      )}

      {/* Metadata Editor Section */}
      {metadata && (
        <div className="metadata-card">
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
      {originalNbt && (
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
