interface NbtPanelProps {
  litematicObj: any | null;
}

export default function NbtPanel({ litematicObj }: NbtPanelProps) {
  if (!litematicObj) {
     return (
       <div style={{padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
          No file loaded
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
    <textarea 
      readOnly 
      value={getJsonText()} 
      style={{ width: '100%', height: '100%', fontFamily: 'monospace', background: '#222', color: '#afa', border: 'none', padding: '10px', resize: 'none' }}
    />
  );
}
