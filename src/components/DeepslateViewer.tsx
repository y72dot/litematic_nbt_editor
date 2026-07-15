import { useEffect, useRef, useState } from 'react';
import type { Schematic } from '../core/Schematic';
import { SchematicStructureProvider } from '../core/SchematicStructureProvider';
import { BlockDefinition, BlockModel, StructureRenderer, TextureAtlas, type Resources, type ItemRendererResources, Identifier } from 'deepslate';
import { mat4, vec3 } from 'gl-matrix';
import { LineRenderer } from '../utils/LineRenderer';
import { FilledBoxRenderer } from '../utils/FilledBoxRenderer';
import { useBlockRaycast } from '../hooks/useBlockRaycast';
import type { InteractionMode, SelectionMode, BoxSelectionState } from '../types';

// Import assets
// @ts-ignore
import { assets } from '../assets/litematica/assets';
import atlasUrl from '../assets/litematica/blocks/atlas.png';
import textureData from '../assets/litematica/blocks/data.json';
import defaultPropertiesData from '../assets/litematica/blocks/mc-data-extract.json';

// Opaque block sets
const NON_SELF_CULLING = new Set(['minecraft:leaves', 'minecraft:glass', 'minecraft:glass_pane']);
const TRANSPARENT_BLOCKS = new Set(['minecraft:glass', 'minecraft:water']);

const CHUNK_SIZE = 8;

interface DeepslateViewerProps {
  litematic: Schematic | null;
  unpackingMethod?: 'spanning' | 'non-spanning';
  onHoverBlock?: (block: { x: number, y: number, z: number, name: string } | null) => void;
  selectedBlocks?: Set<string>;
  interactionMode?: InteractionMode;
  selectionMode?: SelectionMode;
  editMode?: EditMode;
  boxSelectionState?: BoxSelectionState;
  onSelectionClick?: (x: number, y: number, z: number, additive: boolean, subtractive: boolean) => void;
  onBoxSelectStart?: (x: number, y: number, z: number) => void;
  onBoxSelectUpdate?: (x: number, y: number, z: number) => void;
  onBoxSelectEnd?: () => void;
  onEditClick?: (x: number, y: number, z: number) => void;
  /** Incremented after batch edits to trigger a full GPU buffer rebuild. */
  structureVersion?: number;
}

function upperPowerOfTwo(x: number) {
  x -= 1;
  x |= x >> 1;
  x |= x >> 2;
  x |= x >> 4;
  x |= x >> 8;
  x |= x >> 18;
  x |= x >> 32;
  return x + 1;
}

function isGeometricFullCube(model: any): boolean {
  if (!model || !model.elements) return false;
  if (model.elements.length === 1) {
    const e = model.elements[0];
    return e.from[0] === 0 && e.from[1] === 0 && e.from[2] === 0 &&
           e.to[0] === 16 && e.to[1] === 16 && e.to[2] === 16;
  }
  return false;
}

function getChunkPos(x: number, y: number, z: number): [number, number, number] {
  return [
    Math.floor(x / CHUNK_SIZE),
    Math.floor(y / CHUNK_SIZE),
    Math.floor(z / CHUNK_SIZE),
  ];
}

