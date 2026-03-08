import { useCallback, useRef } from 'react';
import { mat4 } from 'gl-matrix';
import { Structure } from 'deepslate';
import { Raycaster, type RaycastResult } from '../utils/Raycaster';

export function useBlockRaycast() {
    // Store mouse position in a Ref, not State
    // { x: clientX, y: clientY }
    const mousePosRef = useRef<{ x: number, y: number } | null>(null);

    // This method is called every frame inside requestAnimationFrame
    const getHighlightBlock = useCallback((
        structure: Structure | null,
        canvas: HTMLCanvasElement | null,
        viewMatrix: mat4,
        projMatrix: mat4
    ): RaycastResult | null => {
        const mousePos = mousePosRef.current;
        if (!mousePos || !structure || !canvas) return null;

        // Get ray from screen coordinates
        const ray = Raycaster.getRayFromScreen(
            mousePos.x,
            mousePos.y,
            canvas,
            viewMatrix,
            projMatrix
        );

        // Define the block check function
        const isBlockSolid = (x: number, y: number, z: number) => {
            // Check bounds first
            const size = structure.getSize();
            if (x < 0 || y < 0 || z < 0 || x >= size[0] || y >= size[1] || z >= size[2]) {
                return false;
            }
            
            // Get block at position
            const block = structure.getBlock([x, y, z]);
            
            // Consider air blocks as non-solid
            // Defensive check for block.getName
            if (!block) return false;
            
            let blockName = '';
            if (typeof block.getName === 'function') {
                blockName = block.getName();
            } else if ((block as any).name) {
                blockName = (block as any).name;
            } else {
                // Fallback: try to coerce to string
                blockName = String(block);
            }
            
            if (blockName.includes('air')) {
                return false;
            }
            
            return true;
        };

        // Trace the ray
        // Max distance 100 blocks
        // Using ray.origin (on near plane) is correct for perspective projection
        return Raycaster.traceRay(ray.origin, ray.direction, 100, isBlockSolid);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseLeave = useCallback(() => {
        mousePosRef.current = null;
    }, []);

    return {
        getHighlightBlock,
        onRaycastMouseMove: handleMouseMove,
        onRaycastMouseLeave: handleMouseLeave
    };
}
