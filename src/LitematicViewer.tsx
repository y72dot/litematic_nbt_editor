import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stats, Grid } from '@react-three/drei'
import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { unpackBlockStates, isBlockVisible } from './utils/litematicParser'

interface LitematicViewerProps {
  nbtData: any;
}

// Map some common block types to colors for a basic preview
const getBlockColor = (blockId: string): string => {
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

export default function LitematicViewer({ nbtData }: LitematicViewerProps) {
  // Extract regions and process geometry
  const { instances, center } = useMemo(() => {
    const instances: { color: string, matrix: THREE.Matrix4, id: number }[] = []
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    if (!nbtData || !nbtData.value || !nbtData.value.Regions) {
      console.warn("LitematicViewer: No Regions found in NBT data", nbtData);
      return { instances: [], center: [0, 0, 0] as [number, number, number] }
    }

    const regions = nbtData.value.Regions.value
    console.group("Litematic Processing Debug");
    
    // Iterate over all regions
    Object.keys(regions).forEach(regionName => {
      const region = regions[regionName].value
      console.log(`Processing Region: ${regionName}`, region);
      
      // Region Position (relative to schematic origin)
      const rPosX = region.Position.value.x.value
      const rPosY = region.Position.value.y.value
      const rPosZ = region.Position.value.z.value
      
      // Region Size
      let sizeX = region.Size.value.x.value
      let sizeY = region.Size.value.y.value
      let sizeZ = region.Size.value.z.value
      
      // Normalize to positive dimensions and adjust start position if needed
      let startX = rPosX
      let startY = rPosY
      let startZ = rPosZ
      
      if (sizeX < 0) { startX += sizeX; sizeX = Math.abs(sizeX); }
      if (sizeY < 0) { startY += sizeY; sizeY = Math.abs(sizeY); }
      if (sizeZ < 0) { startZ += sizeZ; sizeZ = Math.abs(sizeZ); }

      // Update bounds
      minX = Math.min(minX, startX); minY = Math.min(minY, startY); minZ = Math.min(minZ, startZ);
      maxX = Math.max(maxX, startX + sizeX); maxY = Math.max(maxY, startY + sizeY); maxZ = Math.max(maxZ, startZ + sizeZ);

      // Palette
      // Handle the case where BlockStatePalette might be wrapped differently
      let palette = region.BlockStatePalette.value
      if (!Array.isArray(palette) && palette && palette.value && Array.isArray(palette.value)) {
          // It's wrapped inside another object
          palette = palette.value
      } else if (!Array.isArray(palette)) {
          console.error("BlockStatePalette is not an array!", region.BlockStatePalette);
          // Try fallback or skip
          return;
      }

      const paletteSize = palette.length
      
      // Map palette index to block ID (string)
      // Safely access Name.value
      const localPaletteMap: string[] = palette.map((p: any) => p.Name ? p.Name.value : "unknown:air")
      console.log(`Palette (Size: ${paletteSize}):`, localPaletteMap);
      
      // BlockStates
      const blockStates = region.BlockStates.value
      const volume = Math.abs(sizeX * sizeY * sizeZ)
      
      // Unpack
      console.time("Unpack BlockStates");
      const blocks = unpackBlockStates(blockStates, paletteSize, volume)
      console.timeEnd("Unpack BlockStates");
      
      // Debug: Check distribution of block indices
      const counts: Record<number, number> = {};
      blocks.forEach(b => counts[b] = (counts[b] || 0) + 1);
      console.log("Block Index Distribution:", counts);

      // Generate Instances with Visibility Check
      const tempMatrix = new THREE.Matrix4()
      
      let visibleCount = 0;
      
      // Litematic iteration order: YZX usually? 
      // Let's iterate x,y,z and calculate index.
      // Standard index = (y * length + z) * width + x
      // width=sizeX, height=sizeY, length=sizeZ
      
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          for (let x = 0; x < sizeX; x++) {
            
            const index = (y * sizeZ + z) * sizeX + x
            const blockIndex = blocks[index]
            const blockId = localPaletteMap[blockIndex]
            
            // Skip air
            if (!blockId || blockId.includes('air')) {
              continue
            }
            
            // Optimization: Hidden Face Culling
            const visible = isBlockVisible(x, y, z, sizeX, sizeY, sizeZ, blocks)
            
            if (visible) {
              const worldX = startX + x
              const worldY = startY + y
              const worldZ = startZ + z
              
              tempMatrix.setPosition(worldX, worldY, worldZ)
              
              instances.push({
                color: getBlockColor(blockId),
                matrix: tempMatrix.clone(),
                id: blockIndex // Just for ref
              })
              visibleCount++;
            }
          }
        }
      }
      console.log(`Region ${regionName}: Total Blocks=${volume}, Visible Instances=${visibleCount}`);
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

  }, [nbtData])

  return (
    <div style={{ width: '100%', height: '600px', background: '#111', borderRadius: '8px', overflow: 'hidden' }}>
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
