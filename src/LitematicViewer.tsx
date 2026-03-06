import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stats, Grid } from '@react-three/drei'
import { useState, useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Litematic } from './core/Litematic'
import { isBlockVisible } from './utils/litematicParser' // Reusing visibility check for now
import type { TraversalOrder } from './core/BlockStorage'

interface LitematicViewerProps {
  litematic: Litematic;
  unpackingMethod: 'spanning' | 'non-spanning';
  traversalOrder: TraversalOrder;
}

// Map some common block types to colors for a basic preview
export const getBlockColor = (blockId: string): string => {
  // Common building blocks
  if (blockId.includes('air')) return 'transparent'
  if (blockId.includes('stone')) return '#7d7d7d' // Stone, Smooth Stone, Cobblestone
  if (blockId.includes('dirt')) return '#5c4033'
  if (blockId.includes('grass')) return '#4caf50'
  if (blockId.includes('log')) return '#5d4037'
  if (blockId.includes('leaves')) return '#2e7d32'
  if (blockId.includes('planks')) return '#e0c097'
  if (blockId.includes('glass')) return '#aed9e0' // Glass handling needs transparency
  if (blockId.includes('sand')) return '#f4a460'
  if (blockId.includes('water')) return '#2196f3'
  if (blockId.includes('lava')) return '#ff5722'
  if (blockId.includes('concrete')) return '#9e9e9e' // Generic concrete
  
  // Specific blocks mentioned by user
  if (blockId.includes('slime')) return '#8cd382' // Slime block
  if (blockId.includes('piston')) return '#726759' // Pistons
  if (blockId.includes('observer')) return '#3a3a3a' // Observer
  if (blockId.includes('redstone_block')) return '#ff0000' // Redstone block
  if (blockId.includes('honey')) return '#ffb300' // Honey block
  if (blockId.includes('target')) return '#e53935' // Target block
  
  // Fallback for unknown blocks
  // Use a distinct color (magenta) to easily spot unmapped blocks
  return '#ff00ff' 
}

// Inner component to handle scene setup and centering
function SceneSetup({ center }: { center: [number, number, number] }) {
  const { camera, controls } = useThree()
  
  useEffect(() => {
    // Initial camera position
    camera.position.set(center[0] + 50, center[1] + 50, center[2] + 50)
    camera.lookAt(center[0], center[1], center[2])
    if (controls) {
      // @ts-ignore
      controls.target.set(center[0], center[1], center[2])
    }
  }, [center, camera, controls])

  return null
}

import { DeepslateContext } from './utils/deepslate/deepslateContext';
import { getBlockGeometry } from './utils/deepslate/geometryGenerator';

