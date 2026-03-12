import LitematicViewer from '../../LitematicViewer';
import DeepslateViewer from '../DeepslateViewer';
import { Litematic } from '../../core/Litematic';
import type { Schematic } from '../../core/Schematic';
import type { TraversalOrder } from '../../core/BlockStorage';

interface ViewerPanelProps {
  litematicObj: Schematic | null;
  loading: boolean;
  error: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  // Settings
  useDeepslate: boolean;
  unpackingMethod: 'spanning' | 'non-spanning';
  traversalOrder: TraversalOrder;
  
  // Callbacks
  onHoverBlock?: (block: { x: number, y: number, z: number, name: string } | null) => void;
}

export default function ViewerPanel({ 
  litematicObj, 
  loading, 
  error, 
  onFileUpload,
  useDeepslate,
  unpackingMethod,
  traversalOrder,
  onHoverBlock
}: ViewerPanelProps) {
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#111' }}>
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
                onChange={onFileUpload}
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
                onHoverBlock={onHoverBlock}
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
  );
}
