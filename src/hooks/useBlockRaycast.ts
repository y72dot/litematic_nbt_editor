import { useCallback, useRef, useState } from 'react';
import { mat4, vec3 } from 'gl-matrix';
import { Structure } from 'deepslate';
import { Raycaster, type RaycastResult } from '../utils/Raycaster';

interface UseBlockRaycastProps {
    structure: Structure | null;
    canvas: HTMLCanvasElement | null;
    viewMatrix: mat4 | null;
    projMatrix: mat4 | null;
    cameraPos: vec3;
    cameraFront: vec3;
}

export function useBlockRaycast() {
    const [highlightedBlock, setHighlightedBlock] = useState<RaycastResult | null>(null);
    
    // We use a ref for the latest props to avoid re-creating the event handler constantly
    const propsRef = useRef<UseBlockRaycastProps>({
        structure: null,
        canvas: null,
        viewMatrix: null,
        projMatrix: null,
        cameraPos: vec3.create(),
        cameraFront: vec3.create(),
    });

    const updateProps = (props: UseBlockRaycastProps) => {
        propsRef.current = props;
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const { structure, canvas, viewMatrix, projMatrix, cameraPos } = propsRef.current;

        if (!structure || !canvas || !viewMatrix || !projMatrix) return;

        // Get ray from screen coordinates
        const ray = Raycaster.getRayFromScreen(
            e.clientX,
            e.clientY,
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
            
            // Consider air blocks as non-solid (or any other logic you want)
            // 'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'
            // Defensive check for block.getName
            if (!block) return false;
            
            let blockName = '';
            if (typeof block.getName === 'function') {
                blockName = block.getName();
            } else if ((block as any).name) {
                blockName = (block as any).name;
            } else {
                // If we can't determine the name, assume it's solid unless it's null/undefined
                // But for safety, let's log once if needed, or just proceed
                // console.warn('Unknown block structure:', block);
                // For now, let's assume if it exists, it's a block. 
                // However, structure.getBlock usually returns null for air in some impls, 
                // but deepslate usually returns a block state for air.
                
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
        // console.log('Tracing ray from', cameraPos, 'dir', ray.direction);
        const result = Raycaster.traceRay(ray.origin, ray.direction, 100, isBlockSolid);

        if (result) {
            // Only update state if the block position changed to avoid excessive re-renders
            setHighlightedBlock(prev => {
                if (!prev || 
                    prev.position[0] !== result.position[0] || 
                    prev.position[1] !== result.position[1] || 
                    prev.position[2] !== result.position[2]) {
                    
                    console.log('Raycast Hit:', result.position);
                    return result;
                }
                return prev;
            });
        } else {
            setHighlightedBlock(prev => prev ? null : prev);
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHighlightedBlock(null);
    }, []);

    return {
        highlightedBlock,
        updateRaycastProps: updateProps,
        onRaycastMouseMove: handleMouseMove,
        onRaycastMouseLeave: handleMouseLeave
    };
}
