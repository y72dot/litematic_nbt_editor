import PaletteEditor from '../../PaletteEditor';

interface PalettePanelProps {
  nbtData: any;
  onUpdate: (newNbt: any) => void;
  getBlockColor: (id: string) => string;
}

export default function PalettePanel({ nbtData, onUpdate, getBlockColor }: PalettePanelProps) {
  if (!nbtData) {
     return (
       <div style={{padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
          No file loaded
       </div>
     );
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
       <PaletteEditor 
         nbtData={nbtData} 
         onUpdate={onUpdate} 
         getBlockColor={getBlockColor} 
       />
    </div>
  );
}
