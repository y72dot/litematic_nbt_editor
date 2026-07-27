import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import * as nbt from 'prismarine-nbt'
import pako from 'pako'
import './App.css'
import './components/panels/Panel.css'
import 'flexlayout-react/style/dark.css' // Import FlexLayout dark theme
import { Buffer } from 'buffer'
import { Layout, Model, Actions, DockLocation } from 'flexlayout-react'
import type { TabNode, IJsonModel } from 'flexlayout-react'
import i18n from './i18n'

import { getBlockColor } from './LitematicViewer'
import MenuBar from './components/MenuBar'
import StatusBar from './components/StatusBar'
import { Litematic } from './core/Litematic'
import { Structure } from './core/Structure'
import type { Schematic } from './core/Schematic'
import type { TraversalOrder } from './core/BlockStorage'
import { detectSchematicFormat } from './utils/formatDetector'
import { EditHistory } from './core/commands/EditHistory'
import { SetBlockCommand } from './core/commands/SetBlockCommand'
import { BatchSetBlockCommand } from './core/commands/BatchSetBlockCommand'
import { FillCommand } from './core/commands/FillCommand'
import type { LitematicMetadata, InteractionMode, SelectionMode, SelectionModifier, EditMode, BoxSelectionState } from './types'

// Panel Components
import ViewerPanel from './components/panels/ViewerPanel'
import MetadataPanel from './components/panels/MetadataPanel'
import SwatchesPanel from './components/panels/SwatchesPanel'
import SettingsPanel from './components/panels/SettingsPanel'
import NbtPanel from './components/panels/NbtPanel'
import ToolPanel from './components/panels/ToolPanel'
import SelectionPanel from './components/panels/SelectionPanel'
import HistoryPanel from './components/panels/HistoryPanel'

// Explicitly ensure Buffer is on window if not already there
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

