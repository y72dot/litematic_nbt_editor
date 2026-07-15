import LitematicViewer from '../../LitematicViewer';
import DeepslateViewer from '../DeepslateViewer';
import type { Schematic } from '../../core/Schematic';
import type { TraversalOrder } from '../../core/BlockStorage';

/** Props shared by both 3D viewer components. */
export interface ViewerRendererProps {
  litematic: Schematic | null;
  unpackingMethod?: 'spanning' | 'non-spanning';
  onHoverBlock?: (block: { x: number, y: number, z: number, name: string } | null) => void;
  onBlockInteract?: (x: number, y: number, z: number, shiftKey: boolean) => void;
}

interface ViewerPanelProps {
  litematicObj: Schematic | null;
  loading: boolean;
  error: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  useDeepslate: boolean;
  unpackingMethod: 'spanning' | 'non-spanning';
  traversalOrder: TraversalOrder;

  onHoverBlock?: (block: { x: number, y: number, z: number, name: string } | null) => void;
  onBlockInteract?: (x: number, y: number, z: number, shiftKey: boolean) => void;
  selectedBlocks?: Set<string>;
  selectedBlockType?: string;
  activeTool?: string;
  structureVersion?: number;
}

export default function ViewerPanel({
  litematicObj,
  loading,
  error,
  onFileUpload,
  useDeepslate,
  unpackingMethod,
  traversalOrder,
  onHoverBlock,
  onBlockInteract,
  selectedBlocks,
  activeTool,
  structureVersion,
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
                onBlockInteract={onBlockInteract}
                selectedBlocks={selectedBlocks}
                activeTool={activeTool}
                structureVersion={structureVersion}
              />
            ) : (
              <LitematicViewer
                litematic={litematicObj}
                unpackingMethod={unpackingMethod}
                traversalOrder={traversalOrder}
              />
            )}
         </>
      )}
    </div>
  );
}
