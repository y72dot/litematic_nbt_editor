import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './MenuBar.css';

interface MenuBarProps {
  onOpenFile: (e: any) => void;
  onSaveFile: (format?: 'litematic' | 'nbt') => void;
  onReset: () => void;
  onAbout: () => void;
  
  // Render Settings
  useDeepslate: boolean;
  setUseDeepslate: (val: boolean) => void;
  unpackingMethod: 'spanning' | 'non-spanning';
  setUnpackingMethod: (val: 'spanning' | 'non-spanning') => void;
  traversalOrder: string;
  setTraversalOrder: (val: any) => void;
  
  // Window Settings
  togglePanel: (component: string, name: string) => void;
  isPanelOpen: (component: string) => boolean;

  hasFile: boolean;
}

export default function MenuBar(props: MenuBarProps) {
  const { t } = useTranslation()
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleItemClick = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0) {
        // We need to pass the event to the parent handler, but the parent expects ChangeEvent
        // Since we can't easily construct a synthetic event that bubbles, 
        // we might need to change the parent interface or just call the handler directly.
        // Actually, we can just trigger the click on the hidden input in parent.
        // But here we are using a hidden input inside MenuBar? 
        // No, let's put the hidden input inside MenuBar for "Open..."
     }
  };

  return (
    <div className="menu-bar" ref={menuRef}>
      <input 
        type="file" 
        ref={fileInputRef}
        style={{display: 'none'}} 
        accept=".litematic,.nbt,.schematic" 
        onChange={props.onOpenFile as any} // Direct passing of the event handler
      />
      
      {/* File Menu */}
      <div className={`menu-item ${activeMenu === 'file' ? 'active' : ''}`} onClick={() => handleMenuClick('file')}>
        <span>{t('menu.file')}</span>
        {activeMenu === 'file' && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={() => { fileInputRef.current?.click(); setActiveMenu(null); }}>
              <span className="dropdown-icon">📂</span>
              <span>{t('menu.open')}</span>
              <span className="dropdown-shortcut">{t('menu.shortcutCtrlO')}</span>
            </div>

            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} onClick={() => props.hasFile && handleItemClick(() => props.onSaveFile())}>
              <span className="dropdown-icon">💾</span>
              <span>{t('menu.save')}</span>
              <span className="dropdown-shortcut">{t('menu.shortcutCtrlS')}</span>
            </div>

            <div className="dropdown-separator"></div>

            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} style={{position: 'relative'}}>
               <span className="dropdown-icon">📤</span>
               <span>{t('menu.exportAs')}</span>
               <span className="dropdown-arrow">▶</span>
            </div>
            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} style={{paddingLeft: '35px'}} onClick={() => props.hasFile && handleItemClick(() => props.onSaveFile('litematic'))}>
              <span>{t('menu.exportLitematic')}</span>
            </div>
            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} style={{paddingLeft: '35px'}} onClick={() => props.hasFile && handleItemClick(() => props.onSaveFile('nbt'))}>
              <span>{t('menu.exportNbt')}</span>
            </div>

            <div className="dropdown-separator"></div>
            <div className="dropdown-item" onClick={() => handleItemClick(props.onReset)}>
              <span className="dropdown-icon">🔄</span>
              <span>{t('menu.reset')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Render Menu */}
      <div className={`menu-item ${activeMenu === 'render' ? 'active' : ''}`} onClick={() => handleMenuClick('render')}>
        <span>{t('menu.render')}</span>
        {activeMenu === 'render' && (
          <div className="dropdown-menu">
            <div className="dropdown-header" style={{padding: '4px 15px', fontSize: '11px', color: '#888'}}>{t('menu.sectionEngine')}</div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUseDeepslate(true))}>
              <span className="dropdown-icon">{props.useDeepslate ? '✓' : ''}</span>
              <span>{t('menu.engineDeepslate')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUseDeepslate(false))}>
              <span className="dropdown-icon">{!props.useDeepslate ? '✓' : ''}</span>
              <span>{t('menu.engineThreeJs')}</span>
            </div>

            <div className="dropdown-separator"></div>
            <div className="dropdown-header" style={{padding: '4px 15px', fontSize: '11px', color: '#888'}}>{t('menu.sectionUnpacking')}</div>

            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUnpackingMethod('non-spanning'))}>
              <span className="dropdown-icon">{props.unpackingMethod === 'non-spanning' ? '✓' : ''}</span>
              <span>{t('menu.unpackingNonSpanning')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUnpackingMethod('spanning'))}>
              <span className="dropdown-icon">{props.unpackingMethod === 'spanning' ? '✓' : ''}</span>
              <span>{t('menu.unpackingSpanning')}</span>
            </div>

            <div className="dropdown-separator"></div>
            <div className="dropdown-header" style={{padding: '4px 15px', fontSize: '11px', color: '#888'}}>{t('menu.sectionOrder')}</div>

            {['YZX', 'XYZ', 'YXZ'].map(order => (
               <div key={order} className="dropdown-item" onClick={() => handleItemClick(() => props.setTraversalOrder(order))}>
                 <span className="dropdown-icon">{props.traversalOrder === order ? '✓' : ''}</span>
                 <span>{order}</span>
               </div>
            ))}
          </div>
        )}
      </div>

      {/* Window Menu */}
      <div className={`menu-item ${activeMenu === 'window' ? 'active' : ''}`} onClick={() => handleMenuClick('window')}>
        <span>{t('menu.window')}</span>
        {activeMenu === 'window' && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('tools', t('tabs.tools')))}>
              <span className="dropdown-icon">{props.isPanelOpen('tools') ? '✓' : ''}</span>
              <span>{t('menu.panelTools')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('selection', t('tabs.selection')))}>
              <span className="dropdown-icon">{props.isPanelOpen('selection') ? '✓' : ''}</span>
              <span>{t('menu.panelSelection')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('swatches', t('tabs.swatches')))}>
              <span className="dropdown-icon">{props.isPanelOpen('swatches') ? '✓' : ''}</span>
              <span>{t('menu.panelSwatches')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('history', t('tabs.history')))}>
              <span className="dropdown-icon">{props.isPanelOpen('history') ? '✓' : ''}</span>
              <span>{t('menu.panelHistory')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('metadata', t('tabs.metadata')))}>
              <span className="dropdown-icon">{props.isPanelOpen('metadata') ? '✓' : ''}</span>
              <span>{t('menu.panelMetadata')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('settings', t('tabs.settings')))}>
              <span className="dropdown-icon">{props.isPanelOpen('settings') ? '✓' : ''}</span>
              <span>{t('menu.panelSettings')}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('nbt', t('tabs.rawNbt')))}>
              <span className="dropdown-icon">{props.isPanelOpen('nbt') ? '✓' : ''}</span>
              <span>{t('menu.panelNbt')}</span>
            </div>

            <div className="dropdown-separator"></div>

            <div className="dropdown-item disabled">
              <span className="dropdown-icon">{props.isPanelOpen('viewer') ? '✓' : ''}</span>
              <span>{t('menu.panelViewerAlwaysOpen')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Help Menu */}
      <div className={`menu-item ${activeMenu === 'about' ? 'active' : ''}`} onClick={() => handleMenuClick('about')}>
        <span>{t('menu.help')}</span>
        {activeMenu === 'about' && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={() => handleItemClick(props.onAbout)}>
              <span className="dropdown-icon">ℹ️</span>
              <span>{t('menu.aboutItem')}</span>
            </div>
            <div className="dropdown-item" onClick={() => { window.open('https://github.com/misode/deepslate', '_blank'); setActiveMenu(null); }}>
              <span className="dropdown-icon">🔗</span>
              <span>{t('menu.deepslateGithub')}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
