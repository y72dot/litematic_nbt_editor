import { useTranslation } from 'react-i18next'
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

  // Undo/Redo
  undoLabel?: string | null;
  redoLabel?: string | null;
}

export default function StatusBar(props: StatusBarProps) {
  const { t } = useTranslation()
  return (
    <div className="status-bar">

      {/* Left: Status & Errors */}
      <div className="status-left">
        {props.undoLabel && (
          <div className="status-item" style={{ opacity: 0.7 }} title={t('statusBar.undoPrefix', { label: props.undoLabel })}>
            <span className="status-text" style={{ color: '#aaa' }}>{t('statusBar.undoPrefix', { label: props.undoLabel })}</span>
          </div>
        )}
        {props.redoLabel && (
          <div className="status-item" style={{ opacity: 0.7 }} title={t('statusBar.redoPrefix', { label: props.redoLabel })}>
            <span className="status-text" style={{ color: '#aaa' }}>{t('statusBar.redoPrefix', { label: props.redoLabel })}</span>
          </div>
        )}
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
             <span className="status-text">{t('common.processing')}</span>
          </div>
        ) : (
          <div className="status-item">
             <span className="status-icon">ℹ️</span>
             <span className="status-text">{props.statusMessage || t('common.ready')}</span>
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
                     : props.size || t('common.unknownSize')}
               </span>
            </div>
            
            <div className="status-separator"></div>
            
            <div className="status-item">
               <span className="status-icon">📦</span>
               <span className="status-text">{t('statusBar.regionCount', { count: props.regions })}</span>
            </div>
         </div>
      )}

      {/* Right: Technical Details */}
      <div className="status-right">
        {props.hasFile && (
           <>
              <div className="status-item">
                 <span className="status-text" title="Block Unpacking Method">
                    {t('statusBar.format', { version: props.unpackingMethod === 'spanning' ? '1.13-1.15' : '1.16+' })}
                 </span>
              </div>

              <div className="status-separator"></div>

              <div className="status-item">
                 <span className="status-text" title="Rendering Engine">
                    {props.useDeepslate ? t('statusBar.engineDeepslate') : t('statusBar.engineThreeJs')}
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
