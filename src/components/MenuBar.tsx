import { useState, useRef, useEffect } from 'react';
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
        <span>File</span>
        {activeMenu === 'file' && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={() => { fileInputRef.current?.click(); setActiveMenu(null); }}>
              <span className="dropdown-icon">📂</span>
              <span>Open...</span>
              <span className="dropdown-shortcut">Ctrl+O</span>
            </div>
            
            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} onClick={() => props.hasFile && handleItemClick(() => props.onSaveFile())}>
              <span className="dropdown-icon">💾</span>
              <span>Save</span>
              <span className="dropdown-shortcut">Ctrl+S</span>
            </div>

            <div className="dropdown-separator"></div>

            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} style={{position: 'relative'}}>
               <span className="dropdown-icon">📤</span>
               <span>Export As...</span>
               <span className="dropdown-arrow">▶</span>
               
               {/* Submenu on hover (handled by CSS usually, but for click menu we might need logic) */}
               {/* Since this is a simple react implementation, let's just show nested items or make it expand */}
               {/* A simpler approach for this UI style is to just list the options directly with indentation or separator */}
            </div>
            {/* Expanded export options for simplicity in this specific UI implementation */}
            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} style={{paddingLeft: '35px'}} onClick={() => props.hasFile && handleItemClick(() => props.onSaveFile('litematic'))}>
              <span>.litematic</span>
            </div>
            <div className={`dropdown-item ${!props.hasFile ? 'disabled' : ''}`} style={{paddingLeft: '35px'}} onClick={() => props.hasFile && handleItemClick(() => props.onSaveFile('nbt'))}>
              <span>.nbt (Structure)</span>
            </div>

            <div className="dropdown-separator"></div>
            <div className="dropdown-item" onClick={() => handleItemClick(props.onReset)}>
              <span className="dropdown-icon">🔄</span>
              <span>Reset</span>
            </div>
          </div>
        )}
      </div>

      {/* Render Menu */}
      <div className={`menu-item ${activeMenu === 'render' ? 'active' : ''}`} onClick={() => handleMenuClick('render')}>
        <span>Render</span>
        {activeMenu === 'render' && (
          <div className="dropdown-menu">
            <div className="dropdown-header" style={{padding: '4px 15px', fontSize: '11px', color: '#888'}}>ENGINE</div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUseDeepslate(true))}>
              <span className="dropdown-icon">{props.useDeepslate ? '✓' : ''}</span>
              <span>Deepslate (High Quality)</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUseDeepslate(false))}>
              <span className="dropdown-icon">{!props.useDeepslate ? '✓' : ''}</span>
              <span>Three.js (Simple)</span>
            </div>
            
            <div className="dropdown-separator"></div>
            <div className="dropdown-header" style={{padding: '4px 15px', fontSize: '11px', color: '#888'}}>UNPACKING</div>
            
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUnpackingMethod('non-spanning'))}>
              <span className="dropdown-icon">{props.unpackingMethod === 'non-spanning' ? '✓' : ''}</span>
              <span>1.16+ (Non-Spanning)</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.setUnpackingMethod('spanning'))}>
              <span className="dropdown-icon">{props.unpackingMethod === 'spanning' ? '✓' : ''}</span>
              <span>1.13-1.15 (Spanning)</span>
            </div>

            <div className="dropdown-separator"></div>
            <div className="dropdown-header" style={{padding: '4px 15px', fontSize: '11px', color: '#888'}}>ORDER</div>
             
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
        <span>Window</span>
        {activeMenu === 'window' && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('metadata', 'Metadata'))}>
              <span className="dropdown-icon">{props.isPanelOpen('metadata') ? '✓' : ''}</span>
              <span>Metadata</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('palette', 'Palette'))}>
              <span className="dropdown-icon">{props.isPanelOpen('palette') ? '✓' : ''}</span>
              <span>Palette Editor</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('settings', 'Settings'))}>
              <span className="dropdown-icon">{props.isPanelOpen('settings') ? '✓' : ''}</span>
              <span>Advanced Settings</span>
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(() => props.togglePanel('nbt', 'Raw NBT'))}>
              <span className="dropdown-icon">{props.isPanelOpen('nbt') ? '✓' : ''}</span>
              <span>Raw NBT Data</span>
            </div>
            
            <div className="dropdown-separator"></div>
            
            <div className="dropdown-item disabled">
              <span className="dropdown-icon">{props.isPanelOpen('viewer') ? '✓' : ''}</span>
              <span>3D Viewer (Always Open)</span>
            </div>
          </div>
        )}
      </div>

      {/* About Menu */}
      <div className={`menu-item ${activeMenu === 'about' ? 'active' : ''}`} onClick={() => handleMenuClick('about')}>
        <span>Help</span>
        {activeMenu === 'about' && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={() => handleItemClick(props.onAbout)}>
              <span className="dropdown-icon">ℹ️</span>
              <span>About</span>
            </div>
            <div className="dropdown-item" onClick={() => { window.open('https://github.com/misode/deepslate', '_blank'); setActiveMenu(null); }}>
              <span className="dropdown-icon">🔗</span>
              <span>Deepslate GitHub</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
