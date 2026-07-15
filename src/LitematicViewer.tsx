import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stats, Grid } from '@react-three/drei'
import { useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import type { Schematic } from './core/Schematic'
import { isBlockVisible } from './utils/litematicParser' // Reusing visibility check for now
import type { TraversalOrder } from './core/BlockStorage'

interface LitematicViewerProps {
  litematic: Schematic;
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

export default function LitematicViewer({ litematic, unpackingMethod, traversalOrder }: LitematicViewerProps) {
  const { t } = useTranslation()
  // Extract regions and process geometry
  const { instances, center } = useMemo(() => {
    const instances: { color: string, matrix: THREE.Matrix4, id: number }[] = []
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    if (!litematic || litematic.regions.length === 0) {
      return { instances: [], center: [0, 0, 0] as [number, number, number] }
    }

    console.group("LitematicViewer (Core) Processing");
    
    // Iterate over all regions
    litematic.regions.forEach(region => {
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
            // We reuse the old utility which expects a number[] or TypedArray
            // region.storage.toArray() returns a TypedArray, which is compatible.
            // Note: isBlockVisible needs to be updated to accept TypedArray if it doesn't already.
            // It accepts number[], let's check.
            // It takes blocks: number[]. TypedArray is not strictly number[], but can be indexed.
            // We might need to cast or update utils.
            // Let's assume it works or cast as any for now.
            const visible = isBlockVisible(x, y, z, sizeX, sizeY, sizeZ, blocks as any)
            
            if (visible) {
              const worldX = startX + x
              const worldY = startY + y
              const worldZ = startZ + z
              
              tempMatrix.setPosition(worldX, worldY, worldZ)
              
              instances.push({
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
        return { instances, center: [0, 0, 0] as [number, number, number] }
    }
    
    return { 
      instances, 
      center: [centerX, centerY, centerZ] as [number, number, number],
    }

  }, [litematic, unpackingMethod, traversalOrder])

  return (
    <div style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }}>
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

        {/* Render Instances */}
        <BlocksRenderer instances={instances} />

      </Canvas>
      
      {/* Overlay Info */}
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '4px', fontSize: '0.8em', pointerEvents: 'none' }}>
        {t('litematicViewer.overlayMethod', { method: unpackingMethod, order: traversalOrder })}
      </div>
    </div>
  )
}

// Separate component to handle the InstancedMesh logic
function BlocksRenderer({ instances }: { instances: { color: string, matrix: THREE.Matrix4 }[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  
  useEffect(() => {
    if (!meshRef.current) return
    
    const tempColor = new THREE.Color()
    
    instances.forEach((inst, i) => {
      meshRef.current!.setMatrixAt(i, inst.matrix)
      meshRef.current!.setColorAt(i, tempColor.set(inst.color))
    })
    
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
    
  }, [instances])

  if (instances.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, instances.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </instancedMesh>
  )
}
