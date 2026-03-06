import { DeepslateContext } from './deepslateContext';
import * as THREE from 'three';
import { Identifier } from 'deepslate';

// Cache for geometries to avoid regenerating the same mesh repeatedly
const geometryCache = new Map<string, THREE.BufferGeometry>();

export async function getBlockGeometry(
    ctx: DeepslateContext, 
    blockName: string, 
    properties: Record<string, string>
): Promise<THREE.BufferGeometry | null> {
    
    // Normalize blockName
    const id = blockName.replace('minecraft:', '');
    const cacheKey = `${id}:${JSON.stringify(properties)}`;
    
    if (geometryCache.has(cacheKey)) {
        return geometryCache.get(cacheKey)!;
    }

    // Ensure block is loaded
    await ctx.loadBlock(id);

    const def = ctx.blockDefinitions.get(id);
    if (!def) {
        // Fallback for unknown blocks: standard cube
        const box = new THREE.BoxGeometry(1, 1, 1);
        geometryCache.set(cacheKey, box);
        return box;
    }

    // Deepslate Parsing Logic
    const variant = def.getVariant(properties);
    
    // Collect all models that make up this variant (could be multipart or simple)
    // Deepslate's type definitions are a bit tricky here.
    // getVariant returns UnresolvedVariant, which can be weighted or simple.
    // For now, let's assume simple cases or pick the first weighted option.
    
    const geometries: THREE.BufferGeometry[] = [];

    // Helper to process a single variant definition
    const processVariant = (modelName: string, x: number = 0, y: number = 0, uvlock: boolean = false) => {
        const model = ctx.models.getModel(modelName.replace('minecraft:', '').replace('block/', ''));
        if (!model) return;
        
        // Flatten model to get all elements (cubes)
        // Deepslate BlockModel has methods to resolve textures and elements?
        // Actually we need to walk up the parent chain to merge elements.
        // But BlockModel.fromJson might not do full resolution.
        // Let's manually traverse or check if Deepslate exposes resolution.
        // Deepslate's BlockModel doesn't have a 'resolve' method exposed easily.
        // We might need to implement element merging ourselves.
        
        // For this MVP, let's assume we can get elements. 
        // If elements are missing, check parent.
        
        let elements = model.elements;
        let currentModel = model;
        while (!elements && currentModel.parent) {
             const parentName = currentModel.parent.replace('minecraft:', '').replace('block/', '');
             currentModel = ctx.models.getModel(parentName)!;
             if (currentModel) {
                 elements = currentModel.elements;
             } else {
                 break;
             }
        }

        if (elements) {
            const geo = new THREE.BufferGeometry();
            const vertices: number[] = [];
            const uvs: number[] = [];
            const indices: number[] = [];
            let indexOffset = 0;

            // Process each cubic element
            elements.forEach(el => {
                const { from, to, faces } = el;
                // Coordinates in JSON are 0-16. Normalize to 0-1.
                // And center them? Three.js BoxGeometry is centered at 0,0,0.
                // But Minecraft models are 0 to 1.
                // Let's use 0 to 1 coordinate system to match instances.
                
                const min = [from[0]/16, from[1]/16, from[2]/16];
                const max = [to[0]/16, to[1]/16, to[2]/16];

                // Faces: north, south, east, west, up, down
                for (const [dir, face] of Object.entries(faces)) {
                    // Generate 4 vertices for this face
                    // ... (Vertex generation logic is complex, skipping for brevity in this step)
                    // We will implement a simplified version: BoxGeometry with transformed vertices.
                    
                    // Actually, manual vertex generation is better.
                    // Let's generate a simple box for the element first.
                    
                    const width = max[0] - min[0];
                    const height = max[1] - min[1];
                    const depth = max[2] - min[2];
                    const centerX = min[0] + width/2;
                    const centerY = min[1] + height/2;
                    const centerZ = min[2] + depth/2;
                    
                    const boxGeo = new THREE.BoxGeometry(width, height, depth);
                    boxGeo.translate(centerX - 0.5, centerY - 0.5, centerZ - 0.5); 
                    // Shift to match Three.js center (0,0,0) -> Minecraft center (0.5, 0.5, 0.5)
                    // Wait, our LitematicViewer instances are positioned at integer coordinates.
                    // So we want the block to fit in [0,1].
                    // BoxGeometry(1,1,1) is from -0.5 to 0.5.
                    // So we need to shift by 0.5 if we want 0..1?
                    // No, usually we center at 0.5,0.5,0.5 in world.
                    // Our Viewer does: tempMatrix.setPosition(worldX, worldY, worldZ)
                    // This sets the origin (0,0,0) of the instance.
                    // So the geometry should be centered at 0.5, 0.5, 0.5 relative to origin?
                    // Or centered at 0? 
                    // Standard BoxGeometry is centered at 0.
                    // If we position at x,y,z, the box spans x-0.5 to x+0.5.
                    // But Minecraft blocks span x to x+1.
                    // So we should translate geometry by +0.5.
                    boxGeo.translate(0.5, 0.5, 0.5);
                    
                    // Now apply element offset
                    // min/max are 0..1 relative to block origin.
                    // boxGeo is now 0..width/height/depth at 0.5,0.5,0.5? No.
                    
                    // Let's reset.
                    // 1. Create Box of size (w,h,d). Centered at (0,0,0).
                    // 2. Translate to center of element: (min + max)/2.
                    // 3. Now it is in 0..1 space relative to block origin.
                    
                    const elementCenter = [min[0] + width/2, min[1] + height/2, min[2] + depth/2];
                    const subBox = new THREE.BoxGeometry(width, height, depth);
                    subBox.translate(elementCenter[0], elementCenter[1], elementCenter[2]);
                    
                    // Apply Rotation (x,y) from variant
                    // Note: Minecraft rotations are around center (0.5, 0.5, 0.5) usually?
                    // Or specific pivots. Deepslate handles pivots in elements.
                    
                    // ... This is getting complicated to do manually.
                    // For now, let's just MERGE the geometries.
                    geometries.push(subBox);
                }
            });
            
            // Merge all element geometries
            // const merged = BufferGeometryUtils.mergeBufferGeometries(geometries); // Need to import Utils
        }
    };
    
    // Simplified logic: Just use the first variant model and make a box if it exists
    // To properly support this, we need to iterate `variant` which might be array or object.
    
    // TODO: Full implementation
    const box = new THREE.BoxGeometry(1, 1, 1);
    geometryCache.set(cacheKey, box);
    return box;
}
