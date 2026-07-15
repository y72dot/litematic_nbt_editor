import LitematicViewer from '../../LitematicViewer';
import DeepslateViewer from '../DeepslateViewer';
import type { Schematic } from '../../core/Schematic';
import type { TraversalOrder } from '../../core/BlockStorage';
import type { InteractionMode, SelectionMode, EditMode, BoxSelectionState } from '../../types';

interface ViewerPanelProps {
  litematicObj: Schematic | null;
  loading: boolean;
  error: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  useDeepslate: boolean;
  unpackingMethod: 'spanning' | 'non-spanning';
  traversalOrder: TraversalOrder;

  onHoverBlock?: (block: { x: number, y: number, z: number, name: string } | null) => void;
  selectedBlocks?: Set<string>;
  activeBlockType?: string;

  interactionMode?: InteractionMode;
  selectionMode?: SelectionMode;
  editMode?: EditMode;
  boxSelectionState?: BoxSelectionState;
  onSelectionClick?: (x: number, y: number, z: number, additive: boolean, subtractive: boolean) => void;
  onBoxSelectStart?: (x: number, y: number, z: number) => void;
  onBoxSelectUpdate?: (x: number, y: number, z: number) => void;
  onBoxSelectEnd?: () => void;
  onEditClick?: (x: number, y: number, z: number) => void;

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
  selectedBlocks,
  interactionMode,
  selectionMode,
  editMode,
  boxSelectionState,
  onSelectionClick,
  onBoxSelectStart,
  onBoxSelectUpdate,
  onBoxSelectEnd,
  onEditClick,
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
                selectedBlocks={selectedBlocks}
                interactionMode={interactionMode}
                selectionMode={selectionMode}
                editMode={editMode}
                boxSelectionState={boxSelectionState}
                onSelectionClick={onSelectionClick}
                onBoxSelectStart={onBoxSelectStart}
                onBoxSelectUpdate={onBoxSelectUpdate}
                onBoxSelectEnd={onBoxSelectEnd}
                onEditClick={onEditClick}
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