export default function DeepslateViewer({
  litematic, unpackingMethod, onHoverBlock,
  selectedBlocks,
  interactionMode, selectionMode,
  boxSelectionState,
  onSelectionClick, onBoxSelectStart, onBoxSelectUpdate, onBoxSelectEnd,
  onEditClick,
  structureVersion,
}: DeepslateViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StructureRenderer | null>(null);
  const lineRendererRef = useRef<LineRenderer | null>(null);
  const filledBoxRendererRef = useRef<FilledBoxRenderer | null>(null);
  const providerRef = useRef<SchematicStructureProvider | null>(null);
  const dirtyChunksRef = useRef<Set<string>>(new Set());

  const { getHighlightBlock, onRaycastMouseMove, onRaycastMouseLeave } = useBlockRaycast();
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Cached coordinate offset (deepslate local → global)
  const minOffsetRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Throttle state updates
  const lastHoveredBlockRef = useRef<{ x: number, y: number, z: number } | null>(null);
  const onHoverBlockRef = useRef(onHoverBlock);
  onHoverBlockRef.current = onHoverBlock;

  // Interaction callbacks refs
  const onSelectionClickRef = useRef(onSelectionClick);
  onSelectionClickRef.current = onSelectionClick;
  const onEditClickRef = useRef(onEditClick);
  onEditClickRef.current = onEditClick;
  const onBoxSelectStartRef = useRef(onBoxSelectStart);
  onBoxSelectStartRef.current = onBoxSelectStart;
  const onBoxSelectUpdateRef = useRef(onBoxSelectUpdate);
  onBoxSelectUpdateRef.current = onBoxSelectUpdate;
  const onBoxSelectEndRef = useRef(onBoxSelectEnd);
  onBoxSelectEndRef.current = onBoxSelectEnd;

  const resourcesRef = useRef<Resources & ItemRendererResources | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef<number>(0);
  const structureSizeRef = useRef<[number, number, number]>([0, 0, 0]);

  // Camera State
  const cameraPos = useRef<vec3>(vec3.fromValues(0, 0, 0));
  const cameraFront = useRef<vec3>(vec3.fromValues(0, 0, -1));
  const cameraUp = useRef<vec3>(vec3.fromValues(0, 1, 0));
  const [cameraRotation, setCameraRotation] = useState({ yaw: -90, pitch: 0 });
  const [moveSpeed, setMoveSpeed] = useState(1.0);

  // ── Load Resources ───────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const img = new Image();
      img.src = atlasUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const blockDefinitions: Record<string, BlockDefinition> = {};
      Object.keys(assets.blockstates).forEach((id) => {
        blockDefinitions['minecraft:' + id] = BlockDefinition.fromJson(assets.blockstates[id]);
      });

      const blockModels: Record<string, BlockModel> = {};
      Object.keys(assets.models).forEach((id) => {
        blockModels['minecraft:' + id] = BlockModel.fromJson(assets.models[id]);
      });
      Object.values(blockModels).forEach((m) =>
        m.flatten({ getBlockModel: (id) => blockModels[id.toString()] }),
      );

      const atlasCanvas = document.createElement('canvas');
      const atlasSize = upperPowerOfTwo(Math.max(img.width, img.height));
      atlasCanvas.width = img.width;
      atlasCanvas.height = img.height;
      const ctx = atlasCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const atlasData = ctx.getImageData(0, 0, atlasSize, atlasSize);

      const idMap: Record<string, [number, number, number, number]> = {};
      Object.keys(textureData).forEach((key) => {
        const id = key as keyof typeof textureData;
        const [u, v, du, dv] = (textureData as any)[id];
        const dv2 = du !== dv && id.startsWith('block/') ? du : dv;
        idMap['minecraft:' + id] = [
          u / atlasSize, v / atlasSize,
          (u + du) / atlasSize, (v + dv2) / atlasSize,
        ];
      });

      const textureAtlas = new TextureAtlas(atlasData, idMap);

      const resources: Resources & ItemRendererResources = {
        getBlockDefinition(id) { return blockDefinitions[id.toString()]; },
        getBlockModel(id) { return blockModels[id.toString()]; },
        getTextureUV(id) { return textureAtlas.getTextureUV(id); },
        getTextureAtlas() { return textureAtlas.getTextureAtlas(); },
        getBlockFlags(id) {
          const name = id.toString();
          let model = blockModels[name];
          if (!model) {
            const parts = name.split(':');
            if (parts.length === 2) {
              model = blockModels[`${parts[0]}:block/${parts[1]}`];
            }
          }
          const isSolid = isGeometricFullCube(model);
          const isVisualTransparent =
            TRANSPARENT_BLOCKS.has(name) ||
            name.includes('glass') ||
            name.includes('ice') ||
            name.includes('slime') ||
            name.includes('honey');
          return {
            opaque: isSolid && !isVisualTransparent,
            self_culling: !NON_SELF_CULLING.has(name),
            semi_transparent: TRANSPARENT_BLOCKS.has(name),
          };
        },
        getBlockProperties(_id) { return null; },
        getDefaultBlockProperties(id: Identifier) { return (defaultPropertiesData.defaultProperties as any)[id.toString()]; },
        getItemModel(_id: Identifier) { return null; },
        getItemComponents(_id: Identifier) { return new Map(); },
      };

      resourcesRef.current = resources;
      setLoading(false);
    };

    load();
  }, []);

  // ── Initialize Renderer ──────────────────────────────────────

  useEffect(() => {
    if (!litematic || !resourcesRef.current || !canvasRef.current) return;

    if (unpackingMethod) {
      litematic.regions.forEach(r => r.setUnpackingMethod(unpackingMethod));
    }

    const gl = canvasRef.current.getContext('webgl');
    if (!gl) return;

    // Create provider wrapping live Schematic data
    const provider = new SchematicStructureProvider(litematic);
    providerRef.current = provider;

    // Cache coordinate offset
    minOffsetRef.current = { x: provider.minX, y: provider.minY, z: provider.minZ };

    const renderer = new StructureRenderer(
      gl,
      provider,
      resourcesRef.current,
      { chunkSize: CHUNK_SIZE },
    );

    rendererRef.current = renderer;
    lineRendererRef.current = new LineRenderer(gl);
    filledBoxRendererRef.current = new FilledBoxRenderer(gl);

    // Initialize camera
    const size = provider.getSize();
    structureSizeRef.current = [size[0], size[1], size[2]];

    const maxDim = Math.max(size[0], size[1], size[2]);
    const dist = maxDim * 2.0;
    vec3.set(cameraPos.current, dist, dist, dist);

    const dir = vec3.create();
    vec3.sub(dir, [0, 0, 0], cameraPos.current);
    vec3.normalize(dir, dir);
    const yawRad = Math.atan2(dir[2], dir[0]);
    const pitchRad = Math.asin(dir[1]);
    setCameraRotation({
      yaw: yawRad * (180 / Math.PI),
      pitch: pitchRad * (180 / Math.PI),
    });
    setMoveSpeed(maxDim / 20);

  }, [litematic, loading, unpackingMethod]);

  // ── Full rebuild on structureVersion change (batch edits) ────

  useEffect(() => {
    if (structureVersion !== undefined && structureVersion > 0 && rendererRef.current) {
      rendererRef.current.updateStructureBuffers();
    }
  }, [structureVersion]);

  // ── Keyboard & Wheel ─────────────────────────────────────────

  const pressedKeys = useRef<Set<string>>(new Set());
  const isHovered = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isHovered.current) return;
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft'].includes(e.code)) {
        e.preventDefault();
        pressedKeys.current.add(e.code);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.code);
    };
    const handleWheelGlobal = (e: WheelEvent) => {
      if (isHovered.current) {
        e.preventDefault();
        const zoomSpeed = moveSpeed * 5;
        const forward = vec3.create();
        vec3.copy(forward, cameraFront.current);
        vec3.scale(forward, forward, -Math.sign(e.deltaY) * zoomSpeed);
        vec3.add(cameraPos.current, cameraPos.current, forward);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheelGlobal, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheelGlobal);
    };
  }, [moveSpeed]);

  // ── Render Loop ──────────────────────────────────────────────

  useEffect(() => {
    const animate = () => {
      // Calculate front vector from rotation
      const yawRad = cameraRotation.yaw * Math.PI / 180;
      const pitchRad = cameraRotation.pitch * Math.PI / 180;
      const front = vec3.create();
      front[0] = Math.cos(yawRad) * Math.cos(pitchRad);
      front[1] = Math.sin(pitchRad);
      front[2] = Math.sin(yawRad) * Math.cos(pitchRad);
      vec3.normalize(front, front);
      vec3.copy(cameraFront.current, front);

      // Handle key movement
      if (pressedKeys.current.size > 0) {
        const speed = moveSpeed * 0.5;
        if (pressedKeys.current.has('KeyW')) {
          const f = vec3.create();
          vec3.scale(f, cameraFront.current, speed);
          vec3.add(cameraPos.current, cameraPos.current, f);
        }
        if (pressedKeys.current.has('KeyS')) {
          const f = vec3.create();
          vec3.scale(f, cameraFront.current, -speed);
          vec3.add(cameraPos.current, cameraPos.current, f);
        }
        const right = vec3.create();
        vec3.cross(right, cameraFront.current, cameraUp.current);
        vec3.normalize(right, right);
        if (pressedKeys.current.has('KeyA')) {
          const r = vec3.create();
          vec3.scale(r, right, -speed);
          vec3.add(cameraPos.current, cameraPos.current, r);
        }
        if (pressedKeys.current.has('KeyD')) {
          const r = vec3.create();
          vec3.scale(r, right, speed);
          vec3.add(cameraPos.current, cameraPos.current, r);
        }
        if (pressedKeys.current.has('Space')) {
          const u = vec3.fromValues(0, 1, 0);
          vec3.scale(u, u, speed);
          vec3.add(cameraPos.current, cameraPos.current, u);
        }
        if (pressedKeys.current.has('ShiftLeft')) {
          const u = vec3.fromValues(0, 1, 0);
          vec3.scale(u, u, -speed);
          vec3.add(cameraPos.current, cameraPos.current, u);
        }
      }

      if (rendererRef.current && canvasRef.current) {
        // Resize
        const displayWidth = canvasRef.current.clientWidth * window.devicePixelRatio;
        const displayHeight = canvasRef.current.clientHeight * window.devicePixelRatio;
        if (canvasRef.current.width !== displayWidth || canvasRef.current.height !== displayHeight) {
          canvasRef.current.width = displayWidth;
          canvasRef.current.height = displayHeight;
          rendererRef.current.setViewport(0, 0, displayWidth, displayHeight);
        }

        // View matrix
        const view = mat4.create();
        const target = vec3.create();
        vec3.add(target, cameraPos.current, cameraFront.current);
        mat4.lookAt(view, cameraPos.current, target, cameraUp.current);

        // ── Process dirty chunks (incremental GPU buffer updates) ──
        if (dirtyChunksRef.current.size > 0) {
          const chunkPositions: [number, number, number][] = [];
          dirtyChunksRef.current.forEach(key => {
            const [cx, cy, cz] = key.split(',').map(Number);
            chunkPositions.push([cx, cy, cz]);
          });
          rendererRef.current.updateStructureBuffers(chunkPositions);
          dirtyChunksRef.current.clear();
        }

        // 1. deepslate structure rendering + grid
        rendererRef.current.drawStructure(view);
        rendererRef.current.drawGrid(view);

        if (lineRendererRef.current) {
          const fieldOfView = 70 * Math.PI / 180;
          const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
          const zNear = 0.1;
          const zFar = 500.0;
          const projMatrix = mat4.create();
          mat4.perspective(projMatrix, fieldOfView, aspect, zNear, zFar);

          const sSize = structureSizeRef.current;
          const off = minOffsetRef.current;

          // 2. Structure boundary box (yellow)
          lineRendererRef.current.drawBox(
            view, projMatrix,
            [0, 0, 0],
            [sSize[0], sSize[1], sSize[2]],
            [1, 1, 0],
          );

          // 3. Selected blocks: semi-transparent filled (cyan, alpha=0.3)
          if (selectedBlocks && selectedBlocks.size > 0 && filledBoxRendererRef.current) {
            const selectionBoxes: Array<{ min: [number, number, number]; max: [number, number, number] }> = [];
            selectedBlocks.forEach(key => {
              const parts = key.split(',').map(Number);
              const gx = parts[0], gy = parts[1], gz = parts[2];
              const lx = gx - off.x;
              const ly = gy - off.y;
              const lz = gz - off.z;
              selectionBoxes.push({
                min: [lx, ly, lz],
                max: [lx + 1, ly + 1, lz + 1],
              });
              // 4. Selected blocks: cyan wireframe overlay
              lineRendererRef.current!.drawBox(
                view, projMatrix,
                [lx, ly, lz],
                [lx + 1, ly + 1, lz + 1],
                [0.2, 0.8, 1.0], // Cyan
              );
            });
            filledBoxRendererRef.current.drawFilledBoxes(
              view, projMatrix, selectionBoxes,
              [0.2, 0.8, 1.0, 0.3], // Cyan with alpha
            );
          }

          // 5. Box selection preview (blue wireframe, while dragging)
          if (boxSelectionState?.active) {
            const bs = boxSelectionState;
            const minX = Math.min(bs.startX, bs.endX) - off.x;
            const minY = Math.min(bs.startY, bs.endY) - off.y;
            const minZ = Math.min(bs.startZ, bs.endZ) - off.z;
            const maxX = Math.max(bs.startX, bs.endX) - off.x;
            const maxY = Math.max(bs.startY, bs.endY) - off.y;
            const maxZ = Math.max(bs.startZ, bs.endZ) - off.z;
            lineRendererRef.current.drawBox(
              view, projMatrix,
              [minX, minY, minZ],
              [maxX + 1, maxY + 1, maxZ + 1],
              [0.2, 0.6, 1.0], // Blue
            );
          }

          // Raycast for hover
          const hit = getHighlightBlock(
            litematic,
            minOffsetRef.current,
            sSize,
            canvasRef.current,
            view,
            projMatrix,
          );

          // 6. Hover highlight / edit preview
          if (hit) {
            const hx = hit.position[0];
            const hy = hit.position[1];
            const hz = hit.position[2];
            const gx = hx + off.x;
            const gy = hy + off.y;
            const gz = hz + off.z;
            const hoverKey = `${gx},${gy},${gz}`;
            const isInSelection = !selectedBlocks || selectedBlocks.size === 0 || (selectedBlocks.has(hoverKey));

            if (interactionMode === 'editing') {
              // Editing mode: red or orange hover
              const editColor: [number, number, number] = isInSelection
                ? [1.0, 0.5, 0.2]  // Orange (no selection = all editable)
                : [1.0, 0.2, 0.2]; // Red (outside selection)
              lineRendererRef.current.drawBox(
                view, projMatrix,
                [hx, hy, hz],
                [hx + 1, hy + 1, hz + 1],
                editColor,
              );
            } else {
              // Selection mode: white hover
              lineRendererRef.current.drawBox(
                view, projMatrix,
                [hx, hy, hz],
                [hx + 1, hy + 1, hz + 1],
                [1, 1, 1], // White
              );
            }

            const last = lastHoveredBlockRef.current;
            if (!last || last.x !== hx || last.y !== hy || last.z !== hz) {
              lastHoveredBlockRef.current = { x: hx, y: hy, z: hz };

              let name = 'Unknown Block';
              if (litematic) {
                const blockInfo = litematic.getBlock(gx, gy, gz);
                if (blockInfo) {
                  name = blockInfo.Name;
                }
              }

              if (onHoverBlockRef.current) {
                onHoverBlockRef.current({ x: hx, y: hy, z: hz, name });
              }
            }
          } else {
            if (lastHoveredBlockRef.current) {
              lastHoveredBlockRef.current = null;
              if (onHoverBlockRef.current) {
                onHoverBlockRef.current(null);
              }
            }
          }

          // 7. Axes
          lineRendererRef.current.drawAxes(view, projMatrix, 1000);
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [cameraRotation, moveSpeed, litematic, getHighlightBlock, selectedBlocks, boxSelectionState, interactionMode]);

  // ── Mouse Controls (Three.js-style: document-level listeners during drag) ──

  const isDragging = useRef(false);
  const isRightDrag = useRef(false);
  const hasDragged = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const isBoxSelecting = useRef(false);

  // Keep refs in sync for use inside native event handlers
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;
  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const doc = canvas.ownerDocument;

    // ── canvas-level: start drag + attach document listeners ──
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      hasDragged.current = false;
      isRightDrag.current = e.button === 2;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      // Attach document-level listeners for the duration of the drag
      doc.addEventListener('mousemove', onMouseMove);
      doc.addEventListener('mouseup', onMouseUp);

      // Selection + Box mode: start box selection on left mouse
      if (e.button === 0 && interactionModeRef.current === 'selection' && selectionModeRef.current === 'box') {
        const hovered = lastHoveredBlockRef.current;
        if (hovered) {
          isBoxSelecting.current = true;
          const off = minOffsetRef.current;
          onBoxSelectStartRef.current?.(hovered.x + off.x, hovered.y + off.y, hovered.z + off.z);
        }
      }
    };

    // ── document-level: update drag ──
    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      if (!isDragging.current) return;

      // preventDefault on document mousemove blocks browser gesture recognition
      e.preventDefault();

      if (isRightDrag.current) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          hasDragged.current = true;
        }
        const sensitivity = 0.2;
        setCameraRotation(prev => {
          let newYaw = prev.yaw + dx * sensitivity;
          let newPitch = prev.pitch - dy * sensitivity;
          if (newPitch > 89.0) newPitch = 89.0;
          if (newPitch < -89.0) newPitch = -89.0;
          return { yaw: newYaw, pitch: newPitch };
        });
        lastMouse.current = { x: e.clientX, y: e.clientY };
      } else if (isBoxSelecting.current) {
        hasDragged.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      } else {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          hasDragged.current = true;
        }
      }
    };

    // ── document-level: end drag ──
    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return;

      if (isBoxSelecting.current) {
        isBoxSelecting.current = false;
        onBoxSelectEndRef.current?.();
      } else if (!hasDragged.current && e.button === 0) {
        const hovered = lastHoveredBlockRef.current;
        if (hovered) {
          const off = minOffsetRef.current;
          const gx = hovered.x + off.x;
          const gy = hovered.y + off.y;
          const gz = hovered.z + off.z;

          const [cx, cy, cz] = getChunkPos(hovered.x, hovered.y, hovered.z);
          dirtyChunksRef.current.add(`${cx},${cy},${cz}`);

          if (interactionModeRef.current === 'selection') {
            onSelectionClickRef.current?.(gx, gy, gz, e.ctrlKey || e.metaKey, e.altKey);
          } else if (interactionModeRef.current === 'editing') {
            onEditClickRef.current?.(gx, gy, gz);
          }
        }
      }
      isDragging.current = false;
      isRightDrag.current = false;

      // Remove document-level listeners (passive mode when not dragging)
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('mouseup', onMouseUp);
    };

    // ── canvas-level: suppress context menu on canvas ──
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // ── document-level: prevent text selection during drag ──
    const onSelectStart = (e: Event) => {
      if (isDragging.current) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    doc.addEventListener('selectstart', onSelectStart);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      doc.removeEventListener('selectstart', onSelectStart);
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Box selection: update endpoint via raycast in animation loop
  // We store the latest raycast result for box select updates
  const lastRaycastHitRef = useRef<{ x: number; y: number; z: number } | null>(null);

  // Do raycast specifically for box select update on mouse move
  useEffect(() => {
    if (!isBoxSelecting.current) return;
    const interval = setInterval(() => {
      if (!isBoxSelecting.current || !canvasRef.current) return;
      const mp = mousePosRef.current;
      if (!mp) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const localX = mp.x - rect.left;
      const localY = mp.y - rect.top;
      if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;

      // Simple raycast using the existing hook's logic indirectly
      // We read the most recent hovered block
      const hovered = lastHoveredBlockRef.current;
      if (hovered) {
        const off = minOffsetRef.current;
        const gx = hovered.x + off.x;
        const gy = hovered.y + off.y;
        const gz = hovered.z + off.z;
        if (!lastRaycastHitRef.current ||
            lastRaycastHitRef.current.x !== gx ||
            lastRaycastHitRef.current.y !== gy ||
            lastRaycastHitRef.current.z !== gz) {
          lastRaycastHitRef.current = { x: gx, y: gy, z: gz };
          onBoxSelectUpdateRef.current?.(gx, gy, gz);
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const isSelection = interactionMode === 'selection';
  const isEditing = interactionMode === 'editing';

  return (
    <div
      style={{ width: '100%', height: '100%', background: '#333', position: 'relative', userSelect: 'none', touchAction: 'none' } as React.CSSProperties}
      onMouseEnter={() => { isHovered.current = true; }}
      onMouseLeave={() => { isHovered.current = false; pressedKeys.current.clear(); onRaycastMouseLeave(); }}
      onDragStart={(e) => e.preventDefault()}
    >
      {loading && <div style={{position:'absolute', top: 20, left: 20, color: 'white'}}>Loading Resources...</div>}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        onMouseMove={onRaycastMouseMove}
      />
      <div className="viewport-overlay-hint" style={{position: 'absolute', bottom: 10, left: 10, color: '#aaa', fontSize: '0.8rem'}}>
        {isSelection && 'Selection: Left Click | Add: Ctrl+Click | Sub: Alt+Click | Camera: Right Drag'}
        {isEditing && 'Editing: Left Click | Camera: Right Drag'}
        {!isSelection && !isEditing && 'Drag: Rotate | Scroll: Zoom | WASD: Move'}
      </div>
    </div>
  );
}
