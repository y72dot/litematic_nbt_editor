import type { LitematicMetadata } from '../../types';

interface MetadataPanelProps {
  metadata: LitematicMetadata | null;
  onChange: (field: keyof LitematicMetadata, value: string) => void;
}

export default function MetadataPanel({ metadata, onChange }: MetadataPanelProps) {
  if (!metadata) {
    return (
      <div style={{padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
         No active selection
      </div>
    );
  }

  return (
    <div className="panel-section-body" style={{ height: '100%', overflowY: 'auto' }}>
       <label className="studio-label">Name</label>
       <input className="studio-input" value={metadata.name} onChange={(e) => onChange('name', e.target.value)} />
       
       <label className="studio-label">Author</label>
       <input className="studio-input" value={metadata.author} onChange={(e) => onChange('author', e.target.value)} />
       
       <label className="studio-label">Description</label>
       <textarea className="studio-input" rows={3} value={metadata.description} onChange={(e) => onChange('description', e.target.value)} />
       
       <div style={{fontSize: '11px', color: '#888', marginTop: '10px'}}>
          <div>Size: {typeof metadata.size === 'object' ? `${metadata.size.x} x ${metadata.size.y} x ${metadata.size.z}` : metadata.size}</div>
          <div>Regions: {metadata.regions}</div>
          <div>Created: {metadata.timeCreated}</div>
          <div>Modified: {metadata.timeModified}</div>
       </div>
    </div>
  );
}
