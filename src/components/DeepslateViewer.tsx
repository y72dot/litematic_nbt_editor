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

  // Camera State - World Position & Euler Angles
  const cameraPos = useRef<vec3>(vec3.fromValues(0, 0, 0));
  const cameraFront = useRef<vec3>(vec3.fromValues(0, 0, -1));
  const cameraUp = useRef<vec3>(vec3.fromValues(0, 1, 0));
  
  // Yaw: rotation around Y axis (horizontal)
  // Pitch: rotation around X axis (vertical)
  const [cameraRotation, setCameraRotation] = useState({ yaw: -90, pitch: 0 }); // Degrees
  const [moveSpeed, setMoveSpeed] = useState(1.0);
  
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
    
    // Initialize Camera to Isometric View
    const size = structure.getSize();
    structureSizeRef.current = [size[0], size[1], size[2]];
    
    const maxDim = Math.max(size[0], size[1], size[2]);
    const dist = maxDim * 2.0; // Distance multiplier

    // Position at [dist, dist, dist] looking at [0, 0, 0] (or center)
    // To look at center of model:
    // const centerX = size[0] / 2;
    // const centerY = size[1] / 2;
    // const centerZ = size[2] / 2;
    
    // But user requested "look at origin", so we position relative to origin
    vec3.set(cameraPos.current, dist, dist, dist);

    // Calculate initial Yaw/Pitch to look at origin [0,0,0] from [dist,dist,dist]
    // Direction vector = normalize(0 - pos) = normalize([-1, -1, -1])
    // Yaw = atan2(dir.z, dir.x)
    // Pitch = asin(dir.y)
    
    const dir = vec3.create();
    vec3.sub(dir, [0, 0, 0], cameraPos.current);
    vec3.normalize(dir, dir);

    // Convert direction vector to Euler angles (degrees)
    const yawRad = Math.atan2(dir[2], dir[0]);
    const pitchRad = Math.asin(dir[1]);

    setCameraRotation({
        yaw: yawRad * (180 / Math.PI),
        pitch: pitchRad * (180 / Math.PI)
    });
    
    // Initial movement speed relative to model size
    setMoveSpeed(maxDim / 20); // Move 1/20th of model size per frame base speed

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
            // Scroll to adjust movement speed or FOV? Let's do movement speed for now
            // Or move forward/backward like a zoom
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
  }, [moveSpeed]); // Dependency on moveSpeed

  useEffect(() => {
    const animate = () => {
      // Calculate Front Vector from Rotation
      const yawRad = cameraRotation.yaw * Math.PI / 180;
      const pitchRad = cameraRotation.pitch * Math.PI / 180;
      
      const front = vec3.create();
      front[0] = Math.cos(yawRad) * Math.cos(pitchRad);
      front[1] = Math.sin(pitchRad);
      front[2] = Math.sin(yawRad) * Math.cos(pitchRad);
      vec3.normalize(front, front);
      vec3.copy(cameraFront.current, front);

      // Handle Keys (Movement)
      if (pressedKeys.current.size > 0) {
        const speed = moveSpeed * 0.5; // Frame speed multiplier
        const move = vec3.create();
        
        // Front/Back
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

        // Left/Right (Strafe)
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

        // Up/Down (World Y)
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
        // Resize logic
        const displayWidth = canvasRef.current.clientWidth * window.devicePixelRatio;
        const displayHeight = canvasRef.current.clientHeight * window.devicePixelRatio;
        
        if (canvasRef.current.width !== displayWidth || canvasRef.current.height !== displayHeight) {
           canvasRef.current.width = displayWidth;
           canvasRef.current.height = displayHeight;
           rendererRef.current.setViewport(0, 0, displayWidth, displayHeight);
        }

        // View Matrix (LookAt)
        const view = mat4.create();
        const target = vec3.create();
        vec3.add(target, cameraPos.current, cameraFront.current);
        mat4.lookAt(view, cameraPos.current, target, cameraUp.current);

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
            lineRendererRef.current.drawBox(
              view, 
              projMatrix, 
              [0, 0, 0], 
              [sSize[0], sSize[1], sSize[2]], 
              [1, 1, 0] // Yellow box
            );

            // Draw axes AFTER the box, with bias, to ensure they appear on top
            lineRendererRef.current.drawAxes(view, projMatrix, 1000);
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [cameraRotation, moveSpeed]);

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
    
    // Sensitivity
    const sensitivity = 0.2;

    setCameraRotation(prev => {
        let newYaw = prev.yaw + dx * sensitivity;
        let newPitch = prev.pitch - dy * sensitivity;

        // Clamp Pitch to avoid gimbal lock
        if (newPitch > 89.0) newPitch = 89.0;
        if (newPitch < -89.0) newPitch = -89.0;

        return { yaw: newYaw, pitch: newPitch };
    });
    
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
