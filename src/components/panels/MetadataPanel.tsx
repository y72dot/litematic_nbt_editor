import { useTranslation } from 'react-i18next'
import type { LitematicMetadata } from '../../types';

interface MetadataPanelProps {
  metadata: LitematicMetadata | null;
  onChange: (field: keyof LitematicMetadata, value: string) => void;
}

export default function MetadataPanel({ metadata, onChange }: MetadataPanelProps) {
  const { t } = useTranslation()

  if (!metadata) {
    return (
      <div style={{padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
         {t('metadataPanel.noActiveSelection')}
      </div>
    );
  }

  return (
    <div className="panel-section-body" style={{ height: '100%', overflowY: 'auto' }}>
       <label className="studio-label">{t('metadataPanel.labelName')}</label>
       <input className="studio-input" value={metadata.name} onChange={(e) => onChange('name', e.target.value)} />

       <label className="studio-label">{t('metadataPanel.labelAuthor')}</label>
       <input className="studio-input" value={metadata.author} onChange={(e) => onChange('author', e.target.value)} />

       <label className="studio-label">{t('metadataPanel.labelDescription')}</label>
       <textarea className="studio-input" rows={3} value={metadata.description} onChange={(e) => onChange('description', e.target.value)} />

       <div style={{fontSize: '11px', color: '#888', marginTop: '10px'}}>
          <div>{t('metadataPanel.labelSize')} {typeof metadata.size === 'object' ? `${metadata.size.x} x ${metadata.size.y} x ${metadata.size.z}` : metadata.size}</div>
          <div>{t('metadataPanel.labelRegions')} {metadata.regions}</div>
          <div>{t('metadataPanel.labelCreated')} {metadata.timeCreated}</div>
          <div>{t('metadataPanel.labelModified')} {metadata.timeModified}</div>
       </div>
    </div>
  );
}