export default function LitematicViewer({ litematic, unpackingMethod, traversalOrder }: LitematicViewerProps) {
  // Use state to trigger re-renders when resources load
  const [resourceVersion, setResourceVersion] = useState(0);

  // Initialize Deepslate context
  useEffect(() => {
      // Just ensure instance is created
      DeepslateContext.getInstance();
  }, []);

  // Extract regions and process geometry
  const { center, instanceMap } = useMemo(() => {
    // We need to group instances by geometry type (or block ID if simplified)
    // For now, let's keep using BoxGeometry for everything to start, 
    // but structure it to support multiple meshes.
    
    // Map: GeometryKey -> Instance[]
    const instanceMap = new Map<string, { color: string, matrix: THREE.Matrix4, id: number }[]>();
    
    // We also need to keep track of the actual Geometry objects
    // Map: GeometryKey -> THREE.BufferGeometry
    const geometryMap = new Map<string, THREE.BufferGeometry>();

    // Default geometry (Box)
    const defaultGeo = new THREE.BoxGeometry(1, 1, 1);
    geometryMap.set('default', defaultGeo);
    
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    if (!litematic || litematic.regions.length === 0) {
      return { center: [0, 0, 0] as [number, number, number], instanceMap }
    }

    console.group("LitematicViewer (Core) Processing");
    
    // Iterate over all regions
    litematic.regions.forEach(region => {
      // ... (existing logic)
      
      // We need to load resources for these blocks asynchronously.
      // But useMemo is synchronous.
      // So we will trigger resource loading here, and when done, update state to re-render.
      const ctx = DeepslateContext.getInstance();
      
      // Collect unique blocks
      const uniqueBlocks = new Set(region.palette);
      uniqueBlocks.forEach(b => {
          if (b && !b.includes('air')) {
              ctx.loadBlock(b).then(() => {
                  // This is a bit spammy, maybe debounce or check if loaded
                  // setResourceVersion(v => v + 1);
              });
          }
      });
      
      // ...
      console.log(`Processing Region: ${region.name} (Method: ${unpackingMethod}, Order: ${traversalOrder})`);
      
      // Apply debug settings
      region.setUnpackingMethod(unpackingMethod);
      region.setTraversalOrder(traversalOrder);

      const { x: sizeX, y: sizeY, z: sizeZ } = region.size;
      const { x: startX, y: startY, z: startZ } = region.position;

      // Update bounds
      minX = Math.min(minX, startX); minY = Math.min(minY, startY); minZ = Math.min(minZ, startZ);
      maxX = Math.max(maxX, startX + sizeX); maxY = Math.max(maxY, startY + sizeY); maxZ = Math.max(maxZ, startZ + sizeZ);

      // Pre-unpack to array for visibility check speed? 
      // Or just use getBlockIndex. getBlockIndex is fast enough.
      // But isBlockVisible needs an array. Let's convert storage to array.
      // This might be slow for huge regions, but for viewing it's okay.
      const blocks = region.storage.toArray();
      
      // Debug: Check distribution
      const counts: Record<number, number> = {};
      // Sample first 1000 blocks to save time
      for(let i=0; i<Math.min(blocks.length, 1000); i++) {
          const b = blocks[i];
          counts[b] = (counts[b] || 0) + 1;
      }
      console.log("Block Sample Distribution:", counts);

      // Generate Instances
      const tempMatrix = new THREE.Matrix4()
      let visibleCount = 0;
      
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          for (let x = 0; x < sizeX; x++) {
            
            // Standard index = (y * length + z) * width + x
            const index = (y * sizeZ + z) * sizeX + x
            const blockIndex = blocks[index]
            const blockId = region.palette[blockIndex]
            
            // Skip air
            if (!blockId || blockId.includes('air')) {
              continue
            }
            
            // Optimization: Hidden Face Culling
            const visible = isBlockVisible(x, y, z, sizeX, sizeY, sizeZ, blocks as any)
            
            if (visible) {
              const worldX = startX + x
              const worldY = startY + y
              const worldZ = startZ + z
              
              tempMatrix.setPosition(worldX, worldY, worldZ)
              
              // Determine geometry key
              // For now, we use blockId as key.
              // Ideally we should use the same cache key as geometryGenerator (id + properties)
              // But extracting properties from blockId string (e.g. "minecraft:oak_stairs[facing=east]") is needed.
              
              // Simplified: Use blockId directly.
              // We need to fetch geometry synchronously here? No, we can't.
              // So we check if geometry is in our geometryMap.
              // If not, we use default 'box'.
              // The geometries are loaded asynchronously via side-effect in the loop above.
              
              // Wait, we need to populate geometryMap based on loaded resources.
              // geometryGenerator has a cache.
              // We can try to get from cache synchronously if available.
              
              // Let's assume we use 'default' unless we find a specific geometry in our map.
              // But how do we get the geometry object into this useMemo?
              // We need to fetch it from geometryGenerator's cache or ctx.
              
              // Actually, we should probably fetch geometry here.
              // But getBlockGeometry is async.
              // So we can only use what's already loaded.
              
              // Let's use a trick: 
              // We check if Deepslate has the definition. If so, try to generate geometry synchronously?
              // getBlockGeometry is async because it calls loadBlock.
              // But if loadBlock is done, maybe we can make a sync version?
              // For now, let's just use "default" for everything to start,
              // and if we want to support real models, we need to preload them all.
              
              // REFACTOR PLAN:
              // 1. We identify all unique blocks.
              // 2. We trigger load for all of them (async).
              // 3. Once loaded, we re-run this useMemo.
              // 4. Inside this loop, we try to get geometry.
              
              const id = blockId.replace('minecraft:', '');
              // Parse properties
              let properties: Record<string, string> = {};
              const propStart = id.indexOf('[');
              let baseName = id;
              if (propStart !== -1) {
                  baseName = id.substring(0, propStart);
                  const propStr = id.substring(propStart + 1, id.length - 1);
                  propStr.split(',').forEach(p => {
                      const [k, v] = p.split('=');
                      properties[k] = v;
                  });
              }
              
              // Try to get geometry from cache (we need to expose a sync getter or check cache directly)
              // Since we can't import the cache map easily, let's rely on a helper or just use default for now
              // and implement the async loader properly.
              
              // For MVP: Group by blockId.
              const key = blockId;
              
              if (!instanceMap.has(key)) {
                  instanceMap.set(key, []);
              }
              
              instanceMap.get(key)!.push({
                color: getBlockColor(blockId),
                matrix: tempMatrix.clone(),
                id: blockIndex
              })
              visibleCount++;
            }
          }
        }
      }
      console.log(`Region ${region.name}: Visible Instances=${visibleCount}`);
    })
    console.groupEnd();

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerZ = (minZ + maxZ) / 2
    
    // Safety check for bounds
    if (!isFinite(centerX) || !isFinite(centerY) || !isFinite(centerZ)) {
        return { center: [0, 0, 0] as [number, number, number], instanceMap }
    }
    
    return { 
      instanceMap,
      center: [centerX, centerY, centerZ] as [number, number, number],
    }

  }, [litematic, unpackingMethod, traversalOrder, resourceVersion]) // Depend on resourceVersion

  // Effect to load geometries
  useEffect(() => {
      const loadGeometries = async () => {
          if (!litematic) return;
          const ctx = DeepslateContext.getInstance();
          
          // Collect all unique blocks from all regions
          const allBlocks = new Set<string>();
          litematic.regions.forEach(r => r.palette.forEach(b => {
              if (b && !b.includes('air')) allBlocks.add(b);
          }));
          
          // Load them
          for (const blockId of allBlocks) {
              const id = blockId.replace('minecraft:', '');
              let properties: Record<string, string> = {};
              const propStart = id.indexOf('[');
              let baseName = id;
              if (propStart !== -1) {
                  baseName = id.substring(0, propStart);
                  const propStr = id.substring(propStart + 1, id.length - 1);
                  propStr.split(',').forEach(p => {
                      const [k, v] = p.split('=');
                      properties[k] = v;
                  });
              }
              
              // This will populate the cache in geometryGenerator
              await getBlockGeometry(ctx, baseName, properties);
          }
          
          // Force re-render once all loaded
          // We can't easily know if *new* stuff loaded, but we can just set version
          // setResourceVersion(v => v + 1); 
          // Wait, if we set version, it loops. We need a check.
          // Let's assume we only load once or check if loaded.
      };
      
      loadGeometries();
  }, [litematic]); 
  
  // Helper to sync retrieve geometry from cache (using same logic as generator)
  // We need to import the cache or use a sync method.
  // Since getBlockGeometry is async, we can't use it in render.
  // But we know it caches.
  // Let's modifying getBlockGeometry to export a checkCache method or similar?
  // Or just rely on the fact that we grouped by blockId.
  
  return (
    <div style={{ width: '100%', height: '600px', background: '#111', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
      <Canvas shadows camera={{ fov: 50 }}>
        <color attach="background" args={['#111']} />
        
        {/* Lights */}
        <ambientLight intensity={0.7} />
        <pointLight position={[100, 100, 100]} intensity={1} />
        <directionalLight position={[-50, 50, -50]} intensity={0.5} castShadow />

        {/* Controls */}
        <OrbitControls makeDefault />
        <Stats />
        <Grid infiniteGrid sectionColor="#444" cellColor="#222" fadeDistance={100} />

        {/* Helper to center camera */}
        <SceneSetup center={center} />

        {/* Render Instances - Now iterating over the map */}
        {Array.from(instanceMap.entries()).map(([key, insts]) => (
             <BlocksRenderer 
                key={key} 
                instances={insts} 
                blockId={key} // Pass blockId to look up geometry
             />
        ))}

      </Canvas>
      
      {/* Overlay Info */}
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '4px', fontSize: '0.8em', pointerEvents: 'none' }}>
        Method: {unpackingMethod} | Order: {traversalOrder}
      </div>
    </div>
  )
}

