import { mat4, vec3 } from 'gl-matrix';

const VS_SOURCE = `
attribute vec3 a_position;
uniform mat4 u_view;
uniform mat4 u_proj;
uniform vec4 u_color;
varying vec4 v_color;
void main() {
    gl_Position = u_proj * u_view * vec4(a_position, 1.0);
    v_color = u_color;
}
`;

const FS_SOURCE = `
precision mediump float;
varying vec4 v_color;
void main() {
    gl_FragColor = v_color;
}
`;

/**
 * Renders semi-transparent filled boxes using WebGL TRIANGLES.
 * Designed to share a WebGL context with StructureRenderer and LineRenderer.
 * Manages its own blend state (pushed/popped per draw call).
 */
export class FilledBoxRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;

  private a_position: number;
  private u_view: WebGLUniformLocation;
  private u_proj: WebGLUniformLocation;
  private u_color: WebGLUniformLocation;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('FilledBoxRenderer shader link error: ' + gl.getProgramInfoLog(this.program));
    }

    this.a_position = gl.getAttribLocation(this.program, 'a_position');
    this.u_view = gl.getUniformLocation(this.program, 'u_view')!;
    this.u_proj = gl.getUniformLocation(this.program, 'u_proj')!;
    this.u_color = gl.getUniformLocation(this.program, 'u_color')!;

    this.buffer = gl.createBuffer()!;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('FilledBoxRenderer shader compile error: ' + this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  /**
   * Generate 36 vertices (12 triangles, 6 faces) for a unit box
   * spanning from (minX,minY,minZ) to (maxX,maxY,maxZ).
   */
  private boxVertices(min: vec3, max: vec3): Float32Array {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;

    // 6 faces × 2 triangles × 3 vertices = 36 vertices
    // Each face: ccw winding from outside looking in
    return new Float32Array([
      // +X face
      x1, y0, z0,  x1, y1, z1,  x1, y0, z1,
      x1, y0, z0,  x1, y1, z0,  x1, y1, z1,
      // -X face
      x0, y0, z0,  x0, y0, z1,  x0, y1, z1,
      x0, y0, z0,  x0, y1, z1,  x0, y1, z0,
      // +Y face
      x0, y1, z0,  x1, y1, z1,  x0, y1, z1,
      x0, y1, z0,  x1, y1, z0,  x1, y1, z1,
      // -Y face
      x0, y0, z0,  x0, y0, z1,  x1, y0, z1,
      x0, y0, z0,  x1, y0, z1,  x1, y0, z0,
      // +Z face
      x0, y0, z1,  x1, y1, z1,  x1, y0, z1,
      x0, y0, z1,  x0, y1, z1,  x1, y1, z1,
      // -Z face
      x0, y0, z0,  x1, y0, z0,  x1, y1, z0,
      x0, y0, z0,  x1, y1, z0,  x0, y1, z0,
    ]);
  }

  /** Render a single semi-transparent filled box. */
  drawFilledBox(
    view: mat4, proj: mat4,
    min: [number, number, number],
    max: [number, number, number],
    color: [number, number, number, number],
  ) {
    const vertices = this.boxVertices(
      vec3.fromValues(min[0], min[1], min[2]),
      vec3.fromValues(max[0], max[1], max[2]),
    );
    this.drawBatch(view, proj, vertices, color);
  }

  /** Render multiple filled boxes of the same color in one draw call. */
  drawFilledBoxes(
    view: mat4, proj: mat4,
    boxes: Array<{ min: [number, number, number]; max: [number, number, number] }>,
    color: [number, number, number, number],
  ) {
    if (boxes.length === 0) return;

    const allVertices: number[] = [];
    for (const box of boxes) {
      const v = this.boxVertices(
        vec3.fromValues(box.min[0], box.min[1], box.min[2]),
        vec3.fromValues(box.max[0], box.max[1], box.max[2]),
      );
      allVertices.push(...v);
    }

    this.drawBatch(view, proj, new Float32Array(allVertices), color);
  }

  private drawBatch(
    view: mat4, proj: mat4,
    vertices: Float32Array,
    color: [number, number, number, number],
  ) {
    const gl = this.gl;

    // Save current blend state
    const wasBlend = gl.isEnabled(gl.BLEND);
    const oldSrcRgb = gl.getParameter(gl.BLEND_SRC_RGB);
    const oldDstRgb = gl.getParameter(gl.BLEND_DST_RGB);

    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.a_position);
    gl.vertexAttribPointer(this.a_position, 3, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(this.u_view, false, view);
    gl.uniformMatrix4fv(this.u_proj, false, proj);
    gl.uniform4fv(this.u_color, color);

    // Disable depth write but keep depth test for correct occlusion
    const wasDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
    gl.depthMask(wasDepthMask);

    // Restore blend state
    if (!wasBlend) gl.disable(gl.BLEND);
    else gl.blendFunc(oldSrcRgb as number, oldDstRgb as number);
  }

  dispose() {
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.buffer);
  }
}