// --- Default Layout Configuration ---
function buildDefaultLayout(t: (key: string) => string): IJsonModel {
  return {
    global: {
      tabEnableClose: true,
      tabEnableRename: false,
      tabSetEnableMaximize: true,
    },
    borders: [],
    layout: {
      type: 'row',
      id: 'root',
      weight: 100,
      children: [
        {
          type: 'tabset',
          weight: 70,
          selected: 0,
          children: [
            {
              type: 'tab',
              name: t('tabs.viewer3d'),
              component: 'viewer',
              enableClose: false,
            }
          ]
        },
        {
          type: 'column',
          weight: 30,
          children: [
            {
              type: 'tabset',
              weight: 38,
              children: [
                {
                  type: 'tab',
                  name: t('tabs.tools'),
                  component: 'tools'
                },
                {
                  type: 'tab',
                  name: t('tabs.selection'),
                  component: 'selection'
                }
              ]
            },
            {
              type: 'tabset',
              weight: 32,
              children: [
                {
                  type: 'tab',
                  name: t('tabs.swatches'),
                  component: 'swatches'
                },
                {
                  type: 'tab',
                  name: t('tabs.history'),
                  component: 'history'
                }
              ]
            },
            {
              type: 'tabset',
              weight: 30,
              children: [
                {
                  type: 'tab',
                  name: t('tabs.metadata'),
                  component: 'metadata'
                },
                {
                  type: 'tab',
                  name: t('tabs.settings'),
                  component: 'settings'
                },
                {
                  type: 'tab',
                  name: t('tabs.rawNbt'),
                  component: 'nbt'
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

/**
 * Count how many unpacked block indices fall outside the palette range.
 * Samples from the middle of the data so that the first long (which is
 * always bit-aligned for both spanning and non-spanning) doesn't skew
 * the result for small structures.
 */
function countPaletteViolations(schematic: Schematic): number {
  let violations = 0;
  for (const region of schematic.regions) {
    const blocks = region.storage.toArray();
    const maxIndex = region.fullPalette.length - 1;
    const total = blocks.length;
    // Start at 25 % into the data to skip the first long boundary region
    // where spanning and non-spanning are always aligned.
    const sampleStart = Math.floor(total * 0.25);
    const sampleEnd = Math.min(total, sampleStart + 1000);
    for (let i = sampleStart; i < sampleEnd; i++) {
      if (blocks[i] > maxIndex) violations++;
    }
  }
  return violations;
}

const EMPTY_BOX_SELECTION: BoxSelectionState = {
  active: false, startX: 0, startY: 0, startZ: 0, endX: 0, endY: 0, endZ: 0,
};

function App() {
  const { t } = useTranslation()
  const [model] = useState(() => Model.fromJson(buildDefaultLayout(t)));

  // App State
  const [metadata, setMetadata] = useState<LitematicMetadata | null>(null)
  const [litematicObj, setLitematicObj] = useState<Schematic | null>(null);
  const [fileName, setFileName] = useState<string>('edited.litematic')

  // Edit history for undo/redo
  const editHistoryRef = useRef(new EditHistory());
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [redoLabel, setRedoLabel] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const syncHistoryState = useCallback(() => {
    const h = editHistoryRef.current;
    setUndoLabel(h.undoLabel);
    setRedoLabel(h.redoLabel);
    setHistoryVersion(v => v + 1);
  }, []);

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Settings State
  const [unpackingMethod, setUnpackingMethod] = useState<'spanning' | 'non-spanning'>('non-spanning');
  const [traversalOrder, setTraversalOrder] = useState<TraversalOrder>('YZX');
  const [useDeepslate, setUseDeepslate] = useState(true);

  // Interaction State
  const [highlightedBlock, setHighlightedBlock] = useState<{ x: number, y: number, z: number, name: string } | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('selection');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('point');
  const [selectionModifier, setSelectionModifier] = useState<SelectionModifier>('replace');
  const [editMode, setEditMode] = useState<EditMode>('place');
  const [boxSelection, setBoxSelection] = useState<BoxSelectionState>(EMPTY_BOX_SELECTION);
  const [activeBlockType, setActiveBlockType] = useState('minecraft:stone');
  const [structureVersion, setStructureVersion] = useState(0);

  // Edge mouse gesture warning
  const isEdge = /Edg\//.test(navigator.userAgent);
  const [edgeWarningDismissed, setEdgeWarningDismissed] = useState(false);

  // ── Selection helpers ────────────────────────────────────────

  const isInSelection = useCallback((x: number, y: number, z: number): boolean => {
    if (selectedBlocks.size === 0) return true; // no selection = everything editable
    return selectedBlocks.has(`${x},${y},${z}`);
  }, [selectedBlocks]);

  const addToSelection = (keys: string[]) => {
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  };

  const removeFromSelection = (keys: string[]) => {
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  };

  // ── Selection click handler ──────────────────────────────────

  const handleSelectionClick = (x: number, y: number, z: number, additive: boolean, subtractive: boolean) => {
    const key = `${x},${y},${z}`;

    if (selectionMode === 'point') {
      if (subtractive) {
        removeFromSelection([key]);
      } else if (additive) {
        addToSelection([key]);
      } else {
        setSelectedBlocks(new Set([key]));
      }
    } else if (selectionMode === 'similar') {
      // Collect all blocks of the same type across all regions
      if (!litematicObj) return;
      const targetBlock = litematicObj.getBlock(x, y, z);
      if (!targetBlock) return;
      const targetName = targetBlock.Name;
      const keys: string[] = [];
      for (const region of litematicObj.regions) {
        for (let dy = 0; dy < region.size.y; dy++) {
          for (let dz = 0; dz < region.size.z; dz++) {
            for (let dx = 0; dx < region.size.x; dx++) {
              const gx = dx + region.position.x;
              const gy = dy + region.position.y;
              const gz = dz + region.position.z;
              const block = litematicObj.getBlock(gx, gy, gz);
              if (block && block.Name === targetName) {
                keys.push(`${gx},${gy},${gz}`);
              }
            }
          }
        }
      }
      if (subtractive) {
        removeFromSelection(keys);
      } else if (additive) {
        addToSelection(keys);
      } else {
        setSelectedBlocks(new Set(keys));
      }
    }
    // selectionModifier state is used for UI display; Ctrl/Alt keys take precedence at interaction time
  };

  // ── Box selection handlers ───────────────────────────────────

  const handleBoxSelectStart = (x: number, y: number, z: number) => {
    setBoxSelection({ active: true, startX: x, startY: y, startZ: z, endX: x, endY: y, endZ: z });
  };

  const handleBoxSelectUpdate = (x: number, y: number, z: number) => {
    setBoxSelection(prev => ({ ...prev, endX: x, endY: y, endZ: z }));
  };

  const handleBoxSelectEnd = () => {
    setBoxSelection(prev => {
      if (!prev.active) return prev;
      // Compute bounding box
      const minX = Math.min(prev.startX, prev.endX);
      const minY = Math.min(prev.startY, prev.endY);
      const minZ = Math.min(prev.startZ, prev.endZ);
      const maxX = Math.max(prev.startX, prev.endX);
      const maxY = Math.max(prev.startY, prev.endY);
      const maxZ = Math.max(prev.startZ, prev.endZ);

      // Collect all non-air blocks in the bounding box
      if (litematicObj) {
        const keys: string[] = [];
        for (let gy = minY; gy <= maxY; gy++) {
          for (let gz = minZ; gz <= maxZ; gz++) {
            for (let gx = minX; gx <= maxX; gx++) {
              const block = litematicObj.getBlock(gx, gy, gz);
              if (block && block.Name !== 'minecraft:air') {
                keys.push(`${gx},${gy},${gz}`);
              }
            }
          }
        }
        if (keys.length > 0) {
          if (selectionModifier === 'add') {
            addToSelection(keys);
          } else if (selectionModifier === 'subtract') {
            removeFromSelection(keys);
          } else {
            setSelectedBlocks(new Set(keys));
          }
        }
      }

      return { ...EMPTY_BOX_SELECTION };
    });
  };

  // ── Advanced selection operations ────────────────────────────

  const handleSelectSimilar = () => {
    if (!litematicObj || selectedBlocks.size === 0) return;
    // For each selected block, find its type; then select ALL blocks of those types
    const targetNames = new Set<string>();
    for (const key of selectedBlocks) {
      const [x, y, z] = key.split(',').map(Number);
      const block = litematicObj.getBlock(x, y, z);
      if (block) targetNames.add(block.Name);
    }
    const newKeys: string[] = [];
    for (const region of litematicObj.regions) {
      for (let dy = 0; dy < region.size.y; dy++) {
        for (let dz = 0; dz < region.size.z; dz++) {
          for (let dx = 0; dx < region.size.x; dx++) {
            const gx = dx + region.position.x;
            const gy = dy + region.position.y;
            const gz = dz + region.position.z;
            const k = `${gx},${gy},${gz}`;
            if (selectedBlocks.has(k)) continue; // already selected
            const block = litematicObj.getBlock(gx, gy, gz);
            if (block && targetNames.has(block.Name)) {
              newKeys.push(k);
            }
          }
        }
      }
    }
    addToSelection(newKeys);
  };

  const handleInvertSelection = () => {
    if (!litematicObj) return;
    const newKeys = new Set<string>();
    for (const region of litematicObj.regions) {
      for (let dy = 0; dy < region.size.y; dy++) {
        for (let dz = 0; dz < region.size.z; dz++) {
          for (let dx = 0; dx < region.size.x; dx++) {
            const gx = dx + region.position.x;
            const gy = dy + region.position.y;
            const gz = dz + region.position.z;
            const block = litematicObj.getBlock(gx, gy, gz);
            if (block && block.Name !== 'minecraft:air') {
              const k = `${gx},${gy},${gz}`;
              if (!selectedBlocks.has(k)) {
                newKeys.add(k);
              }
            }
          }
        }
      }
    }
    setSelectedBlocks(newKeys);
  };

  // ── Compute bounding box of selection ────────────────────────

  const getSelectionBoundingBox = useCallback((): { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null => {
    if (selectedBlocks.size === 0) return null;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const key of selectedBlocks) {
      const [x, y, z] = key.split(',').map(Number);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }, [selectedBlocks]);

  // ── Edit handlers ────────────────────────────────────────────

  const handleEditClick = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    if (!litematicObj) return;
    if (!isInSelection(x, y, z)) return; // selection constraint

    switch (editMode) {
      case 'place': {
        // Face placement: place on the face exterior (air only)
        const px = x + nx;
        const py = y + ny;
        const pz = z + nz;
        const target = litematicObj.getBlock(px, py, pz);
        if (target && target.Name !== 'minecraft:air') return;
        handleSetBlock(px, py, pz, activeBlockType);
        break;
      }
      case 'replace':
        handleSetBlock(x, y, z, activeBlockType);
        break;
      case 'erase':
        handleSetBlock(x, y, z, 'minecraft:air');
        break;
      case 'fill':
        handleFill(x, y, z);
        break;
      case 'pick':
        handlePickBlock(x, y, z);
        break;
    }
  };

  // Set block at global coordinates (via EditHistory for undo support)
  const handleSetBlock = (x: number, y: number, z: number, blockName?: string) => {
    if (!litematicObj) return;
    const name = blockName ?? activeBlockType;
    const command = new SetBlockCommand(litematicObj, x, y, z, name);
    editHistoryRef.current.execute(command);
    syncHistoryState();
    forceUpdate();
  };

  // Flood-fill from position (with selection constraint)
  const handleFill = (x: number, y: number, z: number) => {
    if (!litematicObj) return;
    try {
      const command = new FillCommand(
        litematicObj, x, y, z, activeBlockType,
        undefined,
        selectedBlocks.size > 0 ? selectedBlocks : undefined,
      );
      editHistoryRef.current.execute(command);
      syncHistoryState();
      setStructureVersion(v => v + 1);
      forceUpdate();
    } catch (err: any) {
      console.error('Fill failed:', err.message);
    }
  };

  // Pick block type from scene
  const handlePickBlock = (x: number, y: number, z: number) => {
    if (!litematicObj) return;
    const block = litematicObj.getBlock(x, y, z);
    if (block) {
      setActiveBlockType(block.Name);
    }
  };

  // Batch replace all selected blocks with target block type
  const handleReplaceBlocks = (blockName: string) => {
    if (!litematicObj || selectedBlocks.size === 0) return;
    const positions = Array.from(selectedBlocks).map(key => {
      const [x, y, z] = key.split(',').map(Number);
      return { x, y, z };
    });
    const command = new BatchSetBlockCommand(litematicObj, positions, blockName);
    editHistoryRef.current.execute(command);
    syncHistoryState();
    setSelectedBlocks(new Set());
    setStructureVersion(v => v + 1);
    forceUpdate();
  };

  // Select all non-air blocks in all regions
  const handleSelectAll = () => {
    if (!litematicObj) return;
    const keys = new Set<string>();
    for (const region of litematicObj.regions) {
      for (let y = 0; y < region.size.y; y++) {
        for (let z = 0; z < region.size.z; z++) {
          for (let x = 0; x < region.size.x; x++) {
            const gx = x + region.position.x;
            const gy = y + region.position.y;
            const gz = z + region.position.z;
            const block = litematicObj.getBlock(gx, gy, gz);
            if (block && block.Name !== 'minecraft:air') {
              keys.add(`${gx},${gy},${gz}`);
            }
          }
        }
      }
    }
    setSelectedBlocks(keys);
  };

  const handleDeselectAll = () => {
    setSelectedBlocks(new Set());
  };

  // File Handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setMetadata(null)
    setLitematicObj(null)
    setFileName(file.name)
    setLoading(true)
    setSelectedBlocks(new Set())
    editHistoryRef.current.clear()
    syncHistoryState()

    try {
      const arrayBuffer = await file.arrayBuffer()

      let buffer: Buffer;
      try {
        const unzipped = pako.ungzip(new Uint8Array(arrayBuffer))
        buffer = Buffer.from(unzipped)
      } catch (e) {
        console.warn('Gzip decompression failed, trying raw buffer', e)
        buffer = Buffer.from(arrayBuffer)
      }

      const { parsed } = await nbt.parse(buffer)
      console.log('Parsed NBT:', parsed)

      // Determine format
      const formatResult = detectSchematicFormat(parsed, file.name);

      let schematic: Schematic;
      let unpacking: 'spanning' | 'non-spanning' = formatResult.preferredFormat ?? 'non-spanning';

      if (formatResult.format === 'litematic') {
        schematic = new Litematic(parsed);
        unpacking = formatResult.preferredFormat ?? 'non-spanning';

        // Compare both unpacking methods on a sample slice.
        // If the alternative produces fewer palette violations, use it.
        const defaultViolations = countPaletteViolations(schematic);
        if (defaultViolations > 0) {
          const altMethod: 'spanning' | 'non-spanning' =
            unpacking === 'spanning' ? 'non-spanning' : 'spanning';
          const altSchematic = new Litematic(parsed, altMethod);
          const altViolations = countPaletteViolations(altSchematic);

          if (altViolations < defaultViolations) {
            console.warn(
              `Auto-corrected unpacking: "${unpacking}" had ${defaultViolations} ` +
              `out-of-range indices, switching to "${altMethod}" (${altViolations}).`
            );
            schematic = altSchematic;
            unpacking = altMethod;
          }
        }
      } else {
        schematic = new Structure(parsed);
      }

      setLitematicObj(schematic);
      setUnpackingMethod(unpacking);

      setMetadata(schematic.metadata);


    } catch (err: any) {
      console.error(err)
      setError(t('app.errorParseFile', { message: err.message }))
    } finally {
      setLoading(false)
    }
  }

  const handleMetadataChange = (field: keyof LitematicMetadata, value: string) => {
    if (!metadata) return
    setMetadata({ ...metadata, [field]: value })
  }

  const handlePaletteUpdate = () => {
    // Force re-render as the schematic object has been mutated in place
    forceUpdate();
  };

  const handleSave = (format?: 'litematic' | 'nbt') => {
    if (!litematicObj || !metadata) return

    try {
      // Update object metadata with current UI state
      litematicObj.metadata = { ...litematicObj.metadata, ...metadata };

      // Determine format to save
      // If format is not specified, use the current object's natural format
      // Litematic -> .litematic
      // Structure -> .nbt
      // But if we want to "Export As...", we might need conversion.

      // Since our Schematic interface doesn't strictly support cross-conversion yet in a single method call,
      // we might need to handle it here or enhance the classes.

      // For now, let's assume we save in the format of the current object
      // UNLESS a specific format is requested that differs.

      let nbtData: any;
      let targetFileName = fileName;

      if (format === 'nbt' && litematicObj instanceof Litematic) {
          // Convert Litematic -> Structure NBT
          // This requires creating a new Structure instance from Litematic regions
          // But Structure constructor expects NBT.
          // We should add a static method or utility to create Structure from Regions.
          // For now, let's keep it simple: We need a way to convert.

          // Let's implement a simple on-the-fly conversion here or inside Structure class
          // ideally: const structure = Structure.fromSchematic(litematicObj);
          // nbtData = structure.toNbt();

          // Since we haven't implemented that yet, let's just warn and save as original for now,
          // but we will implement it in next steps.
          console.warn("Litematic -> Structure conversion triggered");
          // Placeholder:
          nbtData = litematicObj.toNbt();
          if (!targetFileName.endsWith('.litematic')) targetFileName += '.litematic';
      } else if (format === 'litematic' && litematicObj instanceof Structure) {
          // Convert Structure -> Litematic NBT
          console.warn("Structure -> Litematic conversion triggered");
          // Placeholder:
          nbtData = litematicObj.toNbt();
          if (!targetFileName.endsWith('.nbt')) targetFileName += '.nbt';
      } else {
          // No conversion needed
          nbtData = litematicObj.toNbt();

          // Fix extension if needed
          if (format === 'litematic' && !targetFileName.endsWith('.litematic')) {
              targetFileName = targetFileName.replace(/\.\w+$/, '') + '.litematic';
          } else if (format === 'nbt' && !targetFileName.endsWith('.nbt')) {
              targetFileName = targetFileName.replace(/\.\w+$/, '') + '.nbt';
          }
      }

      const newBuffer = nbt.writeUncompressed(nbtData)
      const compressed = pako.gzip(new Uint8Array(newBuffer))

      const blob = new Blob([compressed], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = targetFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (err: any) {
      console.error('Save failed:', err)
      setError(t('app.errorSaveFile', { message: err.message }))
    }
  }

  // Force update wrapper to re-render App when layout changes
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  // E2E test harness — exposes internal state for deterministic testing
  if (typeof window !== 'undefined') {
    (window as any).__e2e = {
      setBlock: handleSetBlock,
      replaceBlocks: handleReplaceBlocks,
      getBlock: (x: number, y: number, z: number) => litematicObj?.getBlock(x, y, z) ?? null,
      getSelectedBlocks: () => [...selectedBlocks],
      setSelectedBlocks: (keys: string[]) => setSelectedBlocks(new Set(keys)),
      getMetadata: () => metadata,
      getLitematicObj: () => litematicObj,
      getEditHistory: () => editHistoryRef.current,
      getUndoLabel: () => editHistoryRef.current.undoLabel,
      getRedoLabel: () => editHistoryRef.current.redoLabel,
      getInteractionMode: () => interactionMode,
      setInteractionMode: (mode: InteractionMode) => setInteractionMode(mode),
      getSelectionMode: () => selectionMode,
      setSelectionMode: (mode: SelectionMode) => setSelectionMode(mode),
      getEditMode: () => editMode,
      setEditMode: (mode: EditMode) => setEditMode(mode),
      getActiveBlockType: () => activeBlockType,
      setActiveBlockType: (block: string) => setActiveBlockType(block),
      fill: handleFill,
      pickBlock: handlePickBlock,
      selectAll: handleSelectAll,
      deselectAll: handleDeselectAll,
      selectSimilar: handleSelectSimilar,
      invertSelection: handleInvertSelection,
      forceUpdate,
    };
  }

  // Memoize selection bounding box for SelectionPanel
  const selectionBBox = getSelectionBoundingBox();

  // --- Layout Factory ---
  const factory = (node: TabNode) => {
    const component = node.getComponent();

    switch (component) {
      case 'viewer':
        return (
          <ViewerPanel
            litematicObj={litematicObj}
            loading={loading}
            error={error}
            onFileUpload={handleFileUpload}
            useDeepslate={useDeepslate}
            unpackingMethod={unpackingMethod}
            traversalOrder={traversalOrder}
            onHoverBlock={setHighlightedBlock}
            selectedBlocks={selectedBlocks}
            interactionMode={interactionMode}
            selectionMode={selectionMode}
            editMode={editMode}
            boxSelectionState={boxSelection}
            onSelectionClick={handleSelectionClick}
            onBoxSelectStart={handleBoxSelectStart}
            onBoxSelectUpdate={handleBoxSelectUpdate}
            onBoxSelectEnd={handleBoxSelectEnd}
            onEditClick={handleEditClick}
            activeBlockType={activeBlockType}
            structureVersion={structureVersion}
          />
        );
      case 'metadata':
        return <MetadataPanel metadata={metadata} onChange={handleMetadataChange} />;
      case 'palette':
      case 'swatches':
        return (
          <SwatchesPanel
            litematicObj={litematicObj}
            onUpdate={handlePaletteUpdate}
            getBlockColor={getBlockColor}
            selectedBlocks={selectedBlocks}
            activeBlockType={activeBlockType}
            onActiveBlockChange={setActiveBlockType}
          />
        );
      case 'tools':
        return (
          <ToolPanel
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            editMode={editMode}
            onEditModeChange={setEditMode}
            activeBlockType={activeBlockType}
            onBlockTypeChange={setActiveBlockType}
            litematicObj={litematicObj}
            getBlockColor={getBlockColor}
          />
        );
      case 'selection':
        return (
          <SelectionPanel
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            selectionModifier={selectionModifier}
            onSelectionModifierChange={setSelectionModifier}
            selectionCount={selectedBlocks.size}
            boundingBox={selectionBBox}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onSelectSimilar={handleSelectSimilar}
            onInvertSelection={handleInvertSelection}
          />
        );
      case 'history':
        return (
          <HistoryPanel
            editHistoryRef={editHistoryRef}
            undoLabel={undoLabel}
            redoLabel={redoLabel}
            onHistoryChange={() => {
              syncHistoryState();
              setStructureVersion(v => v + 1);
              forceUpdate();
            }}
            historyVersion={historyVersion}
            onUndo={() => {
              const label = editHistoryRef.current.undo();
              if (label) { syncHistoryState(); setStructureVersion(v => v + 1); forceUpdate(); }
            }}
            onRedo={() => {
              const label = editHistoryRef.current.redo();
              if (label) { syncHistoryState(); setStructureVersion(v => v + 1); forceUpdate(); }
            }}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            unpackingMethod={unpackingMethod}
            setUnpackingMethod={setUnpackingMethod}
            traversalOrder={traversalOrder}
            setTraversalOrder={setTraversalOrder}
            useDeepslate={useDeepslate}
            setUseDeepslate={setUseDeepslate}
          />
        );
      case 'nbt':
        return <NbtPanel litematicObj={litematicObj} />;
      default:
        return <div>Unknown Component</div>;
    }
  }

  // --- Menu Handlers ---
  const togglePanel = (component: string, name: string) => {
    // Attempt to find existing node
    let existingNode: TabNode | null = null;
    model.visitNodes((node) => {
      if (node.getType() === 'tab' && node.getComponent() === component) {
        existingNode = node as TabNode;
      }
    });

    if (existingNode) {
      // If it exists, close it (toggle behavior)
      model.doAction(Actions.deleteTab((existingNode as TabNode).getId()));
    } else {
      // If not, add it

      // Smart Positioning: Try to add to an existing sidebar TabSet if possible
      let targetNodeId = 'root';
      let location = DockLocation.RIGHT;

      let bestTabSetId: string | null = null;
      model.visitNodes((node) => {
          if (node.getType() === 'tabset') {
              // Check if this tabset contains any of our sidebar panels
              const children = node.getChildren();
              for (const child of children) {
                  // FlexLayout types might need casting if getChildren returns generic nodes
                  const comp = (child as TabNode).getComponent();
                  if (['metadata', 'palette', 'swatches', 'tools', 'selection', 'history', 'settings', 'nbt'].includes(comp as string)) {
                      bestTabSetId = node.getId();
                      break;
                  }
              }
          }
      });

      if (bestTabSetId) {
          targetNodeId = bestTabSetId;
          location = DockLocation.CENTER; // Add as a new tab in this set
      }

      model.doAction(Actions.addNode({
          type: 'tab',
          component: component,
          name: name,
          enableClose: true,
      }, targetNodeId, location, -1));
    }
  };

  // ── Keyboard shortcuts (Ctrl+Z / Ctrl+Y) ─────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+Z = Redo
          const label = editHistoryRef.current.redo();
          if (label) {
            syncHistoryState();
            setStructureVersion(v => v + 1);
            forceUpdate();
          }
        } else {
          // Ctrl+Z = Undo
          const label = editHistoryRef.current.undo();
          if (label) {
            syncHistoryState();
            setStructureVersion(v => v + 1);
            forceUpdate();
          }
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        // Ctrl+Y = Redo
        const label = editHistoryRef.current.redo();
        if (label) {
          syncHistoryState();
          setStructureVersion(v => v + 1);
          forceUpdate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [syncHistoryState]);

  const isPanelOpen = (component: string) => {
     let isOpen = false;
     model.visitNodes((node) => {
       // Check if node exists in the tree and is a tab with matching component
       // We do NOT check isVisible() because that only returns true for the actively selected tab
       // We want to show the checkmark if the tab exists anywhere in the layout (even if in background)
       if (node.getType() === 'tab' && node.getComponent() === component) {
         isOpen = true;
       }
     });
     return isOpen;
  };

  return (
    <div className="studio-container">
      {/* 1. Top Bar */}
      <div className="top-bar" style={{padding: 0}}>
        <div style={{padding: '0 15px', display: 'flex', alignItems: 'center', borderRight: '1px solid #111', height: '100%'}}>
           <span className="top-bar-title" style={{margin: 0}}>{t('app.title')}</span>
        </div>

        <MenuBar
           onOpenFile={handleFileUpload}
           onSaveFile={handleSave}
           onReset={() => { setLitematicObj(null); setMetadata(null); setFileName('edited.litematic'); }}
           onAbout={() => alert(t('app.about'))}

           useDeepslate={useDeepslate}
           setUseDeepslate={setUseDeepslate}
           unpackingMethod={unpackingMethod}
           setUnpackingMethod={setUnpackingMethod}
           traversalOrder={traversalOrder}
           setTraversalOrder={setTraversalOrder}

           togglePanel={togglePanel}
           isPanelOpen={isPanelOpen}

           hasFile={!!litematicObj}
        />

        {loading && <span style={{marginLeft: 'auto', marginRight: '15px', fontSize: '12px', color: '#aaa'}}>{t('common.processing')}</span>}
        {!loading && fileName && <span style={{marginLeft: 'auto', marginRight: '15px', fontSize: '12px', color: '#888'}}>{fileName}</span>}
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          style={{ background: '#1f1f1f', color: '#ccc', border: '1px solid #444',
                   borderRadius: '3px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer', marginRight: '10px' }}
        >
          <option value="en">EN</option>
          <option value="zh-CN">中文</option>
        </select>
      </div>

      {/* 1.5 Edge Mouse Gesture Warning */}
      {isEdge && !edgeWarningDismissed && (
        <div className="edge-warning-banner">
          <span>
            <Trans
              i18nKey="app.edgeWarning"
              values={{ url: 'edge://settings/appearance/browserBehavior/mouseGestures' }}
              components={{ strong: <strong />, code: <code /> }}
            />
          </span>
          <button onClick={() => setEdgeWarningDismissed(true)}>{t('app.edgeDismiss')}</button>
        </div>
      )}

      {/* 2. Main Workspace (FlexLayout) */}
      <div className="workspace" style={{position: 'relative'}}>
         <Layout
            model={model}
            factory={factory}
            onModelChange={() => forceUpdate()} // Sync layout state with React state
         />
      </div>

      {/* 3. Status Bar */}
      <div style={{ flex: '0 0 24px', zIndex: 100 }}>
        <StatusBar
           loading={loading}
           error={error}
           statusMessage={litematicObj ? t('app.statusReady') : t('app.statusWaiting')}

           hasFile={!!litematicObj}
           regions={metadata?.regions || 0}
           size={metadata?.size || null}

           useDeepslate={useDeepslate}
           unpackingMethod={unpackingMethod}
           traversalOrder={traversalOrder}

           highlightedBlock={highlightedBlock}
           undoLabel={undoLabel}
           redoLabel={redoLabel}
        />
      </div>

      {/* 4. ICP Footer */}
      <div style={{ flex: '0 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', borderTop: '1px solid #444', fontSize: '11px', gap: '8px' }}>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" style={{ color: '#888', textDecoration: 'none' }}>浙ICP备2026056758号-1</a>
        <img src="https://www.beian.gov.cn/img/ghs.png" style={{ width: '12px', verticalAlign: 'text-bottom' }} />
        <a href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=33011002020155" target="_blank" rel="noopener" style={{ color: '#888', textDecoration: 'none' }}>浙公网安备33011002020155号</a>
      </div>

    </div>
  )
}

export default App
