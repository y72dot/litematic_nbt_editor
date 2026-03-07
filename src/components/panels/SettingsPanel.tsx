import type { TraversalOrder } from '../../core/BlockStorage';

interface SettingsPanelProps {
  unpackingMethod: 'spanning' | 'non-spanning';
  setUnpackingMethod: (val: 'spanning' | 'non-spanning') => void;
  traversalOrder: TraversalOrder;
  setTraversalOrder: (val: TraversalOrder) => void;
  useDeepslate: boolean;
  setUseDeepslate: (val: boolean) => void;
}

export default function SettingsPanel({
  unpackingMethod,
  setUnpackingMethod,
  traversalOrder,
  setTraversalOrder,
  useDeepslate,
  setUseDeepslate
}: SettingsPanelProps) {
  
  return (
    <div className="panel-section-body" style={{ height: '100%', overflowY: 'auto' }}>
       <label className="studio-label">Renderer</label>
       <select 
          className="studio-select"
          value={useDeepslate ? 'deepslate' : 'three'} 
          onChange={(e) => setUseDeepslate(e.target.value === 'deepslate')}
       >
          <option value="deepslate">Deepslate (High Quality)</option>
          <option value="three">Three.js (Simple)</option>
       </select>
       
       <label className="studio-label" style={{marginTop: '10px'}}>Block Unpacking Format</label>
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
          <option value="YXZ">YXZ</option>
          <option value="XZY">XZY</option>
          <option value="ZXY">ZXY</option>
          <option value="ZYX">ZYX</option>
       </select>
       
       <div style={{marginTop: '20px', fontSize: '11px', color: '#666'}}>
         Note: Unpacking format is usually auto-detected from Litematic version.
       </div>
    </div>
  );
}
