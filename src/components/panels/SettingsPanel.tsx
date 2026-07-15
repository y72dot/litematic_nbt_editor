import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  return (
    <div className="panel-section-body" style={{ height: '100%', overflowY: 'auto' }}>
       <label className="studio-label">{t('settingsPanel.labelRenderer')}</label>
       <select
          className="studio-select"
          value={useDeepslate ? 'deepslate' : 'three'}
          onChange={(e) => setUseDeepslate(e.target.value === 'deepslate')}
       >
          <option value="deepslate">{t('settingsPanel.optionDeepslate')}</option>
          <option value="three">{t('settingsPanel.optionThreeJs')}</option>
       </select>

       <label className="studio-label" style={{marginTop: '10px'}}>{t('settingsPanel.labelUnpacking')}</label>
       <select
          className="studio-select"
          value={unpackingMethod}
          onChange={(e) => setUnpackingMethod(e.target.value as any)}
       >
          <option value="non-spanning">{t('settingsPanel.optionNonSpanning')}</option>
          <option value="spanning">{t('settingsPanel.optionSpanning')}</option>
       </select>

       <label className="studio-label" style={{marginTop: '10px'}}>{t('settingsPanel.labelTraversal')}</label>
       <select
          className="studio-select"
          value={traversalOrder}
          onChange={(e) => setTraversalOrder(e.target.value as any)}
       >
          <option value="YZX">{t('settingsPanel.optionYzx')}</option>
          <option value="XYZ">XYZ</option>
          <option value="YXZ">YXZ</option>
          <option value="XZY">XZY</option>
          <option value="ZXY">ZXY</option>
          <option value="ZYX">ZYX</option>
       </select>

       <div style={{marginTop: '20px', fontSize: '11px', color: '#666'}}>
         {t('settingsPanel.note')}
       </div>
    </div>
  );
}
