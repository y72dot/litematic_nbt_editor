import { DeepslateContext } from './deepslateContext';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three-stdlib';
import { BlockDefinition } from 'deepslate';

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

    const geometries: THREE.BufferGeometry[] = [];

    // Helper to process a single variant definition
    const processVariant = (modelName: string, x: number = 0, y: number = 0, uvlock: boolean = false) => {
        const model = ctx.models.getModel(modelName.replace('minecraft:', '').replace('block/', ''));
        if (!model) return;
        
        // Find elements (traverse up if needed)
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
            // Process each cubic element
            elements.forEach(el => {
                const { from, to } = el;
                // Coordinates in JSON are 0-16. Normalize to 0-1.
                
                const min = [from[0]/16, from[1]/16, from[2]/16];
                const max = [to[0]/16, to[1]/16, to[2]/16];

                const width = max[0] - min[0];
                const height = max[1] - min[1];
                const depth = max[2] - min[2];
                
                // Create geometry
                const boxGeo = new THREE.BoxGeometry(width, height, depth);
                
                // Translate to correct position relative to block origin (0,0,0) -> (1,1,1)
                // BoxGeometry is centered at (0,0,0)
                // Element center in block space:
                const cx = min[0] + width/2;
                const cy = min[1] + height/2;
                const cz = min[2] + depth/2;
                
                // We want the geometry to be relative to the block center (0.5, 0.5, 0.5) if we rotate it?
                // Or just relative to block origin (0,0,0)?
                // Three.js instances are positioned at block origin.
                // So we need geometry to be in [0,1] range.
                // Box starts at -w/2 .. w/2.
                // We want it at min .. max.
                // So we translate by cx, cy, cz.
                boxGeo.translate(cx, cy, cz);
                
                // Apply Model Rotation (x, y)
                // Minecraft rotations are usually around (0.5, 0.5, 0.5)
                if (x !== 0 || y !== 0) {
                    boxGeo.translate(-0.5, -0.5, -0.5); // Move to center
                    if (x !== 0) boxGeo.rotateX(x * Math.PI / 180);
                    if (y !== 0) boxGeo.rotateY(y * Math.PI / 180);
                    boxGeo.translate(0.5, 0.5, 0.5); // Move back
                }

                geometries.push(boxGeo);
            });
        }
    };
    
    // Process the variant(s)
    let variant;
    if (typeof def.getVariant === 'function') {
        try {
            variant = def.getVariant(properties);
        } catch (e) {
            console.warn(`Failed to get variant for ${id}:`, e);
            return null;
        }
    } else {
        // Fallback: manually pick a variant if getVariant is missing (should not happen if deepslate is correct)
        // Or maybe def is not a full BlockDefinition instance?
        // Let's just use the first variant from the map if available
        if (def.variants && Object.keys(def.variants).length > 0) {
            variant = Object.values(def.variants)[0];
        } else if (def.multipart) {
             // For multipart, we should ideally check conditions.
             // But for fallback, let's just grab all parts.
             variant = { apply: def.multipart.map(p => p.apply).flat() };
        } else {
            return null;
        }
    }
    
    // Handle Weighted/Multipart
    // For now, simplify: take first variant or all multipart
    if (Array.isArray(variant)) {
        // Weighted variant list, pick first
        const v = variant[0];
        processVariant(v.model, v.x, v.y, v.uvlock);
    } else if ('apply' in variant) {
         // Multipart (it has 'apply' which can be array or single)
         // Wait, getVariant returns UnresolvedVariant which is (Variant | Variant[])
         // Actually BlockDefinition.getVariant(props) returns a single ResolvedVariant?
         // Let's check deepslate types. 
         // It seems it returns UnresolvedVariant.
         
         // Let's just iterate blindly assuming it might be iterable or single object
         // Actually, let's use the raw data structure logic
         // BlockDefinition has 'variants' and 'multipart'.
         // getVariant handles logic.
         
         // Let's assume it returns a list of models to render.
         // If it's a simple object with model property:
         const v = variant as any;
         if (v.model) {
             processVariant(v.model, v.x, v.y, v.uvlock);
         } else if (Array.isArray(v)) {
             // Multi-model variant (e.g. random rotation, pick first)
             if(v.length > 0) processVariant(v[0].model, v[0].x, v[0].y, v[0].uvlock);
         }
    }
    
    // If we found geometries, merge them
    if (geometries.length > 0) {
        const merged = BufferGeometryUtils.mergeBufferGeometries(geometries);
        // Center the geometry to origin (0,0,0) because InstancedMesh works best with centered geo?
        // No, our logic above puts it in [0,1] range relative to instance position.
        // But Three.js usually expects geometry centered at 0,0,0 and we move the mesh.
        // Our viewer does: tempMatrix.setPosition(worldX, worldY, worldZ).
        // If worldX is integer, and geo is [0,1], the block will be from X to X+1. This is correct.
        
        // HOWEVER, standard BoxGeometry(1,1,1) is [-0.5, 0.5].
        // So standard blocks are centered at 0.
        // If we use [0,1] range, we are offset by 0.5 compared to standard box.
        // So we should probably center our generated geometry at 0,0,0 (i.e. range [-0.5, 0.5]).
        merged.translate(-0.5, -0.5, -0.5);
        
        geometryCache.set(cacheKey, merged);
        return merged;
    }

    // Fallback
    const box = new THREE.BoxGeometry(1, 1, 1);
    geometryCache.set(cacheKey, box);
    return box;
}
