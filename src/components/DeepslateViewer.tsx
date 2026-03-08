import { useEffect, useRef, useState } from 'react';
import { Litematic } from '../core/Litematic';
import { convertToDeepslateStructure } from '../utils/deepslateAdapter';
import { BlockDefinition, BlockModel, StructureRenderer, TextureAtlas, type Resources, type ItemRendererResources, Identifier } from 'deepslate';
import { mat4, vec3 } from 'gl-matrix';

// Import assets
// @ts-ignore
import { assets } from '../assets/litematica/assets';
import atlasUrl from '../assets/litematica/blocks/atlas.png';
import textureData from '../assets/litematica/blocks/data.json';
import defaultPropertiesData from '../assets/litematica/blocks/mc-data-extract.json';

// Opaque block sets
const NON_SELF_CULLING = new Set(['minecraft:leaves', 'minecraft:glass', 'minecraft:glass_pane']);
const OPAQUE_BLOCKS = new Set(['minecraft:stone', 'minecraft:dirt', 'minecraft:grass_block']); // Simplified
const TRANSPARENT_BLOCKS = new Set(['minecraft:glass', 'minecraft:water']); // Simplified

interface DeepslateViewerProps {
  litematic: Litematic | null;
  unpackingMethod?: 'spanning' | 'non-spanning';
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

// Check if a block model is geometrically a full 16x16x16 cube
function isGeometricFullCube(model: any): boolean {
  if (!model || !model.elements) return false;
  
  // Most full blocks have exactly one element covering the full range
  if (model.elements.length === 1) {
    const e = model.elements[0];
    return e.from[0] === 0 && e.from[1] === 0 && e.from[2] === 0 &&
           e.to[0] === 16 && e.to[1] === 16 && e.to[2] === 16;
  }
  
  return false;
}

import { LineRenderer } from '../utils/LineRenderer';

export default function DeepslateViewer({ litematic, unpackingMethod }: DeepslateViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StructureRenderer | null>(null);
  const lineRendererRef = useRef<LineRenderer | null>(null);
  const resourcesRef = useRef<Resources & ItemRendererResources | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef<number>(0);
  const structureSizeRef = useRef<[number, number, number]>([0, 0, 0]);

  // Camera State
  const [viewDist, setViewDist] = useState(4);
  const [rotation, setRotation] = useState({ x: 0.5, y: 0.8 });
  const cameraPos = useRef<vec3>(vec3.create());
  
  // Load Resources
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      
      // Load Atlas Image
      const img = new Image();
      img.src = atlasUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Process Resources (Adapted from RedenMC)
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

      // Create Texture Atlas
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
          u / atlasSize,
          v / atlasSize,
          (u + du) / atlasSize,
          (v + dv2) / atlasSize,
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
          
          // Try to find the model with 'block/' prefix if not found directly
          // Most blocks have their models in the 'block/' namespace path
          if (!model) {
            const parts = name.split(':');
            if (parts.length === 2) {
              model = blockModels[`${parts[0]}:block/${parts[1]}`];
            }
          }
          
          // 1. Geometric Check: Is it a full 16x16x16 cube?
          // This automatically handles fences, slabs, stairs, torches, etc.
          // @ts-ignore - accessing private elements property
          const isSolid = isGeometricFullCube(model);

          // 2. Visual Check: Exclude full cubes that are transparent (Glass, Ice, Slime, etc.)
          const isVisualTransparent = 
            TRANSPARENT_BLOCKS.has(name) || 
            name.includes('glass') || 
            name.includes('ice') || 
            name.includes('slime') || 
            name.includes('honey');

          return {
            opaque: isSolid && !isVisualTransparent,
            self_culling: !NON_SELF_CULLING.has(name),
            semi_transparent: TRANSPARENT_BLOCKS.has(name)
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

  // Initialize Renderer
  useEffect(() => {
    if (!litematic || !resourcesRef.current || !canvasRef.current) return;

    if (unpackingMethod) {
      litematic.regions.forEach(r => r.setUnpackingMethod(unpackingMethod));
    }

    const gl = canvasRef.current.getContext('webgl');
    if (!gl) return;

    const structure = convertToDeepslateStructure(litematic);
    
    // Cleanup previous
    if (rendererRef.current) {
        // No explicit destroy method on StructureRenderer?
    }

    const renderer = new StructureRenderer(
      gl,
      structure,
      resourcesRef.current,
      { chunkSize: 8 }
    );
    
    rendererRef.current = renderer;
    lineRendererRef.current = new LineRenderer(gl);
    
    // Reset Camera
    const size = structure.getSize();
    structureSizeRef.current = [size[0], size[1], size[2]];
    vec3.set(cameraPos.current, 0, -size[1] * 1.5, -size[2] * 2);

  }, [litematic, loading, unpackingMethod]);

  // Render Loop
  const pressedKeys = useRef<Set<string>>(new Set());
  const isHovered = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle keys if mouse is hovering over the viewer
        if (!isHovered.current) return;

        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft'].includes(e.code)) {
            e.preventDefault(); // Prevent scrolling (especially for Space)
            pressedKeys.current.add(e.code);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        pressedKeys.current.delete(e.code);
    };
    
    // Use non-passive listener for wheel to ensure we can prevent default scrolling
    const handleWheelGlobal = (e: WheelEvent) => {
        if (isHovered.current) {
            e.preventDefault();
            setViewDist(prev => Math.max(0.1, prev - e.deltaY * 0.001));
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
  }, []);

  useEffect(() => {
    const animate = () => {
      // Handle Keys
      if (pressedKeys.current.size > 0) {
        const speed = 0.05 * (16 / Math.max(1, viewDist)); // Adjust speed based on zoom
        const move = vec3.create();
        
        // Forward/Backward (W/S) - Relative to camera yaw
        if (pressedKeys.current.has('KeyW')) {
            const forward = vec3.fromValues(0, 0, speed);
            vec3.rotateY(forward, forward, [0, 0, 0], -rotation.y);
            vec3.add(move, move, forward);
        }
        if (pressedKeys.current.has('KeyS')) {
            const backward = vec3.fromValues(0, 0, -speed);
            vec3.rotateY(backward, backward, [0, 0, 0], -rotation.y);
            vec3.add(move, move, backward);
        }

        // Left/Right (A/D) - Relative to camera yaw
        if (pressedKeys.current.has('KeyA')) {
            const left = vec3.fromValues(speed, 0, 0);
            vec3.rotateY(left, left, [0, 0, 0], -rotation.y);
            vec3.add(move, move, left);
        }
        if (pressedKeys.current.has('KeyD')) {
            const right = vec3.fromValues(-speed, 0, 0);
            vec3.rotateY(right, right, [0, 0, 0], -rotation.y);
            vec3.add(move, move, right);
        }

        // Up/Down (Space/Shift) - Absolute vertical
        if (pressedKeys.current.has('Space')) {
            vec3.add(move, move, [0, -speed, 0]); 
        }
        if (pressedKeys.current.has('ShiftLeft')) {
             vec3.add(move, move, [0, speed, 0]);
        }
        
        // Apply to camera
        vec3.add(cameraPos.current, cameraPos.current, move);
      }

      if (rendererRef.current && canvasRef.current) {
        // Resize logic
        const displayWidth = canvasRef.current.clientWidth * window.devicePixelRatio;
        const displayHeight = canvasRef.current.clientHeight * window.devicePixelRatio;
        
        if (canvasRef.current.width !== displayWidth || canvasRef.current.height !== displayHeight) {
           canvasRef.current.width = displayWidth;
           canvasRef.current.height = displayHeight;
           rendererRef.current.setViewport(0, 0, displayWidth, displayHeight);
        }

        const view = mat4.create();
        mat4.rotateX(view, view, rotation.x);
        mat4.rotateY(view, view, rotation.y);
        mat4.translate(view, view, cameraPos.current);
        mat4.scale(view, view, [viewDist/4, viewDist/4, viewDist/4]); // Zoom

        rendererRef.current.drawStructure(view);
        rendererRef.current.drawGrid(view);

        if (lineRendererRef.current) {
            const fieldOfView = 70 * Math.PI / 180;
            const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
            const zNear = 0.1;
            const zFar = 500.0;
            const projMatrix = mat4.create();
            mat4.perspective(projMatrix, fieldOfView, aspect, zNear, zFar);
            
            lineRendererRef.current.drawAxes(view, projMatrix);
            
            const sSize = structureSizeRef.current;
            lineRendererRef.current.drawBox(
              view, 
              projMatrix, 
              [0, 0, 0], 
              [sSize[0], sSize[1], sSize[2]], 
              [1, 1, 0] // Yellow box
            );
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [rotation, viewDist]);

  // Mouse Controls
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    
    setRotation(prev => ({
      x: Math.max(-Math.PI/2, Math.min(Math.PI/2, prev.x + dy * 0.01)),
      y: prev.y + dx * 0.01
    }));
    
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };
  
  return (
    <div 
      style={{ width: '100%', height: '100%', background: '#333', position: 'relative' }}
      onMouseEnter={() => { isHovered.current = true; }}
      onMouseLeave={() => { isHovered.current = false; pressedKeys.current.clear(); }}
    >
      {loading && <div style={{position:'absolute', top: 20, left: 20, color: 'white'}}>Loading Resources...</div>}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div style={{position: 'absolute', bottom: 10, left: 10, color: '#aaa', fontSize: '0.8rem'}}>
        Deepslate Renderer | Drag to Rotate | Scroll to Zoom | WASD + Space/Shift to Move
      </div>
    </div>
  );
}
