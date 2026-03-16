/* ============================================
   Liquid Lights — Psychedelic Liquid Light Show
   ============================================ */

import { GALLERY_IMAGES, getGalleryImage, getGalleryThumbnail } from '../image-gallery.js';

// --- Simplex 2D Noise ---
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
const PERM = new Uint8Array(512);
const PERM_MOD8 = new Uint8Array(512);
(function seedNoise() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
    PERM_MOD8[i] = PERM[i] & 7;
  }
})();

function noise2D(x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s), j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { t0 *= t0; const g = GRAD2[PERM_MOD8[ii + PERM[jj]]]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { t1 *= t1; const g = GRAD2[PERM_MOD8[ii + i1 + PERM[jj + j1]]]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { t2 *= t2; const g = GRAD2[PERM_MOD8[ii + 1 + PERM[jj + 1]]]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
  return 70 * (n0 + n1 + n2);
}

function fbm(x, y, octaves) {
  let value = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

// --- Color Utility ---
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q-p)*6*t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q-p)*(2/3-t)*6;
      return p;
    };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l - q;
    r = hue2rgb(p, q, h+1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h-1/3);
  }
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}

// --- Layer Type Constants ---
const LAYER_TYPES = ['wash', 'blob', 'marbling', 'bubble', 'image', 'scope'];
const LAYER_TYPE_LABELS = { wash: 'Wash', blob: 'Blob', marbling: 'Marbling', bubble: 'Bubble', image: 'Image', scope: 'Scope' };
const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'lighter', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'difference', label: 'Difference' },
];
const AUDIO_SOURCES = ['none', 'bass', 'mids', 'highs', 'full'];
const LAYER_SCALES = { wash: 6, blob: 4, marbling: 5, bubble: 5, image: 3, scope: 1 };

// --- Layer Param Definitions ---
const LAYER_PARAMS = [
  { key: 'scale', label: 'Scale', min: 0.1, max: 3, default: 1, step: 0.1 },
  { key: 'speed', label: 'Speed', min: 0, max: 2, default: 0.5, step: 0.1 },
  { key: 'turbulence', label: 'Turb', min: 0, max: 1, default: 0.5, step: 0.05 },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, default: 0.8, step: 0.05 },
  { key: 'drift', label: 'Drift', min: 0, max: 1, default: 0.3, step: 0.05 },
  { key: 'rotation', label: 'Rotate', min: 0, max: 1, default: 0, step: 0.05 },
  { key: 'distortion', label: 'Distort', min: 0, max: 1, default: 0.3, step: 0.05 },
  { key: 'reactivity', label: 'React', min: 0, max: 2, default: 0.5, step: 0.05 },
];

const GLOBAL_PARAMS = [
  { key: 'audioGain', label: 'Audio', min: 0, max: 3, default: 1, step: 0.1 },
  { key: 'speed', label: 'Speed', min: 0.1, max: 2, default: 0.5, step: 0.1 },
  { key: 'turbulence', label: 'Turb', min: 0, max: 1, default: 0.5, step: 0.05 },
  { key: 'interaction', label: 'Interact', min: 0, max: 1, default: 0.5, step: 0.05 },
  { key: 'bloom', label: 'Bloom', min: 0, max: 1, default: 0.4, step: 0.05 },
  { key: 'softness', label: 'Soft', min: 0, max: 1, default: 0.3, step: 0.05 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 1, default: 0.5, step: 0.05 },
  { key: 'saturation', label: 'Satur', min: 0, max: 1, default: 0.7, step: 0.05 },
  { key: 'journey', label: 'Journey', min: 0, max: 1, default: 0, step: 0.05 },
];

const BW_PARAMS = [
  { key: 'threshold', label: 'Thresh', min: 0, max: 1, default: 0.5, step: 0.05 },
  { key: 'density', label: 'Density', min: 0, max: 1, default: 0.5, step: 0.05 },
  { key: 'bwGlow', label: 'Glow', min: 0, max: 1, default: 0.5, step: 0.05 },
];

// ============================================
// Main Visualizer Class
// ============================================
export class LiquidShowVisualizer {
  static get label() { return 'Liquid Lights'; }
  static get params() { return []; }

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.startTime = performance.now() / 1000;

    // Audio smoothing
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothEnergy = 0;

    // Layer state
    this.layers = this._defaultLayers();
    this.selectedLayerIndex = 0;
    this.soloLayerIndex = -1;

    // Global params
    this.globals = {};
    GLOBAL_PARAMS.forEach(p => this.globals[p.key] = p.default);
    this.globals.bw = false;
    BW_PARAMS.forEach(p => this.globals[p.key] = p.default);

    // Journey base values (stored when user changes params, journey modulates around these)
    this.journeyBases = null;

    // Offscreen canvases
    this.layerCanvases = [];
    this.compCanvas = document.createElement('canvas');
    this.compCtx = this.compCanvas.getContext('2d');
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d');

    // Panel
    this.panelEl = null;
    this._panelKnobs = [];
    this._globalKnobs = [];
    this._bwKnobs = [];
    this._rebuildLayerListFn = null;
    this._rebuildLayerKnobsFn = null;

