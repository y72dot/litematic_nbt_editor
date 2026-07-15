import { mat4, vec3 } from 'gl-matrix';

// Simple shader for drawing colored lines
const VS_SOURCE = `
attribute vec3 a_position;
attribute vec3 a_color;
uniform mat4 u_view;
uniform mat4 u_proj;
// Add bias uniform to push geometry towards camera to avoid z-fighting
uniform float u_depthBias; 
varying vec3 v_color;
void main() {
    vec4 pos = u_proj * u_view * vec4(a_position, 1.0);
    // Apply depth bias in NDC space (-1 to 1)
    // A negative bias pulls vertices closer to the near plane
    pos.z += u_depthBias * pos.w;
    gl_Position = pos;
    v_color = a_color;
}
`;

const FS_SOURCE = `
precision mediump float;
varying vec3 v_color;
void main() {
    gl_FragColor = vec4(v_color, 1.0);
}
`;

export class LineRenderer {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private positionBuffer: WebGLBuffer;
    private colorBuffer: WebGLBuffer;
    
    private a_position: number;
    private a_color: number;
    private u_view: WebGLUniformLocation;
    private u_proj: WebGLUniformLocation;
    private u_depthBias: WebGLUniformLocation;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        
        // Compile Shaders
        const vs = this.compileShader(gl.VERTEX_SHADER, VS_SOURCE);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
        
        this.program = gl.createProgram()!;
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('LineRenderer shader link error: ' + gl.getProgramInfoLog(this.program));
        }

        // Get Locations
        this.a_position = gl.getAttribLocation(this.program, 'a_position');
        this.a_color = gl.getAttribLocation(this.program, 'a_color');
        this.u_view = gl.getUniformLocation(this.program, 'u_view')!;
        this.u_proj = gl.getUniformLocation(this.program, 'u_proj')!;
        this.u_depthBias = gl.getUniformLocation(this.program, 'u_depthBias')!;

        // Create Buffers
        this.positionBuffer = gl.createBuffer()!;
        this.colorBuffer = gl.createBuffer()!;
    }

    private compileShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error('LineRenderer shader compile error: ' + this.gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    public drawAxes(viewMatrix: mat4, projMatrix: mat4, length: number = 1000) {
        const positions: number[] = [
            -length, 0, 0,  length, 0, 0, // X
            0, -length, 0,  0, length, 0, // Y
            0, 0, -length,  0, 0, length  // Z
        ];
        
        const colors: number[] = [
            1, 0, 0,  1, 0, 0, // Red
            0, 1, 0,  0, 1, 0, // Green
            0, 0, 1,  0, 0, 1  // Blue
        ];

        // Use a small negative bias to pull axes towards the camera
        // so they render on top of co-planar geometry like the grid or box
        this.draw(viewMatrix, projMatrix, positions, colors, -0.0001);
    }

    public drawBox(viewMatrix: mat4, projMatrix: mat4, min: vec3, max: vec3, color: vec3) {
        // 8 corners
        const p000 = [min[0], min[1], min[2]];
        const p100 = [max[0], min[1], min[2]];
        const p010 = [min[0], max[1], min[2]];
        const p110 = [max[0], max[1], min[2]];
        const p001 = [min[0], min[1], max[2]];
        const p101 = [max[0], min[1], max[2]];
        const p011 = [min[0], max[1], max[2]];
        const p111 = [max[0], max[1], max[2]];

        const positions: number[] = [];
        
        // Helper to add line segment
        const addLine = (p1: number[], p2: number[]) => {
            positions.push(...p1, ...p2);
        };

        // Bottom face
        addLine(p000, p100); addLine(p100, p110); addLine(p110, p010); addLine(p010, p000);
        // Top face
        addLine(p001, p101); addLine(p101, p111); addLine(p111, p011); addLine(p011, p001);
        // Verticals
        addLine(p000, p001); addLine(p100, p101); addLine(p110, p111); addLine(p010, p011);

        const colors: number[] = [];
        for (let i = 0; i < positions.length / 3; i++) {
            colors.push(color[0], color[1], color[2]);
        }

        this.draw(viewMatrix, projMatrix, positions, colors);
    }

    private draw(viewMatrix: mat4, projMatrix: mat4, positions: number[], colors: number[], depthBias: number = 0) {
        const gl = this.gl;

        gl.useProgram(this.program);

        // Upload Positions
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.a_position);
        gl.vertexAttribPointer(this.a_position, 3, gl.FLOAT, false, 0, 0);

        // Upload Colors
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.a_color);
        gl.vertexAttribPointer(this.a_color, 3, gl.FLOAT, false, 0, 0);

        // Set Uniforms
        gl.uniformMatrix4fv(this.u_view, false, viewMatrix);
        gl.uniformMatrix4fv(this.u_proj, false, projMatrix);
        gl.uniform1f(this.u_depthBias, depthBias);

        // Draw
        gl.drawArrays(gl.LINES, 0, positions.length / 3);
    }
}
