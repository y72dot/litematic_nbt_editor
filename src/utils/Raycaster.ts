import { mat4, vec3 } from 'gl-matrix';

/**
 * Interface for the result of a raycast
 */
export interface RaycastResult {
    position: vec3; // The integer coordinates of the block that was hit
    normal: vec3;   // The normal of the face that was hit
    dist: number;   // Distance from ray origin
}

/**
 * A utility class for performing raycasts in a voxel grid
 */
export class Raycaster {
    
    /**
     * Unprojects a 2D screen coordinate to a 3D ray in world space
     * @param clientX Mouse X coordinate
     * @param clientY Mouse Y coordinate
     * @param canvas The canvas element
     * @param viewMatrix The view matrix (camera transform)
     * @param projMatrix The projection matrix
     * @returns Object containing ray origin and normalized direction
     */
    public static getRayFromScreen(
        clientX: number,
        clientY: number,
        canvas: HTMLCanvasElement,
        viewMatrix: mat4,
        projMatrix: mat4
    ): { origin: vec3, direction: vec3 } {
        const rect = canvas.getBoundingClientRect();
        
        // Convert to Normalized Device Coordinates (NDC)
        // range [-1, 1], y is inverted
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        
        // Create the inverse view-projection matrix
        const invViewProj = mat4.create();
        mat4.multiply(invViewProj, projMatrix, viewMatrix);
        mat4.invert(invViewProj, invViewProj);
        
        // Unproject two points: one on near plane (z=-1) and one on far plane (z=1)
        const nearPoint = vec3.fromValues(x, y, -1);
        const farPoint = vec3.fromValues(x, y, 1);
        
        vec3.transformMat4(nearPoint, nearPoint, invViewProj);
        vec3.transformMat4(farPoint, farPoint, invViewProj);
        
        // Ray origin is the camera position (near point)
        const origin = vec3.clone(nearPoint);
        
        // Ray direction is normalized vector from near to far
        const direction = vec3.create();
        vec3.subtract(direction, farPoint, nearPoint);
        vec3.normalize(direction, direction);
        
        return { origin, direction };
    }

    /**
     * Performs a voxel traversal (3D DDA algorithm) to find the first solid block
     * @param origin Ray start position
     * @param direction Ray direction (must be normalized)
     * @param maxDistance Maximum distance to trace
     * @param isBlockSolid Callback to check if a block exists at (x,y,z)
     * @returns The hit result or null if nothing was hit
     */
    public static traceRay(
        origin: vec3,
        direction: vec3,
        maxDistance: number,
        isBlockSolid: (x: number, y: number, z: number) => boolean
    ): RaycastResult | null {
        // Initial block coordinates
        let x = Math.floor(origin[0]);
        let y = Math.floor(origin[1]);
        let z = Math.floor(origin[2]);

        // Direction signs
        const stepX = Math.sign(direction[0]);
        const stepY = Math.sign(direction[1]);
        const stepZ = Math.sign(direction[2]);

        // Distance to the next block boundary
        // tMax is the distance along the ray to the next grid boundary
        // tDelta is the distance along the ray to travel 1 unit in the component direction
        
        let tMaxX, tMaxY, tMaxZ;
        const tDeltaX = stepX !== 0 ? Math.abs(1 / direction[0]) : Infinity;
        const tDeltaY = stepY !== 0 ? Math.abs(1 / direction[1]) : Infinity;
        const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction[2]) : Infinity;

        // Initialize tMax
        if (stepX > 0) {
            tMaxX = (Math.floor(origin[0]) + 1 - origin[0]) * tDeltaX;
        } else {
            tMaxX = (origin[0] - Math.floor(origin[0])) * tDeltaX;
        }

        if (stepY > 0) {
            tMaxY = (Math.floor(origin[1]) + 1 - origin[1]) * tDeltaY;
        } else {
            tMaxY = (origin[1] - Math.floor(origin[1])) * tDeltaY;
        }

        if (stepZ > 0) {
            tMaxZ = (Math.floor(origin[2]) + 1 - origin[2]) * tDeltaZ;
        } else {
            tMaxZ = (origin[2] - Math.floor(origin[2])) * tDeltaZ;
        }

        // Track the face that was entered
        let lastFaceNormal = vec3.create();
        
        // It's possible we start inside a block
        if (isBlockSolid(x, y, z)) {
            // If we start inside, we can consider the normal to be opposite of ray direction
            // or just use a default. For editing, we usually want the 'entry' face.
            // But if we are *inside*, maybe we shouldn't select it?
            // For now, let's just return it.
             return {
                position: vec3.fromValues(x, y, z),
                normal: vec3.fromValues(-stepX, -stepY, -stepZ), // Approximate
                dist: 0
            };
        }

        // Stepping loop
        let dist = 0;
        while (dist < maxDistance) {
            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    x += stepX;
                    dist = tMaxX;
                    tMaxX += tDeltaX;
                    vec3.set(lastFaceNormal, -stepX, 0, 0);
                } else {
                    z += stepZ;
                    dist = tMaxZ;
                    tMaxZ += tDeltaZ;
                    vec3.set(lastFaceNormal, 0, 0, -stepZ);
                }
            } else {
                if (tMaxY < tMaxZ) {
                    y += stepY;
                    dist = tMaxY;
                    tMaxY += tDeltaY;
                    vec3.set(lastFaceNormal, 0, -stepY, 0);
                } else {
                    z += stepZ;
                    dist = tMaxZ;
                    tMaxZ += tDeltaZ;
                    vec3.set(lastFaceNormal, 0, 0, -stepZ);
                }
            }

            if (dist > maxDistance) break;

            if (isBlockSolid(x, y, z)) {
                return {
                    position: vec3.fromValues(x, y, z),
                    normal: vec3.clone(lastFaceNormal),
                    dist: dist
                };
            }
        }

        return null;
    }
}
