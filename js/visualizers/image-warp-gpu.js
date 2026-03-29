/* ============================================
   WebGL Image Warp — GPU-accelerated image layer
   rendering for LiquidShowVisualizer.

   Replaces the CPU per-pixel loop with a fragment
   shader that performs domain warping, noise-based
   distortion, hue shifting, and brightness boost.

   Falls back gracefully if WebGL is unavailable.
   ============================================ */

// Vertex shader — simple fullscreen quad
const VERT_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment shader — ports the CPU per-pixel warp loop to GLSL
const FRAG_SRC = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_scale;
uniform float u_drift;
uniform float u_rot;    // pre-computed rotation angle in radians
uniform float u_distortion;
uniform float u_turbulence;
uniform float u_audioMod;
uniform float u_hueShift;
uniform vec2 u_offset;

// --- Simplex 2D noise (Ashima Arts) ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                           + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                           dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 70.0 * dot(m, g);
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    value += amp * snoise(p * freq);
    amp *= 0.5;
    freq *= 2.0;
  }
  return value;
}

void main() {
  float audioScl = u_scale * (1.0 + u_audioMod * 0.4);
  float audioDist = u_distortion + u_audioMod * 1.0;

  // Normalized coords centered at origin
  vec2 n = (v_uv - 0.5) * audioScl * 2.0;

  // Rotation (pre-computed on CPU: rawTime * rotation * 0.2)
  float cosR = cos(u_rot);
  float sinR = sin(u_rot);
  vec2 r = vec2(n.x * cosR - n.y * sinR,
                n.x * sinR + n.y * cosR);
  n = r + vec2(u_time * u_drift * 0.3, u_time * u_drift * 0.2);

  // Domain warp
  float warpX = fbm(n * 0.8 + u_offset + vec2(0.0, u_time * 0.1), 2) * audioDist * 2.0;
  float warpY = fbm(n * 0.8 + u_offset + vec2(5.2, 1.3 + u_time * 0.08), 2) * audioDist * 2.0;

  // Turbulence ripple
  float ripple = 0.0;
  if (u_turbulence > 0.01) {
    ripple = snoise((n + vec2(warpX, warpY)) * 4.0 + vec2(0.0, u_time * 0.3))
             * u_turbulence * audioDist * 0.5;
  }

  // Map back to UV
  vec2 srcUV = (n + vec2(warpX, warpY) + ripple) / (audioScl * 2.0) + 0.5;
  srcUV = fract(srcUV); // wrap

  vec4 texColor = texture2D(u_texture, srcUV);
  vec3 rgb = texColor.rgb;

  // Hue shift — same matrix as CPU version
  if (u_hueShift > 0.01) {
    float angle = u_hueShift * 6.28318530718;
    float cs = cos(angle);
    float sn = sin(angle);
    mat3 hueMatrix = mat3(
      0.299 + 0.701 * cs - 0.168 * sn, 0.299 - 0.299 * cs + 0.328 * sn, 0.299 - 0.300 * cs - 1.250 * sn,
      0.587 - 0.587 * cs - 0.330 * sn, 0.587 + 0.413 * cs + 0.035 * sn, 0.587 - 0.588 * cs + 1.050 * sn,
      0.114 - 0.114 * cs + 0.498 * sn, 0.114 - 0.114 * cs - 0.363 * sn, 0.114 + 0.886 * cs + 0.203 * sn
    );
    rgb = clamp(hueMatrix * rgb, 0.0, 1.0);
  }

  // Audio brightness boost
  float brightBoost = 1.0 + u_audioMod * 0.6;
  rgb = min(rgb * brightBoost, 1.0);

  gl_FragColor = vec4(rgb, 1.0);
}
`;

export class ImageWarpGPU {
  constructor() {
    this._canvas = document.createElement('canvas');
    this._gl = null;
    this._program = null;
    this._texture = null;
    this._quadBuffer = null;
    this._uniforms = {};
    this._currentTextureKey = null;
    this._available = false;

    this._initGL();
  }

  get available() { return this._available; }

  _initGL() {
    const gl = this._canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return;

    // Compile shaders
    const vs = this._compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('ImageWarpGPU: program link failed', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Fullscreen quad
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Cache uniform locations
    const uniformNames = [
      'u_texture', 'u_time', 'u_scale', 'u_drift', 'u_rot',
      'u_distortion', 'u_turbulence', 'u_audioMod', 'u_hueShift', 'u_offset',
    ];
    const uniforms = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    // Create texture
    const texture = gl.createTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uniforms.u_texture, 0);

    this._gl = gl;
    this._program = program;
    this._texture = texture;
    this._quadBuffer = quadBuffer;
    this._uniforms = uniforms;
    this._available = true;
  }

  _compileShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('ImageWarpGPU: shader compile failed', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Upload image texture. Only re-uploads when image source changes.
   * @param {HTMLCanvasElement|HTMLImageElement} imgCanvas - cover-fitted image at buffer size
   * @param {string} textureKey - unique key to detect image changes
   */
  uploadTexture(imgCanvas, textureKey) {
    if (this._currentTextureKey === textureKey) return;
    const gl = this._gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgCanvas);
    this._currentTextureKey = textureKey;
  }

  /**
   * Force texture re-upload on next render (e.g. when buffer size changes).
   */
  invalidateTexture() {
    this._currentTextureKey = null;
  }

  /**
   * Render the warped image to the internal WebGL canvas.
   * @returns {HTMLCanvasElement} The WebGL canvas ready for drawImage() compositing
   */
  render(bw, bh, params) {
    const gl = this._gl;
    const u = this._uniforms;

    // Resize canvas if needed
    if (this._canvas.width !== bw || this._canvas.height !== bh) {
      this._canvas.width = bw;
      this._canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);

    // Set uniforms
    gl.uniform1f(u.u_time, params.time);
    gl.uniform1f(u.u_scale, params.scale);
    gl.uniform1f(u.u_drift, params.drift);
    gl.uniform1f(u.u_rot, params.rot);
    gl.uniform1f(u.u_distortion, params.distortion);
    gl.uniform1f(u.u_turbulence, params.turbulence);
    gl.uniform1f(u.u_audioMod, params.audioMod);
    gl.uniform1f(u.u_hueShift, params.hueShift);
    gl.uniform2f(u.u_offset, params.offsetX, params.offsetY);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return this._canvas;
  }

  destroy() {
    if (this._gl) {
      const ext = this._gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    this._gl = null;
    this._available = false;
  }
}
