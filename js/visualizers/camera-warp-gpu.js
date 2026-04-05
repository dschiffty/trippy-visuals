/* ============================================
   CameraWarpGPU — WebGL fragment shader warps
   for live camera feed processing.
   Offscreen WebGL canvas, composited back via
   drawImage() to the main 2D canvas.
   ============================================ */

const VERT_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// Shared uniforms: u_time, u_resolution, u_texture
const WARP_SHADERS = {
  none: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    void main() {
      gl_FragColor = texture2D(u_texture, v_texCoord);
    }
  `,

  ripple: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_time;
    void main() {
      vec2 uv = v_texCoord;
      float wave = sin(uv.y * 20.0 + u_time * 3.0) * 0.015;
      float wave2 = sin(uv.x * 15.0 + u_time * 2.5) * 0.01;
      uv.x += wave;
      uv.y += wave2;
      gl_FragColor = texture2D(u_texture, uv);
    }
  `,

  fisheye: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_time;
    void main() {
      vec2 uv = v_texCoord - 0.5;
      float r = length(uv);
      float theta = atan(uv.y, uv.x);
      // Barrel distortion with subtle time pulse
      float strength = 1.8 + sin(u_time * 0.5) * 0.2;
      float newR = pow(r, strength) * 1.5;
      vec2 distorted = vec2(cos(theta), sin(theta)) * newR + 0.5;
      if (distorted.x < 0.0 || distorted.x > 1.0 || distorted.y < 0.0 || distorted.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        gl_FragColor = texture2D(u_texture, distorted);
      }
    }
  `,

  kaleidoscope: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_time;
    void main() {
      vec2 uv = v_texCoord - 0.5;
      float angle = atan(uv.y, uv.x) + u_time * 0.3;
      float r = length(uv);
      // 6-fold symmetry
      float segments = 6.0;
      float segAngle = 3.14159265 * 2.0 / segments;
      angle = mod(angle, segAngle);
      // Mirror alternate segments
      if (mod(floor(atan(uv.y, uv.x) / segAngle + u_time * 0.3 / segAngle), 2.0) > 0.5) {
        angle = segAngle - angle;
      }
      vec2 kUV = vec2(cos(angle), sin(angle)) * r + 0.5;
      gl_FragColor = texture2D(u_texture, kUV);
    }
  `,

  tunnel: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_time;
    void main() {
      vec2 uv = v_texCoord - 0.5;
      float r = length(uv);
      float angle = atan(uv.y, uv.x);
      // Vortex: rotate more toward center
      angle += (1.0 - r) * 2.0 * sin(u_time * 0.5);
      // Zoom toward center
      float zoom = r + sin(u_time * 0.8) * 0.05;
      vec2 tunnelUV = vec2(cos(angle), sin(angle)) * zoom + 0.5;
      tunnelUV = clamp(tunnelUV, 0.0, 1.0);
      gl_FragColor = texture2D(u_texture, tunnelUV);
    }
  `,
};

export const WARP_MODES = ['none', 'ripple', 'fisheye', 'kaleidoscope', 'tunnel'];

export const WARP_LABELS = {
  none: 'None',
  ripple: 'Ripple',
  fisheye: 'Fisheye',
  kaleidoscope: 'Kaleidoscope',
  tunnel: 'Tunnel',
};

export class CameraWarpGPU {
  constructor() {
    this._canvas = document.createElement('canvas');
    this._gl = null;
    this._programs = {};    // compiled programs keyed by warp mode
    this._texture = null;
    this._posBuffer = null;
    this._texBuffer = null;
    this._currentMode = 'none';
    this._startTime = performance.now() / 1000;
    this._initialized = false;
  }

  get canvas() { return this._canvas; }

  _initGL() {
    if (this._initialized) return true;
    const gl = this._canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      console.warn('[CameraWarpGPU] WebGL not available');
      return false;
    }
    this._gl = gl;

    // Compile all shader programs
    for (const [mode, fragSrc] of Object.entries(WARP_SHADERS)) {
      const prog = this._compileProgram(VERT_SRC, fragSrc);
      if (prog) this._programs[mode] = prog;
    }

    // Fullscreen quad
    const positions = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    this._posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoords = new Float32Array([0,1, 1,1, 0,0, 1,0]); // flip Y for video
    this._texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // Texture for camera frame
    this._texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this._initialized = true;
    return true;
  }

  _compileProgram(vertSrc, fragSrc) {
    const gl = this._gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('[CameraWarpGPU] Vertex shader:', gl.getShaderInfoLog(vs));
      return null;
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('[CameraWarpGPU] Fragment shader:', gl.getShaderInfoLog(fs));
      return null;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[CameraWarpGPU] Link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    // Cache attribute/uniform locations
    prog._aPosition = gl.getAttribLocation(prog, 'a_position');
    prog._aTexCoord = gl.getAttribLocation(prog, 'a_texCoord');
    prog._uTexture = gl.getUniformLocation(prog, 'u_texture');
    prog._uTime = gl.getUniformLocation(prog, 'u_time');
    prog._uResolution = gl.getUniformLocation(prog, 'u_resolution');
    return prog;
  }

  /**
   * Process a video element through the warp shader.
   * @param {HTMLVideoElement} video - source video
   * @param {number} width - output width
   * @param {number} height - output height
   * @param {string} mode - warp mode key
   * @param {boolean} mirror - mirror horizontally (front camera)
   * @returns {HTMLCanvasElement} the offscreen canvas with warped result
   */
  process(video, width, height, mode, mirror) {
    if (mode === 'none' && !mirror) return null; // signal to use direct draw
    if (!this._initGL()) return null;

    const gl = this._gl;
    const prog = this._programs[mode] || this._programs.none;
    if (!prog) return null;

    // Resize offscreen canvas if needed
    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width;
      this._canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);

    // Upload video frame as texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(prog._uTexture, 0);

    // Time uniform
    const time = performance.now() / 1000 - this._startTime;
    if (prog._uTime !== null) gl.uniform1f(prog._uTime, time);
    if (prog._uResolution !== null) gl.uniform2f(prog._uResolution, width, height);

    // Bind position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuffer);
    gl.enableVertexAttribArray(prog._aPosition);
    gl.vertexAttribPointer(prog._aPosition, 2, gl.FLOAT, false, 0, 0);

    // Bind texcoord attribute — handle mirror by flipping U coordinates
    if (mirror) {
      const mirroredCoords = new Float32Array([1,1, 0,1, 1,0, 0,0]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._texBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mirroredCoords, gl.DYNAMIC_DRAW);
    } else {
      const normalCoords = new Float32Array([0,1, 1,1, 0,0, 1,0]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._texBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, normalCoords, gl.DYNAMIC_DRAW);
    }
    gl.enableVertexAttribArray(prog._aTexCoord);
    gl.vertexAttribPointer(prog._aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return this._canvas;
  }

  destroy() {
    if (this._gl) {
      const gl = this._gl;
      for (const prog of Object.values(this._programs)) {
        gl.deleteProgram(prog);
      }
      if (this._texture) gl.deleteTexture(this._texture);
      if (this._posBuffer) gl.deleteBuffer(this._posBuffer);
      if (this._texBuffer) gl.deleteBuffer(this._texBuffer);
      this._gl = null;
    }
    this._programs = {};
    this._texture = null;
    this._initialized = false;
  }
}
