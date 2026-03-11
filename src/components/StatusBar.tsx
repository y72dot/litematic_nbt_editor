import './StatusBar.css';

interface StatusBarProps {
  // Application State
  loading: boolean;
  error: string | null;
  statusMessage: string; // Dynamic message (e.g., "Left click to rotate...")
  
  // Model Info
  hasFile: boolean;
  regions: number;
  size: { x: number, y: number, z: number } | string | null;
  
  // Settings Info
  useDeepslate: boolean;
  unpackingMethod: 'spanning' | 'non-spanning';
  traversalOrder: string;

  // Interaction Info
  highlightedBlock: { x: number, y: number, z: number, name: string } | null;
}

export default function StatusBar(props: StatusBarProps) {
  return (
    <div className="status-bar">
      
      {/* Left: Status & Errors */}
      <div className="status-left">
        {props.highlightedBlock ? (
           <div className="status-item highlight-info" style={{ fontWeight: 'bold', color: '#8f8' }}>
              <span className="status-icon">🎯</span>
              <span className="status-text">
                 [{props.highlightedBlock.x}, {props.highlightedBlock.y}, {props.highlightedBlock.z}] 
                 &nbsp; {props.highlightedBlock.name}
              </span>
           </div>
        ) : props.error ? (
          <div className="status-item status-error">
             <span className="status-icon">⚠️</span>
             <span className="status-text">{props.error}</span>
          </div>
        ) : props.loading ? (
          <div className="status-item status-loading">
             <span className="status-icon">⏳</span>
             <span className="status-text">Processing...</span>
          </div>
        ) : (
          <div className="status-item">
             <span className="status-icon">ℹ️</span>
             <span className="status-text">{props.statusMessage || "Ready"}</span>
          </div>
        )}
      </div>

      {/* Center: Model Statistics */}
      {props.hasFile && (
         <div className="status-center">
            <div className="status-item">
               <span className="status-icon">📐</span>
               <span className="status-text">
                  {props.size && typeof props.size === 'object' 
                     ? `${props.size.x} × ${props.size.y} × ${props.size.z}` 
                     : props.size || 'Unknown Size'}
               </span>
            </div>
            
            <div className="status-separator"></div>
            
            <div className="status-item">
               <span className="status-icon">📦</span>
               <span className="status-text">{props.regions} Region{props.regions !== 1 ? 's' : ''}</span>
            </div>
         </div>
      )}

      {/* Right: Technical Details */}
      <div className="status-right">
        {props.hasFile && (
           <>
              <div className="status-item">
                 <span className="status-text" title="Block Unpacking Method">
                    Format: {props.unpackingMethod === 'spanning' ? '1.13-1.15' : '1.16+'}
                 </span>
              </div>
              
              <div className="status-separator"></div>

              <div className="status-item">
                 <span className="status-text" title="Rendering Engine">
                    {props.useDeepslate ? 'Deepslate' : 'Three.js'}
                 </span>
              </div>
              
              <div className="status-separator"></div>
           </>
        )}
        
        <div className="status-item" style={{opacity: 0.5}}>
           <span className="status-text">v1.0.0</span>
        </div>
      </div>

    </div>
  );
}
