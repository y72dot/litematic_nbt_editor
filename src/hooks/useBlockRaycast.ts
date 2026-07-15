import { useCallback, useRef } from 'react';
import { mat4 } from 'gl-matrix';
import type { Schematic } from '../core/Schematic';
import { Raycaster, type RaycastResult } from '../utils/Raycaster';

export function useBlockRaycast() {
    const mousePosRef = useRef<{ x: number, y: number } | null>(null);

    const getHighlightBlock = useCallback((
        schematic: Schematic | null,
        minOffset: { x: number; y: number; z: number },
        size: [number, number, number],
        canvas: HTMLCanvasElement | null,
        viewMatrix: mat4,
        projMatrix: mat4,
    ): RaycastResult | null => {
        const mousePos = mousePosRef.current;
        if (!mousePos || !schematic || !canvas) return null;

        const ray = Raycaster.getRayFromScreen(
            mousePos.x, mousePos.y, canvas, viewMatrix, projMatrix,
        );

        const isBlockSolid = (x: number, y: number, z: number) => {
            if (x < 0 || y < 0 || z < 0 || x >= size[0] || y >= size[1] || z >= size[2]) {
                return false;
            }
            const block = schematic.getBlock(
                x + minOffset.x,
                y + minOffset.y,
                z + minOffset.z,
            );
            if (!block) return false;
            return !block.Name.includes('air');
        };

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
        onRaycastMouseLeave: handleMouseLeave,
    };
}