// Updated Renderer
function BlocksRenderer({ instances, blockId }: { instances: { color: string, matrix: THREE.Matrix4 }[], blockId: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  
  // Load geometry for this block type
  useEffect(() => {
      const load = async () => {
          const ctx = DeepslateContext.getInstance();
          const id = blockId.replace('minecraft:', '');
          let properties: Record<string, string> = {};
          const propStart = id.indexOf('[');
          let baseName = id;
          if (propStart !== -1) {
              baseName = id.substring(0, propStart);
              const propStr = id.substring(propStart + 1, id.length - 1);
              propStr.split(',').forEach(p => {
                  const [k, v] = p.split('=');
                  properties[k] = v;
              });
          }
          
          const geo = await getBlockGeometry(ctx, baseName, properties);
          setGeometry(geo);
      };
      load();
  }, [blockId]);

  useEffect(() => {
    if (!meshRef.current) return
    
    const tempColor = new THREE.Color()
    
    instances.forEach((inst, i) => {
      meshRef.current!.setMatrixAt(i, inst.matrix)
      meshRef.current!.setColorAt(i, tempColor.set(inst.color))
    })
    
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
    
  }, [instances, geometry]) // Re-run when geometry loads

  if (instances.length === 0) return null
  
  // Use a default box geometry if geometry is not yet loaded, 
  // so that we can at least see something (e.g. while loading or if loading fails)
  // This prevents "Only grid visible" issue.
  const displayGeometry = geometry || new THREE.BoxGeometry(1, 1, 1);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, instances.length]} geometry={displayGeometry}>
      <meshStandardMaterial />
    </instancedMesh>
  )
}
