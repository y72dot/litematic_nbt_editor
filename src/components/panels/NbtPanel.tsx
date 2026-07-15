import { useTranslation } from 'react-i18next'
import type { Schematic } from '../../core/Schematic';

interface NbtPanelProps {
  litematicObj: Schematic | null;
}

export default function NbtPanel({ litematicObj }: NbtPanelProps) {
  const { t } = useTranslation()

  if (!litematicObj) {
     return (
       <div style={{padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
          {t('common.noFileLoaded')}
       </div>
     );
  }

  // Helper to format JSON for display
  const getJsonText = () => {
    return JSON.stringify(litematicObj.rawNbt, (_key, value) => {
      if (typeof value === 'bigint') return value.toString() + 'n'
      return value
    }, 2)
  }

  return (
    <div className="panel-section-body" style={{ height: '100%', overflow: 'hidden', padding: 0 }}>
      <textarea 
        readOnly 
        value={getJsonText()} 
        style={{ 
          width: '100%', 
          height: '100%', 
          fontFamily: "'Consolas', 'Monaco', monospace", 
          fontSize: '11px',
          background: '#1e1e1e', 
          color: '#9cdcfe', 
          border: 'none', 
          padding: '10px', 
          resize: 'none',
          outline: 'none',
          lineHeight: '1.4'
        }}
      />
    </div>
  );
}