    // Dynamic mode state
    this._dynamicEnabled = false;
    this._dynamicBtn = null;
  }

  // --- Layer Creation ---

  _defaultLayers() {
    return [
      this._createLayer('wash', { speed: 0.3, scale: 2.0, turbulence: 0.2, opacity: 0.7, blendMode: 'screen', audioSource: 'full', hue: 0 }),
      this._createLayer('blob', { speed: 0.5, scale: 1.0, opacity: 0.8, blendMode: 'lighter', audioSource: 'bass', hue: 200 }),
      this._createLayer('marbling', { speed: 0.5, turbulence: 0.6, distortion: 0.5, opacity: 0.7, blendMode: 'lighten', audioSource: 'mids', hue: 120 }),
      this._createLayer('bubble', { speed: 0.5, scale: 0.7, opacity: 0.6, blendMode: 'screen', audioSource: 'highs', hue: 280 }),
    ];
  }

  _createLayer(type, overrides = {}) {
    const params = {};
    LAYER_PARAMS.forEach(p => params[p.key] = p.default);
    if (overrides) {
      for (const k of Object.keys(overrides)) {
        if (k in params) params[k] = overrides[k];
      }
    }
    return {
      type: type || 'wash',
      visible: true,
      params,
      blendMode: overrides.blendMode || 'screen',
      audioSource: overrides.audioSource || 'full',
      audioSync: overrides.audioSync !== undefined ? overrides.audioSync : true,
      colorMode: overrides.colorMode || 'color',
      hue: overrides.hue ?? Math.random() * 360,
      offset: { x: Math.random() * 1000, y: Math.random() * 1000 },
    };
  }

  setParam() {} // No-op — custom panel manages state directly

  // --- Audio ---

  _computeAudio(frequencyData) {
    let bass = 0, mid = 0, treble = 0;
    if (frequencyData) {
      const bins = frequencyData.length;
      for (let i = 0; i < Math.min(12, bins); i++) bass += frequencyData[i];
      bass /= 12 * 255;
      for (let i = 12; i < Math.min(120, bins); i++) mid += frequencyData[i];
      mid /= 108 * 255;
      for (let i = 120; i < Math.min(500, bins); i++) treble += frequencyData[i];
      treble /= 380 * 255;
    }
    const atk = 0.5, rel = 0.1;
    this.smoothBass += (bass - this.smoothBass) * (bass > this.smoothBass ? atk : rel);
    this.smoothMid += (mid - this.smoothMid) * (mid > this.smoothMid ? atk : rel);
    this.smoothTreble += (treble - this.smoothTreble) * (treble > this.smoothTreble ? atk : rel);
    this.smoothEnergy = (this.smoothBass + this.smoothMid + this.smoothTreble) / 3;
    return { bass: this.smoothBass, mid: this.smoothMid, treble: this.smoothTreble, energy: this.smoothEnergy };
  }

  _getAudioForLayer(layer, audio) {
    if (!layer.audioSync) return 0;
    switch (layer.audioSource) {
      case 'none': return 0;
      case 'bass': return audio.bass;
      case 'mids': return audio.mid;
      case 'highs': return audio.treble;
      case 'full': return audio.energy;
      default: return audio.energy;
    }
  }

  // --- Layer Renderers ---

  _renderWash(layer, ctx, bw, bh, time, audioLevel) {
    const imageData = ctx.createImageData(bw, bh);
    const data = imageData.data;
    const { scale, speed, turbulence, drift, rotation, distortion, reactivity } = layer.params;
    const hNorm = layer.hue / 360;
    const t = time * speed * 0.3;
    const audioMod = audioLevel * reactivity;
    const rot = time * rotation * 0.2;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    // Audio drives scale pulsing and warp intensity
    const audioScale = scale * (1 + audioMod * 0.6);
    const audioDistortion = distortion + audioMod * 0.8;

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        let nx = (px / bw - 0.5) * audioScale * 2;
        let ny = (py / bh - 0.5) * audioScale * 2;
        // Apply rotation
        const rx = nx * cosR - ny * sinR;
        const ry = nx * sinR + ny * cosR;
        nx = rx + t * drift;
        ny = ry + t * drift * 0.7;

        // Domain warp for organic flow — audio boosts warp intensity
        const warp = fbm(nx * 0.5 + layer.offset.x, ny * 0.5 + layer.offset.y + t * 0.1, 2) * audioDistortion * 2;
        const val = fbm(nx + warp, ny + warp * 0.8 + t * 0.05, 3);

        // Turbulence adds high-freq detail
        const detail = turbulence > 0.01 ? noise2D((nx + warp) * 3, (ny + warp) * 3 + t * 0.2) * turbulence * 0.3 : 0;
        const combined = val + detail + audioMod * 1.2;

        const h = (hNorm + combined * 0.15 + audioMod * 0.08 + t * 0.02) % 1;
        const s = layer.colorMode === 'mono' ? 0 : 0.7 + combined * 0.2;
        const l = 0.25 + combined * 0.3 + audioMod * 0.4;

        const [r, g, b] = hslToRgb(Math.abs(h) % 1, Math.min(1, Math.max(0, s)), Math.min(0.9, Math.max(0.05, l)));
        const idx = (py * bw + px) * 4;
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderBlob(layer, ctx, bw, bh, time, audioLevel) {
    const imageData = ctx.createImageData(bw, bh);
    const data = imageData.data;
    const { scale, speed, turbulence, drift, rotation, distortion, reactivity } = layer.params;
    const hNorm = layer.hue / 360;
    const t = time * speed * 0.5;
    const audioMod = audioLevel * reactivity;

    // 5 blob centers moving via noise
    const centers = [];
    for (let i = 0; i < 5; i++) {
      const phase = layer.offset.x + i * 7.3;
      centers.push({
        x: bw * (0.3 + 0.4 * (0.5 + 0.5 * noise2D(t * 0.3 + phase, i * 3.1))),
        y: bh * (0.3 + 0.4 * (0.5 + 0.5 * noise2D(i * 2.7, t * 0.25 + phase))),
        r: bw * 0.12 * scale * (1 + audioMod * 1.5 + noise2D(t * 0.5 + i, i) * turbulence * 0.5),
      });
    }

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        let field = 0;
        for (let i = 0; i < centers.length; i++) {
          const c = centers[i];
          const dx = px - c.x, dy = py - c.y;
          field += (c.r * c.r) / (dx * dx + dy * dy + 1);
        }

        const idx = (py * bw + px) * 4;
        if (field > 1) {
          const depth = Math.min((field - 1) / 2, 1);
          const h = (hNorm + depth * 0.08 + t * 0.01) % 1;
          const s = layer.colorMode === 'mono' ? 0 : 0.8 - depth * 0.2;
          const l = 0.2 + depth * 0.5 + audioMod * 0.1;
          const [r, g, b] = hslToRgb(h, s, Math.min(0.9, l));
          data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
        } else if (field > 0.5) {
          const glow = ((field - 0.5) / 0.5);
          const gl = glow * glow * 0.06;
          const [r, g, b] = hslToRgb(hNorm, layer.colorMode === 'mono' ? 0 : 0.6, gl);
          data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
        }
        // else: leave transparent (0,0,0,0)
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderMarbling(layer, ctx, bw, bh, time, audioLevel) {
    const imageData = ctx.createImageData(bw, bh);
    const data = imageData.data;
    const { scale, speed, turbulence, drift, rotation, distortion, reactivity } = layer.params;
    const hNorm = layer.hue / 360;
    const t = time * speed * 0.3;
    const audioMod = audioLevel * reactivity;
    const rot = time * rotation * 0.15;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    // Audio boosts the domain warp strength — creates visible swirling on beats
    const audioDist = distortion + audioMod * 1.0;
    const audioTurb = turbulence + audioMod * 0.5;

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        let nx = (px / bw - 0.5) * scale * 3;
        let ny = (py / bh - 0.5) * scale * 3;
        const rx = nx * cosR - ny * sinR;
        const ry = nx * sinR + ny * cosR;
        nx = rx + t * drift;
        ny = ry + t * drift * 0.6;

        // Domain warping — the signature marbling effect, audio boosts warp
        const ox = layer.offset.x, oy = layer.offset.y;
        const warpX = fbm(nx + ox, ny + oy + t * 0.05, 3);
        const warpY = fbm(nx + ox + 5.2, ny + oy + 1.3 + t * 0.04, 3);
        const dist = audioDist * 4;
        const val = fbm(nx + warpX * dist + t * 0.02, ny + warpY * dist, 3 + Math.round(audioTurb * 2));

        // Second warp pass for extra richness
        const val2 = noise2D((nx + val * 2) * audioTurb, (ny + val * 1.5) * audioTurb + t * 0.03);

        const combined = val * 0.7 + val2 * 0.3 + audioMod * 1.0;
        const h = (hNorm + combined * 0.2 + audioMod * 0.06 + t * 0.015) % 1;
        const s = layer.colorMode === 'mono' ? 0 : 0.75 + combined * 0.15;
        const l = 0.25 + combined * 0.35 + audioMod * 0.35;

        const [r, g, b] = hslToRgb(Math.abs(h) % 1, Math.min(1, Math.max(0, s)), Math.min(0.9, Math.max(0.05, l)));
        const idx = (py * bw + px) * 4;
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderBubble(layer, ctx, bw, bh, time, audioLevel) {
    const imageData = ctx.createImageData(bw, bh);
    const data = imageData.data;
    const { scale, speed, turbulence, drift, rotation, distortion, reactivity } = layer.params;
    const hNorm = layer.hue / 360;
    const t = time * speed * 0.4;
    const audioMod = audioLevel * reactivity;
    // Audio drives cell displacement and edge sharpness
    const audioDrift = drift + audioMod * 1.5;

    // Generate cell centers in a grid with noise displacement — audio pushes cells around
    const cellCount = Math.round(4 + scale * 5);
    const cells = [];
    for (let ci = 0; ci < cellCount; ci++) {
      for (let cj = 0; cj < cellCount; cj++) {
        const bx = (ci + 0.5) / cellCount * bw + noise2D(ci + layer.offset.x + t * 0.2, cj + layer.offset.y) * bw / cellCount * audioDrift * 2;
        const by = (cj + 0.5) / cellCount * bh + noise2D(cj + layer.offset.y + t * 0.15, ci + layer.offset.x) * bh / cellCount * audioDrift * 2;
        cells.push({ x: bx, y: by });
      }
    }

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        // Find two nearest cell centers
        let d1 = Infinity, d2 = Infinity;
        for (let c = 0; c < cells.length; c++) {
          const dx = px - cells[c].x, dy = py - cells[c].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; }
          else if (d < d2) { d2 = d; }
        }

        // F2 - F1 creates cell edges — audio sharpens edges
        const edge = (d2 - d1) / (bw / cellCount);
        const cellVal = Math.min(1, edge * (2 + turbulence * 3 + audioMod * 3));

        // Interior detail via noise
        const detail = noise2D(px * 0.05 * scale + t * 0.1, py * 0.05 * scale + layer.offset.y) * distortion * 0.3;

        const combined = cellVal + detail + audioMod * 1.0;
        const h = (hNorm + combined * 0.1 + audioMod * 0.05 + d1 * 0.002) % 1;
        const s = layer.colorMode === 'mono' ? 0 : 0.6 + combined * 0.25;
        const l = 0.05 + combined * 0.5 + audioMod * 0.4;

        const [r, g, b] = hslToRgb(Math.abs(h) % 1, Math.min(1, Math.max(0, s)), Math.min(0.9, Math.max(0.03, l)));
        const idx = (py * bw + px) * 4;
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderImage(layer, ctx, bw, bh, time, audioLevel) {
    if (!layer.imageData) {
      ctx.clearRect(0, 0, bw, bh);
      return;
    }

    const { scale, speed, turbulence, drift, rotation, distortion, reactivity } = layer.params;
    const t = time * speed * 0.3;
    const audioMod = audioLevel * reactivity;

    // Draw the source image to a temp canvas at buffer size if needed
    if (!layer._imgCanvas || layer._imgCanvas.width !== bw || layer._imgCanvas.height !== bh) {
      layer._imgCanvas = document.createElement('canvas');
      layer._imgCanvas.width = bw;
      layer._imgCanvas.height = bh;
      const ic = layer._imgCanvas.getContext('2d');
      // Cover-fit the image
      const img = layer.imageData;
      const imgAspect = img.width / img.height;
      const bufAspect = bw / bh;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > bufAspect) {
        sw = img.height * bufAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / bufAspect;
        sy = (img.height - sh) / 2;
      }
      ic.drawImage(img, sx, sy, sw, sh, 0, 0, bw, bh);
      layer._imgPixels = ic.getImageData(0, 0, bw, bh).data;
    }

    const srcPixels = layer._imgPixels;
    const imageData = ctx.createImageData(bw, bh);
    const data = imageData.data;
    const rot = time * rotation * 0.2;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const hueShift = layer.hue / 360;
    // Audio-boosted distortion
    const audioDist = distortion + audioMod * 1.0;
    const audioScl = scale * (1 + audioMod * 0.4);

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        // Normalized coords centered at origin
        let nx = (px / bw - 0.5) * audioScl * 2;
        let ny = (py / bh - 0.5) * audioScl * 2;

        // Rotation
        const rx = nx * cosR - ny * sinR;
        const ry = nx * sinR + ny * cosR;
        nx = rx + t * drift * 0.3;
        ny = ry + t * drift * 0.2;

        // Domain warp — distort the UV sampling
        const warpX = fbm(nx * 0.8 + layer.offset.x, ny * 0.8 + layer.offset.y + t * 0.1, 2) * audioDist * 2;
        const warpY = fbm(nx * 0.8 + layer.offset.x + 5.2, ny * 0.8 + layer.offset.y + 1.3 + t * 0.08, 2) * audioDist * 2;

        // Turbulence adds high-freq ripple
        const ripple = turbulence > 0.01 ?
          noise2D((nx + warpX) * 4, (ny + warpY) * 4 + t * 0.3) * turbulence * audioDist * 0.5 : 0;

        // Map back to pixel coordinates
        let srcX = ((nx + warpX + ripple) / (audioScl * 2) + 0.5) * bw;
        let srcY = ((ny + warpY + ripple) / (audioScl * 2) + 0.5) * bh;

        // Wrap around
        srcX = ((srcX % bw) + bw) % bw;
        srcY = ((srcY % bh) + bh) % bh;

        const si = (Math.floor(srcY) * bw + Math.floor(srcX)) * 4;
        let r = srcPixels[si] || 0;
        let g = srcPixels[si + 1] || 0;
        let b = srcPixels[si + 2] || 0;

        // Hue shift — rotate color in RGB space (fast approximate)
        if (hueShift > 0.01) {
          const angle = hueShift * Math.PI * 2;
          const cs = Math.cos(angle), sn = Math.sin(angle);
          const nr = r * (0.299 + 0.701 * cs - 0.168 * sn)
                   + g * (0.587 - 0.587 * cs - 0.330 * sn)
                   + b * (0.114 - 0.114 * cs + 0.498 * sn);
          const ng = r * (0.299 - 0.299 * cs + 0.328 * sn)
                   + g * (0.587 + 0.413 * cs + 0.035 * sn)
                   + b * (0.114 - 0.114 * cs - 0.363 * sn);
          const nb = r * (0.299 - 0.300 * cs - 1.250 * sn)
                   + g * (0.587 - 0.588 * cs + 1.050 * sn)
                   + b * (0.114 + 0.886 * cs + 0.203 * sn);
          r = Math.max(0, Math.min(255, nr));
          g = Math.max(0, Math.min(255, ng));
          b = Math.max(0, Math.min(255, nb));
        }

        // Audio brightness boost
        const brightBoost = 1 + audioMod * 0.6;
        r = Math.min(255, r * brightBoost);
        g = Math.min(255, g * brightBoost);
        b = Math.min(255, b * brightBoost);

        const idx = (py * bw + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderScope(layer, ctx, w, h, time, audioLevel) {
    const { scale, speed, turbulence, drift, rotation, distortion, reactivity } = layer.params;
    const timeDomain = this._timeDomainData;
    const hNorm = layer.hue / 360;

    // Persistence/decay — fade previous frame instead of clearing
    const decay = distortion; // distortion knob controls persistence
    if (decay > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - decay * 0.95})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    if (!timeDomain || timeDomain.length === 0) return;

    // Derive color from hue
    const [cr, cg, cb] = hslToRgb(hNorm, 0.9, 0.55);
    const color = `rgb(${cr},${cg},${cb})`;
    const [gr, gg, gb] = hslToRgb(hNorm, 0.7, 0.75);
    const glowColor = `rgb(${gr},${gg},${gb})`;

    const gain = scale * 1.5; // scale knob = amplitude gain
    const sweep = 0.2 + speed * 3.8; // speed knob = sweep (time compression)
    const glow = turbulence; // turbulence knob = glow amount
    const react = reactivity;
    const audioMod = audioLevel * react;

    // Number of samples to draw
    const sampleCount = timeDomain.length;
    const step = Math.max(1, Math.floor(sampleCount / (w * sweep)));
    const drawCount = Math.min(sampleCount, Math.ceil(w * sweep));

    // Vertical drift from drift knob
    const yDrift = Math.sin(time * 0.3) * drift * h * 0.15;
    // Rotation
    const rot = rotation * Math.PI * 2 * Math.sin(time * 0.1);

    ctx.save();
    if (Math.abs(rot) > 0.001) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.translate(-w / 2, -h / 2);
    }

    // Main waveform trace
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 + audioMod * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 4 + glow * 20 + audioMod * 10;
    ctx.shadowColor = glowColor;

    for (let i = 0; i < drawCount; i++) {
      const sampleIdx = Math.min(Math.floor(i * step), sampleCount - 1);
      const value = ((timeDomain[sampleIdx] / 128) - 1) * gain;
      const x = (i / drawCount) * w;
      const y = h / 2 - value * h / 2 + yDrift;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Bright core pass for CRT glow effect
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.4)`;
    ctx.lineWidth = 1;
    ctx.shadowBlur = glow * 6;
    ctx.shadowColor = glowColor;

    for (let i = 0; i < drawCount; i++) {
      const sampleIdx = Math.min(Math.floor(i * step), sampleCount - 1);
      const value = ((timeDomain[sampleIdx] / 128) - 1) * gain;
      const x = (i / drawCount) * w;
      const y = h / 2 - value * h / 2 + yDrift;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _renderLayer(layer, lCanvas, time, audioLevel) {
    const lCtx = lCanvas.getContext('2d');
    const bw = lCanvas.width, bh = lCanvas.height;
    switch (layer.type) {
      case 'wash': this._renderWash(layer, lCtx, bw, bh, time, audioLevel); break;
      case 'blob': this._renderBlob(layer, lCtx, bw, bh, time, audioLevel); break;
      case 'marbling': this._renderMarbling(layer, lCtx, bw, bh, time, audioLevel); break;
      case 'bubble': this._renderBubble(layer, lCtx, bw, bh, time, audioLevel); break;
      case 'image': this._renderImage(layer, lCtx, bw, bh, time, audioLevel); break;
      case 'scope': this._renderScope(layer, lCtx, bw, bh, time, audioLevel); break;
    }
  }

  // --- Journey Mode ---

  _applyJourney(time) {
    const j = this.globals.journey;
    if (j < 0.01) return;

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const phase = layer.offset.x;
      const p = layer.params;

      // Modulate around current values — gentle sinusoidal shifts
      p._jOpacity = j * 0.2 * Math.sin(time * 0.07 + phase);
      p._jScale = j * 0.3 * Math.sin(time * 0.05 + phase * 1.3);
      p._jTurbulence = j * 0.15 * Math.sin(time * 0.09 + phase * 0.7);
      p._jDrift = j * 0.2 * Math.sin(time * 0.06 + phase * 1.9);
      layer._jHue = j * 30 * Math.sin(time * 0.03 + phase * 2.1);
    }
  }

  _getEffective(layer, key) {
    const base = layer.params[key];
    const jKey = '_j' + key.charAt(0).toUpperCase() + key.slice(1);
    const jMod = layer.params[jKey] || 0;
    return base + jMod;
  }

  // --- Compositing ---

  _isLayerActive(layer) {
    if (this.soloLayerIndex >= 0) {
      return this.layers[this.soloLayerIndex] === layer;
    }
    return layer.visible && layer.params.opacity > 0.01;
  }

  // --- Draw ---

  draw(frequencyData, timeDomainData) {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;

    const time = performance.now() / 1000 - this.startTime;
    const globalTime = time * this.globals.speed;
    const audio = this._computeAudio(frequencyData);
    this._timeDomainData = timeDomainData;

    // Journey modulation
    this._applyJourney(time);

    // Ensure enough offscreen canvases
    while (this.layerCanvases.length < this.layers.length) {
      this.layerCanvases.push(document.createElement('canvas'));
    }

    // Render each layer
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!this._isLayerActive(layer)) continue;

      const scale = LAYER_SCALES[layer.type] || 4;
      const lw = Math.ceil(w / scale);
      const lh = Math.ceil(h / scale);
      const lCanvas = this.layerCanvases[i];
      if (lCanvas.width !== lw || lCanvas.height !== lh) {
        lCanvas.width = lw;
        lCanvas.height = lh;
      }

      const audioLevel = this._getAudioForLayer(layer, audio) * this.globals.audioGain;
      this._renderLayer(layer, lCanvas, globalTime, audioLevel);
    }

    // Composite
    this.compCanvas.width = w;
    this.compCanvas.height = h;
    const compCtx = this.compCtx;
    compCtx.clearRect(0, 0, w, h);
    compCtx.fillStyle = '#000';
    compCtx.fillRect(0, 0, w, h);

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!this._isLayerActive(layer)) continue;

      const effectiveOpacity = Math.max(0, Math.min(1, layer.params.opacity + (layer.params._jOpacity || 0)));
      compCtx.globalAlpha = effectiveOpacity;
      compCtx.globalCompositeOperation = layer.blendMode;
      compCtx.imageSmoothingEnabled = true;
      compCtx.imageSmoothingQuality = 'high';
      compCtx.drawImage(this.layerCanvases[i], 0, 0, w, h);
    }
    compCtx.globalAlpha = 1;
    compCtx.globalCompositeOperation = 'source-over';

    // Draw to main canvas
    ctx.drawImage(this.compCanvas, 0, 0);

    // Post-processing
    this._postProcess(w, h, audio);
  }

  _postProcess(w, h, audio) {
    const ctx = this.ctx;
    const { bloom, softness, contrast, saturation, bw, threshold, density, bwGlow } = this.globals;

    // Bloom
    if (bloom > 0.01) {
      this.bloomCanvas.width = w;
      this.bloomCanvas.height = h;
      this.bloomCtx.drawImage(this.canvas, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = bloom * 0.3 + audio.energy * bloom * 0.2;
      ctx.filter = `blur(${Math.round(12 + bloom * 20)}px)`;
      ctx.drawImage(this.bloomCanvas, 0, 0);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Softness
    if (softness > 0.05) {
      ctx.filter = `blur(${Math.round(softness * 3)}px)`;
      ctx.drawImage(this.canvas, 0, 0);
      ctx.filter = 'none';
    }

    // Contrast + Saturation
    const contrastVal = 0.6 + contrast * 1.4;
    const satVal = saturation * 2;
    if (Math.abs(contrastVal - 1) > 0.05 || Math.abs(satVal - 1) > 0.05) {
      ctx.filter = `contrast(${contrastVal}) saturate(${satVal})`;
      ctx.drawImage(this.canvas, 0, 0);
      ctx.filter = 'none';
    }

    // B&W mode
    if (bw) {
      const cVal = 1 + threshold * 2;
      const bVal = 0.6 + density * 0.8;
      ctx.filter = `grayscale(1) contrast(${cVal}) brightness(${bVal})`;
      ctx.drawImage(this.canvas, 0, 0);
      ctx.filter = 'none';

      // B&W glow
      if (bwGlow > 0.05) {
        this.bloomCanvas.width = w;
        this.bloomCanvas.height = h;
        this.bloomCtx.drawImage(this.canvas, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = bwGlow * 0.25;
        ctx.filter = `blur(${Math.round(8 + bwGlow * 16)}px)`;
        ctx.drawImage(this.bloomCanvas, 0, 0);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  reset() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.startTime = performance.now() / 1000;
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothEnergy = 0;
  }

  // ============================================
  // Custom Panel UI
  // ============================================

  buildPanel(controlPanelEl) {
    this.destroyPanel();

    // Add class to control panel for vertical stacking layout
    controlPanelEl.classList.add('ll-active');
    this._controlPanelEl = controlPanelEl;

    const panel = document.createElement('fieldset');
    panel.className = 'group-box ll-panel';
    const legend = document.createElement('legend');
    legend.textContent = 'Liquid Lights';
    panel.appendChild(legend);

    const layout = document.createElement('div');
    layout.className = 'll-layout';

    // --- LEFT: Layer Stack ---
    const layersDiv = document.createElement('div');
    layersDiv.className = 'll-layers';

    const layerList = document.createElement('div');
    layerList.className = 'll-layer-list';

    const layerButtons = document.createElement('div');
    layerButtons.className = 'll-layer-buttons';

    const addBtn = this._makeBtn('+', 'Add Layer');
    const dupBtn = this._makeBtn('\u29C9', 'Duplicate');
    const delBtn = this._makeBtn('\u2715', 'Delete');
    const upBtn = this._makeBtn('\u25B2', 'Move Up');
    const downBtn = this._makeBtn('\u25BC', 'Move Down');

    addBtn.addEventListener('click', () => {
      if (this.layers.length >= 6) return;
      this.layers.push(this._createLayer('wash'));
      this._rebuildLayerList();
      this.selectedLayerIndex = this.layers.length - 1;
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
    });
    dupBtn.addEventListener('click', () => {
      if (this.layers.length >= 6) return;
      const src = this.layers[this.selectedLayerIndex];
      const copy = JSON.parse(JSON.stringify(src));
      copy.offset = { x: Math.random() * 1000, y: Math.random() * 1000 };
      this.layers.splice(this.selectedLayerIndex + 1, 0, copy);
      this.selectedLayerIndex++;
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
    });
    delBtn.addEventListener('click', () => {
      if (this.layers.length <= 1) return;
      this.layers.splice(this.selectedLayerIndex, 1);
      if (this.selectedLayerIndex >= this.layers.length) this.selectedLayerIndex = this.layers.length - 1;
      if (this.soloLayerIndex >= this.layers.length) this.soloLayerIndex = -1;
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
    });
    upBtn.addEventListener('click', () => {
      if (this.selectedLayerIndex <= 0) return;
      const i = this.selectedLayerIndex;
      [this.layers[i], this.layers[i-1]] = [this.layers[i-1], this.layers[i]];
      this.selectedLayerIndex--;
      this._rebuildLayerList();
    });
    downBtn.addEventListener('click', () => {
      if (this.selectedLayerIndex >= this.layers.length - 1) return;
      const i = this.selectedLayerIndex;
      [this.layers[i], this.layers[i+1]] = [this.layers[i+1], this.layers[i]];
      this.selectedLayerIndex++;
      this._rebuildLayerList();
    });

    [addBtn, dupBtn, delBtn, upBtn, downBtn].forEach(b => layerButtons.appendChild(b));
    layersDiv.appendChild(layerList);
    layersDiv.appendChild(layerButtons);

    // --- CENTER: Layer Controls ---
    const layerControlsDiv = document.createElement('div');
    layerControlsDiv.className = 'll-layer-controls';

    // --- RIGHT: Global Controls ---
    const globalDiv = document.createElement('div');
    globalDiv.className = 'll-global-controls';

    layout.appendChild(layersDiv);
    layout.appendChild(layerControlsDiv);
    layout.appendChild(globalDiv);
    panel.appendChild(layout);
    controlPanelEl.appendChild(panel);
    this.panelEl = panel;

    // Store references for rebuild
    this._layerListEl = layerList;
    this._layerControlsEl = layerControlsDiv;
    this._globalControlsEl = globalDiv;

    // Build all sections
    this._rebuildLayerList();
    this._rebuildLayerKnobs();
    this._buildGlobalControls();
  }

  destroyPanel() {
    if (this._controlPanelEl) {
      this._controlPanelEl.classList.remove('ll-active');
      this._controlPanelEl = null;
    }
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
    this._panelKnobs = [];
    this._globalKnobs = [];
    this._bwKnobs = [];
  }

  _makeBtn(text, title) {
    const btn = document.createElement('button');
    btn.className = 'll-btn';
    btn.textContent = text;
    btn.title = title;
    return btn;
  }

  // --- Layer List ---

  _rebuildLayerList() {
    const list = this._layerListEl;
    if (!list) return;
    list.innerHTML = '';

    this.layers.forEach((layer, i) => {
      const row = document.createElement('div');
      row.className = 'll-layer-row' + (i === this.selectedLayerIndex ? ' selected' : '');

      // Eye toggle
      const eye = document.createElement('button');
      eye.className = 'll-eye' + (layer.visible ? ' active' : '');
      eye.textContent = layer.visible ? '\u{1F441}' : '\u2014';
      eye.title = 'Visibility';
      if (!layer.visible) row.classList.add('muted');
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        eye.classList.toggle('active', layer.visible);
        row.classList.toggle('muted', !layer.visible);
        eye.textContent = layer.visible ? '\u{1F441}' : '\u2014';
      });

      // Solo toggle
      const solo = document.createElement('button');
      solo.className = 'll-solo' + (this.soloLayerIndex === i ? ' active' : '');
      solo.textContent = 'S';
      solo.title = 'Solo';
      solo.addEventListener('click', (e) => {
        e.stopPropagation();
        this.soloLayerIndex = this.soloLayerIndex === i ? -1 : i;
        this._rebuildLayerList();
      });

      // Audio sync toggle
      const audioSync = document.createElement('button');
      audioSync.className = 'll-audio-sync' + (layer.audioSync ? ' active' : '');
      audioSync.textContent = '\u266A';
      audioSync.title = 'Audio Sync';
      audioSync.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.audioSync = !layer.audioSync;
        audioSync.classList.toggle('active', layer.audioSync);
      });

      // Type selector
      const typeSelect = document.createElement('select');
      typeSelect.className = 'll-type-select';
      LAYER_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = LAYER_TYPE_LABELS[t];
        if (t === layer.type) opt.selected = true;
        typeSelect.appendChild(opt);
      });
      typeSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        layer.type = typeSelect.value;
        layer._imgCanvas = null;
        layer._imgPixels = null;
        this._rebuildLayerList();
        this._rebuildLayerKnobs();
      });
      typeSelect.addEventListener('click', (e) => e.stopPropagation());

      const name = document.createElement('span');
      name.className = 'll-layer-name';
      name.textContent = `${i + 1}.`;

      row.appendChild(eye);
      row.appendChild(solo);
      row.appendChild(audioSync);
      row.appendChild(name);
      row.appendChild(typeSelect);

      row.addEventListener('click', () => {
        this.selectedLayerIndex = i;
        this._rebuildLayerList();
        this._rebuildLayerKnobs();
      });

      list.appendChild(row);
    });
  }

  // --- Layer Knobs ---

  _rebuildLayerKnobs() {
    const container = this._layerControlsEl;
    if (!container) return;
    container.innerHTML = '';
    this._panelKnobs = [];

    const layer = this.layers[this.selectedLayerIndex];
    if (!layer) return;

    // Header
    const header = document.createElement('div');
    header.className = 'll-section-header';
    header.textContent = `Layer ${this.selectedLayerIndex + 1} — ${LAYER_TYPE_LABELS[layer.type]}`;
    container.appendChild(header);

    // Knobs row
    const knobsRow = document.createElement('div');
    knobsRow.className = 'll-knobs-row';

    // Hue knob (stored on layer.hue, not layer.params)
    const hueParam = { key: 'hue', label: 'Hue', min: 0, max: 360, default: 180, step: 1 };
    const hueKnob = this._createKnob(knobsRow, hueParam, layer.hue, (val) => {
      layer.hue = val;
    });
    this._panelKnobs.push(hueKnob);

    LAYER_PARAMS.forEach(param => {
      const knobData = this._createKnob(knobsRow, param, layer.params[param.key], (val) => {
        layer.params[param.key] = val;
      });
      this._panelKnobs.push(knobData);
    });
    container.appendChild(knobsRow);

    // Dropdowns row
    const dropRow = document.createElement('div');
    dropRow.className = 'll-dropdowns-row';

    // Blend mode
    dropRow.appendChild(this._createSelect('Blend', BLEND_MODES.map(b => b.label), BLEND_MODES.findIndex(b => b.value === layer.blendMode), (idx) => {
      layer.blendMode = BLEND_MODES[idx].value;
    }));

    // Audio source
    dropRow.appendChild(this._createSelect('Audio', AUDIO_SOURCES.map(s => s.charAt(0).toUpperCase() + s.slice(1)), AUDIO_SOURCES.indexOf(layer.audioSource), (idx) => {
      layer.audioSource = AUDIO_SOURCES[idx];
    }));

    // Color mode toggle
    const colorToggle = document.createElement('button');
    colorToggle.className = 'll-toggle' + (layer.colorMode === 'mono' ? ' active' : '');
    colorToggle.textContent = layer.colorMode === 'mono' ? 'Mono' : 'Color';
    colorToggle.addEventListener('click', () => {
      layer.colorMode = layer.colorMode === 'color' ? 'mono' : 'color';
      colorToggle.classList.toggle('active', layer.colorMode === 'mono');
      colorToggle.textContent = layer.colorMode === 'mono' ? 'Mono' : 'Color';
    });
    dropRow.appendChild(colorToggle);

    container.appendChild(dropRow);

    // Image upload row (only for image layers)
    if (layer.type === 'image') {
      const imgRow = document.createElement('div');
      imgRow.className = 'll-image-row';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      fileInput.id = 'll-image-upload';

      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'll-toggle ll-upload-btn';
      uploadBtn.textContent = layer.imageData ? '\u{1F5BC} Change' : '\u{1F5BC} Upload';
      uploadBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            layer.imageData = img;
            layer._imgCanvas = null;
            layer._imgPixels = null;
            uploadBtn.textContent = '\u{1F5BC} Change';
            if (imgPreview) {
              imgPreview.src = img.src;
              imgPreview.style.display = 'block';
            }
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });

      // Gallery button
      const galleryBtn = document.createElement('button');
      galleryBtn.className = 'll-toggle ll-upload-btn';
      galleryBtn.textContent = '\u{1F3A8} Gallery';
      galleryBtn.addEventListener('click', () => {
        galleryGrid.style.display = galleryGrid.style.display === 'none' ? 'grid' : 'none';
      });

      const imgPreview = document.createElement('img');
      imgPreview.className = 'll-image-preview';
      if (layer.imageData) {
        imgPreview.src = layer.imageData.src;
        imgPreview.style.display = 'block';
      } else {
        imgPreview.style.display = 'none';
      }

      imgRow.appendChild(fileInput);
      imgRow.appendChild(uploadBtn);
      imgRow.appendChild(galleryBtn);
      imgRow.appendChild(imgPreview);
      container.appendChild(imgRow);

      // Gallery grid
      const galleryGrid = document.createElement('div');
      galleryGrid.className = 'll-gallery-grid';
      galleryGrid.style.display = 'none';
      GALLERY_IMAGES.forEach((entry, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'll-gallery-thumb';
        thumb.title = entry.name;
        const thumbImg = document.createElement('img');
        thumbImg.src = getGalleryThumbnail(idx);
        thumb.appendChild(thumbImg);
        const thumbLabel = document.createElement('span');
        thumbLabel.textContent = entry.name;
        thumb.appendChild(thumbLabel);
        thumb.addEventListener('click', () => {
          const img = getGalleryImage(idx);
          if (img.complete) {
            layer.imageData = img;
            layer._imgCanvas = null;
            layer._imgPixels = null;
            uploadBtn.textContent = '\u{1F5BC} Change';
            imgPreview.src = img.src;
            imgPreview.style.display = 'block';
            galleryGrid.style.display = 'none';
          } else {
            img.onload = () => {
              layer.imageData = img;
              layer._imgCanvas = null;
              layer._imgPixels = null;
              uploadBtn.textContent = '\u{1F5BC} Change';
              imgPreview.src = img.src;
              imgPreview.style.display = 'block';
              galleryGrid.style.display = 'none';
            };
          }
        });
        galleryGrid.appendChild(thumb);
      });
      container.appendChild(galleryGrid);
    }

    // Toolbar: Randomize + Randomize All + Dynamic
    const toolbar = document.createElement('div');
    toolbar.className = 'param-toolbar ll-toolbar';

    const randomBtn = document.createElement('button');
    randomBtn.className = 'param-tool-btn';
    randomBtn.innerHTML = '\u{1F3B2} Randomize';
    randomBtn.title = 'Randomize selected layer';
    randomBtn.addEventListener('click', () => this._randomizeLayer());

    const randomAllBtn = document.createElement('button');
    randomAllBtn.className = 'param-tool-btn';
    randomAllBtn.innerHTML = '\u{1F3B2} Randomize All';
    randomAllBtn.title = 'Randomize all layers at once';
    randomAllBtn.addEventListener('click', () => this._randomizeAllLayers());

    const dynamicBtn = document.createElement('button');
    dynamicBtn.className = 'param-tool-btn' + (this._dynamicEnabled ? ' active' : '');
    dynamicBtn.textContent = '\u2726 Dynamic';
    dynamicBtn.addEventListener('click', () => this._toggleDynamic());
    this._dynamicBtn = dynamicBtn;

    toolbar.appendChild(randomBtn);
    toolbar.appendChild(randomAllBtn);
    toolbar.appendChild(dynamicBtn);
    container.appendChild(toolbar);
  }

  // --- Global Controls ---

  _buildGlobalControls() {
    const container = this._globalControlsEl;
    if (!container) return;
    container.innerHTML = '';
    this._globalKnobs = [];
    this._bwKnobs = [];

    const header = document.createElement('div');
    header.className = 'll-section-header';
    header.textContent = 'Environment';
    container.appendChild(header);

    const knobsRow = document.createElement('div');
    knobsRow.className = 'll-knobs-row';

    GLOBAL_PARAMS.forEach(param => {
      const knobData = this._createKnob(knobsRow, param, this.globals[param.key], (val) => {
        this.globals[param.key] = val;
      });
      this._globalKnobs.push(knobData);
    });
    container.appendChild(knobsRow);

    // B&W toggle
    const bwRow = document.createElement('div');
    bwRow.className = 'll-bw-row';

    const bwToggle = document.createElement('button');
    bwToggle.className = 'll-toggle ll-bw-toggle' + (this.globals.bw ? ' active' : '');
    bwToggle.textContent = this.globals.bw ? 'B & W' : 'Psychedelic';
    bwToggle.addEventListener('click', () => {
      this.globals.bw = !this.globals.bw;
      bwToggle.classList.toggle('active', this.globals.bw);
      bwToggle.textContent = this.globals.bw ? 'B & W' : 'Psychedelic';
      bwKnobsDiv.classList.toggle('visible', this.globals.bw);
    });
    bwRow.appendChild(bwToggle);

    const bwKnobsDiv = document.createElement('div');
    bwKnobsDiv.className = 'll-bw-knobs' + (this.globals.bw ? ' visible' : '');

    BW_PARAMS.forEach(param => {
      const knobData = this._createKnob(bwKnobsDiv, param, this.globals[param.key], (val) => {
        this.globals[param.key] = val;
      });
      this._bwKnobs.push(knobData);
    });
    bwRow.appendChild(bwKnobsDiv);
    container.appendChild(bwRow);
  }

  // --- UI Helpers ---

  _createSelect(label, options, selectedIdx, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'll-select-wrapper';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    wrapper.appendChild(lbl);

    const select = document.createElement('select');
    select.className = 'll-select';
    options.forEach((opt, i) => {
      const o = document.createElement('option');
      o.textContent = opt;
      o.value = i;
      if (i === selectedIdx) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', () => onChange(parseInt(select.value)));
    wrapper.appendChild(select);
    return wrapper;
  }

  _createKnob(container, param, initialValue, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'knob-wrapper ll-knob-wrapper';

    const knob = document.createElement('div');
    knob.className = 'knob ll-knob';
    const indicator = document.createElement('div');
    indicator.className = 'knob-indicator';
    knob.appendChild(indicator);

    const label = document.createElement('div');
    label.className = 'knob-label';
    label.textContent = param.label;

    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'knob-value';

    wrapper.appendChild(knob);
    wrapper.appendChild(label);
    wrapper.appendChild(valueDisplay);
    container.appendChild(wrapper);

    const knobData = {
      element: knob, valueDisplay, param, value: initialValue,
      baseValue: initialValue, dynamic: false,
      dynamicPhase: Math.random() * Math.PI * 2,
      dynamicFreq: 0.08 + Math.random() * 0.12,
      onChange,
      updateVisual: null,
    };

    // Visual update
    const updateVisual = () => {
      const normalized = (knobData.value - param.min) / (param.max - param.min);
      const angle = -135 + normalized * 270;
      knob.style.transform = `rotate(${angle}deg)`;
      if (param.step >= 1) valueDisplay.textContent = Math.round(knobData.value);
      else if (param.step >= 0.1) valueDisplay.textContent = knobData.value.toFixed(1);
      else valueDisplay.textContent = knobData.value.toFixed(2);
    };
    knobData.updateVisual = updateVisual;
    updateVisual();

    // Drag events
    let startY = 0, startValue = 0;
    const onStart = (e) => {
      e.preventDefault();
      startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      startValue = knobData.value;
      knob.classList.add('active');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    };
    const onMove = (e) => {
      e.preventDefault();
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const delta = (startY - clientY) / 150;
      const range = param.max - param.min;
      let newValue = startValue + delta * range;
      newValue = Math.max(param.min, Math.min(param.max, newValue));
      newValue = Math.round(newValue / param.step) * param.step;
      knobData.value = newValue;
      knobData.baseValue = newValue;
      updateVisual();
      onChange(newValue);
    };
    const onEnd = () => {
      knob.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    knob.addEventListener('mousedown', onStart);
    knob.addEventListener('touchstart', onStart, { passive: false });
    knob.addEventListener('dblclick', () => {
      knobData.value = param.default;
      knobData.baseValue = param.default;
      updateVisual();
      onChange(param.default);
    });

    return knobData;
  }

  // --- Randomize ---

  _randomizeLayer() {
    const layer = this.layers[this.selectedLayerIndex];
    if (!layer) return;

    // Randomize layer type — include image as a possibility
    const newType = LAYER_TYPES[Math.floor(Math.random() * LAYER_TYPES.length)];
    layer.type = newType;

    // If randomized to image, pick a random gallery image
    if (newType === 'image') {
      const idx = Math.floor(Math.random() * GALLERY_IMAGES.length);
      const img = getGalleryImage(idx);
      layer.imageData = img;
      layer._imgCanvas = null;
      layer._imgPixels = null;
    }

    LAYER_PARAMS.forEach(param => {
      const range = param.max - param.min;
      let newValue = param.min + Math.random() * range;
      newValue = Math.round(newValue / param.step) * param.step;
      newValue = Math.max(param.min, Math.min(param.max, newValue));
      layer.params[param.key] = newValue;
    });
    // Also randomize hue
    layer.hue = Math.random() * 360;
    // Also randomize blend mode
    layer.blendMode = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)].value;
    // Also randomize audio source
    layer.audioSource = AUDIO_SOURCES[Math.floor(Math.random() * AUDIO_SOURCES.length)];
    this._rebuildLayerList();
    this._rebuildLayerKnobs();
  }

  _randomizeAllLayers() {
    this.layers.forEach(layer => {
      // Randomize layer type — include image as a possibility
      const newType = LAYER_TYPES[Math.floor(Math.random() * LAYER_TYPES.length)];
      layer.type = newType;

      // If randomized to image, pick a random gallery image
      if (newType === 'image') {
        const idx = Math.floor(Math.random() * GALLERY_IMAGES.length);
        const img = getGalleryImage(idx);
        layer.imageData = img;
        layer._imgCanvas = null;
        layer._imgPixels = null;
      }

      LAYER_PARAMS.forEach(param => {
        const range = param.max - param.min;
        let newValue = param.min + Math.random() * range;
        newValue = Math.round(newValue / param.step) * param.step;
        newValue = Math.max(param.min, Math.min(param.max, newValue));
        layer.params[param.key] = newValue;
      });
      layer.hue = Math.random() * 360;
      layer.blendMode = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)].value;
      layer.audioSource = AUDIO_SOURCES[Math.floor(Math.random() * AUDIO_SOURCES.length)];
    });
    this._rebuildLayerList();
    this._rebuildLayerKnobs();
  }

  // --- Dynamic Mode ---

  _toggleDynamic() {
    this._dynamicEnabled = !this._dynamicEnabled;
    if (this._dynamicBtn) {
      this._dynamicBtn.classList.toggle('active', this._dynamicEnabled);
    }

    // Initialize or clear dynamic state on all panel knobs
    const allKnobs = [...this._panelKnobs, ...this._globalKnobs, ...this._bwKnobs];
    allKnobs.forEach(k => {
      if (this._dynamicEnabled) {
        k.dynamic = true;
        k.baseValue = k.value;
        k.dynamicPhase = Math.random() * Math.PI * 2;
        k.dynamicFreq = 0.08 + Math.random() * 0.12;
      } else {
        k.dynamic = false;
        // Snap back to base value
        if (k.baseValue !== undefined) {
          k.value = k.baseValue;
          k.updateVisual();
          k.onChange(k.value);
        }
      }
    });
  }

  updateDynamic(timestamp) {
    if (!this._dynamicEnabled) return;
    const time = timestamp / 1000;

    const allKnobs = [...this._panelKnobs, ...this._globalKnobs, ...this._bwKnobs];
    allKnobs.forEach(k => {
      if (!k.dynamic) return;
      const range = k.param.max - k.param.min;
      const amplitude = range * 0.2;
      const offset = Math.sin(time * k.dynamicFreq + k.dynamicPhase) * amplitude;
      let newValue = k.baseValue + offset;
      newValue = Math.max(k.param.min, Math.min(k.param.max, newValue));
      newValue = Math.round(newValue / k.param.step) * k.param.step;
      k.value = newValue;
      k.updateVisual();
      k.onChange(newValue);
    });
  }
}
