/* ============================================
   Liquid Lights — Psychedelic Liquid Light Show
   ============================================ */

import { GALLERY_IMAGES, getGalleryImage, getGalleryThumbnail } from '../image-gallery.js';
import { LL_PRESETS } from './ll-presets.js';

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
function _hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1/6) return p + (q-p)*6*t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q-p)*(2/3-t)*6;
  return p;
}
// Reusable output array to avoid allocation per pixel
const _rgb = [0, 0, 0];
function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    _rgb[0] = v; _rgb[1] = v; _rgb[2] = v;
  } else {
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l - q;
    _rgb[0] = Math.round(_hue2rgb(p, q, h+1/3)*255);
    _rgb[1] = Math.round(_hue2rgb(p, q, h)*255);
    _rgb[2] = Math.round(_hue2rgb(p, q, h-1/3)*255);
  }
  return _rgb;
}

// --- Layer Type Constants ---
const LAYER_TYPES = ['wash', 'blob', 'marbling', 'bubble', 'image', 'scope', 'pulse', 'lissajous'];
const LAYER_TYPE_LABELS = { wash: 'Wash', blob: 'Blob', marbling: 'Marbling', bubble: 'Bubble', image: 'Image', scope: 'Scope', pulse: 'Pulse', lissajous: 'Lissajous' };
const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'lighter', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'difference', label: 'Difference' },
];
const AUDIO_SOURCES = ['none', 'bass', 'mids', 'highs', 'full'];
const LAYER_SCALES = { wash: 8, blob: 6, marbling: 7, bubble: 7, image: 4, scope: 1, pulse: 1, lissajous: 1 };

// --- Lissajous Shape Definitions (from lissajous.js) ---
const LISSAJOUS_SHAPES = [
  // 1: Dot — audio-reactive point
  [{ fX: 0, fY: 0, phase: 0, amp: 0 }, { fX: 0, fY: 0, phase: 0, amp: 0 }, { fX: 0, fY: 0, phase: 0, amp: 0 }],
  // 2: Figure-8
  [{ fX: 1, fY: 2, phase: Math.PI / 4, amp: 0.9 }, { fX: 0, fY: 0, phase: 0, amp: 0 }, { fX: 0, fY: 0, phase: 0, amp: 0 }],
  // 3: Bow
  [{ fX: 2, fY: 3, phase: Math.PI / 3, amp: 0.9 }, { fX: 0, fY: 0, phase: 0, amp: 0 }, { fX: 0, fY: 0, phase: 0, amp: 0 }],
  // 4: Trefoil
  [{ fX: 2, fY: 3, phase: Math.PI / 2, amp: 0.65 }, { fX: 3, fY: 2, phase: 0, amp: 0.45 }, { fX: 0, fY: 0, phase: 0, amp: 0 }],
  // 5: Flower
  [{ fX: 3, fY: 4, phase: Math.PI / 6, amp: 0.6 }, { fX: 1, fY: 1, phase: Math.PI / 2, amp: 0.45 }, { fX: 0, fY: 0, phase: 0, amp: 0 }],
  // 6: Spirograph
  [{ fX: 3, fY: 5, phase: Math.PI / 4, amp: 0.5 }, { fX: 5, fY: 3, phase: Math.PI / 3, amp: 0.35 }, { fX: 1, fY: 2, phase: 0, amp: 0.25 }],
  // 7: Orbit
  [{ fX: 1, fY: 1, phase: Math.PI / 2, amp: 0.55 }, { fX: 6, fY: 7, phase: 0, amp: 0.3 }, { fX: 3, fY: 4, phase: Math.PI / 5, amp: 0.2 }],
  // 8: Star
  [{ fX: 2, fY: 5, phase: Math.PI / 4, amp: 0.5 }, { fX: 5, fY: 2, phase: Math.PI / 3, amp: 0.4 }, { fX: 3, fY: 7, phase: 0, amp: 0.2 }],
  // 9: Knot
  [{ fX: 3, fY: 7, phase: Math.PI / 5, amp: 0.45 }, { fX: 5, fY: 8, phase: Math.PI / 3, amp: 0.35 }, { fX: 7, fY: 11, phase: 0, amp: 0.25 }],
];
const LISSAJOUS_SHAPE_LABELS = ['Dot', 'Figure-8', 'Bow', 'Trefoil', 'Flower', 'Spirograph', 'Orbit', 'Star', 'Knot'];

// --- Layer Param Definitions ---
const LAYER_PARAMS = [
  // Core
  { key: 'scale', label: 'Scale', min: 0.1, max: 3, default: 1, step: 0.1, group: 'Core', tip: 'Size / amplitude of the pattern' },
  { key: 'speed', label: 'Speed', min: 0, max: 2, default: 0.5, step: 0.1, group: 'Core', tip: 'Animation speed' },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, default: 0.8, step: 0.05, group: 'Core', tip: 'Layer transparency' },
  // Motion
  { key: 'drift', label: 'Drift', min: 0, max: 1, default: 0.3, step: 0.05, group: 'Motion', tip: 'Organic wandering movement' },
  { key: 'rotation', label: 'Rotate', min: 0, max: 1, default: 0, step: 0.05, group: 'Motion', tip: 'Rotational animation' },
  { key: 'zoom', label: 'Zoom', min: 1, max: 3, default: 1, step: 0.05, group: 'Motion', tip: 'Magnification level' },
  { key: 'mirror', label: 'Mirror', min: 0, max: 3, default: 0, step: 1, group: 'Motion', tip: 'Symmetry reflections (0–3 axes)' },
  // Effects
  { key: 'turbulence', label: 'Turb', min: 0, max: 1, default: 0.5, step: 0.05, group: 'Effects', tip: 'Glow and distortion intensity' },
  { key: 'distortion', label: 'Distort', min: 0, max: 1, default: 0.3, step: 0.05, group: 'Effects', tip: 'Persistence trails / decay' },
  { key: 'fade', label: 'Fade', min: 0, max: 1, default: 0, step: 0.05, group: 'Effects', tip: 'Edge fade vignette' },
  { key: 'tint', label: 'Tint', min: 0, max: 1, default: 0, step: 0.05, group: 'Effects', tip: 'Color wash overlay' },
  { key: 'invert', label: 'Invert', min: 0, max: 1, default: 0, step: 1, group: 'Effects', tip: 'Invert colors' },
  // Audio
  { key: 'reactivity', label: 'React', min: 0, max: 2, default: 0.5, step: 0.05, group: 'Audio', tip: 'How much audio affects this layer' },
];

const GLOBAL_PARAMS = [
  // Audio
  { key: 'audioGain', label: 'Audio', min: 0, max: 3, default: 1, step: 0.1, group: 'Audio', tip: 'Master audio sensitivity' },
  { key: 'speed', label: 'Speed', min: 0.1, max: 2, default: 0.5, step: 0.1, group: 'Audio', tip: 'Global animation speed' },
  // Visual
  { key: 'turbulence', label: 'Turb', min: 0, max: 1, default: 0.5, step: 0.05, group: 'Visual', tip: 'Global glow & turbulence' },
  { key: 'bloom', label: 'Bloom', min: 0, max: 1, default: 0.4, step: 0.05, group: 'Visual', tip: 'Soft light bloom effect' },
  { key: 'softness', label: 'Soft', min: 0, max: 1, default: 0.3, step: 0.05, group: 'Visual', tip: 'Gaussian blur amount' },
  { key: 'contrast', label: 'Contrast', min: 0, max: 1, default: 0.5, step: 0.05, group: 'Visual', tip: 'Color contrast intensity' },
  { key: 'saturation', label: 'Satur', min: 0, max: 1, default: 0.7, step: 0.05, group: 'Visual', tip: 'Color vividness' },
  // Animate
  { key: 'interaction', label: 'Interact', min: 0, max: 1, default: 0.5, step: 0.05, group: 'Animate', tip: 'Mouse / touch reactivity' },
  { key: 'journey', label: 'Journey', min: 0, max: 1, default: 0, step: 0.05, group: 'Animate', tip: 'Auto-evolving parameter drift' },
  { key: 'grain', label: 'Grain', min: 0, max: 1, default: 0, step: 0.05, group: 'Animate', tip: 'Film grain texture overlay' },
];

const BW_PARAMS = [
  { key: 'threshold', label: 'Thresh', min: 0, max: 1, default: 0.5, step: 0.05, tip: 'Black/white cutoff point' },
  { key: 'density', label: 'Density', min: 0, max: 1, default: 0.5, step: 0.05, tip: 'Ink density / darkness' },
  { key: 'bwGlow', label: 'Glow', min: 0, max: 1, default: 0.5, step: 0.05, tip: 'White edge glow intensity' },
];

// ============================================
// Main Visualizer Class
// ============================================
export class LiquidShowVisualizer {
  static get label() { return 'Liquid Lights'; }
  static get params() { return []; }
  static get presets() { return LL_PRESETS; }

  /**
   * Build a reusable preset selector element.
   * @param {function} onSelect - Called with the preset vizState when a preset is chosen
   * @returns {HTMLElement} A container with label + select dropdown
   */
  static buildPresetSelector(onSelect) {
    const row = document.createElement('div');
    row.className = 'll-preset-row';
    const label = document.createElement('label');
    label.textContent = 'Saved Presets';
    label.style.cssText = 'font-size:10px;font-weight:bold;color:#000;margin-right:4px;';
    const select = document.createElement('select');
    select.className = 'll-preset-select';
    select.style.cssText = 'font-size:10px;max-width:180px;';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = '\u2014 Select \u2014';
    select.appendChild(def);
    LL_PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      const preset = LL_PRESETS.find(p => p.id === select.value);
      if (preset && onSelect) onSelect(JSON.parse(JSON.stringify(preset.vizState)));
    });
    row.appendChild(label);
    row.appendChild(select);
    return row;
  }

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
    this.selectedLayerIndices = new Set([0]); // multi-select support
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

    // Global lock state
    this._globalLock = false;

    // Undo/redo history
    this._history = [];
    this._historyIndex = -1;
    this._maxHistory = 50;
    this._historyPaused = false;

    // First-visit randomization flag
    this._hasInitialized = false;
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
      locked: false,
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

  // --- Save / Load State ---

  getState() {
    return {
      layers: this.layers.map(l => ({
        type: l.type,
        visible: l.visible,
        locked: l.locked,
        params: { ...l.params },
        blendMode: l.blendMode,
        audioSource: l.audioSource,
        audioSync: l.audioSync,
        colorMode: l.colorMode,
        hue: l.hue,
        offset: { ...l.offset },
        imageSrc: l.type === 'image' && l.imageData ? l.imageData.src : undefined,
        lissajousShape: l.type === 'lissajous' ? (l._lissajousShape || 2) : undefined,
        pulseMode: l.type === 'pulse' ? (l._pulseMode || 'constant') : undefined,
      })),
      selectedLayerIndex: this.selectedLayerIndex,
      soloLayerIndex: this.soloLayerIndex,
      globals: { ...this.globals },
      dynamicEnabled: this._dynamicEnabled,
      globalLock: this._globalLock,
    };
  }

  setState(state) {
    if (!state) return;
    this._hasInitialized = true;

    // Restore layers
    if (state.layers && Array.isArray(state.layers)) {
      this.layers = state.layers.map(saved => {
        const layer = this._createLayer(saved.type, {
          ...saved.params,
          blendMode: saved.blendMode,
          audioSource: saved.audioSource,
          audioSync: saved.audioSync,
          colorMode: saved.colorMode,
          hue: saved.hue,
        });
        layer.visible = saved.visible;
        if (saved.locked !== undefined) layer.locked = saved.locked;
        if (saved.offset) layer.offset = { ...saved.offset };
        // Restore image layers
        if (saved.type === 'image' && saved.imageSrc) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = saved.imageSrc;
          layer.imageData = img;
        }
        // Restore lissajous shape
        if (saved.type === 'lissajous' && saved.lissajousShape !== undefined) {
          layer._lissajousShape = saved.lissajousShape;
        }
        // Restore pulse mode
        if (saved.type === 'pulse' && saved.pulseMode !== undefined) {
          layer._pulseMode = saved.pulseMode;
        }
        return layer;
      });
    }

    if (state.selectedLayerIndex !== undefined) this.selectedLayerIndex = state.selectedLayerIndex;
    this.selectedLayerIndices = new Set([this.selectedLayerIndex]);
    if (state.soloLayerIndex !== undefined) this.soloLayerIndex = state.soloLayerIndex;

    // Restore globals
    if (state.globals) {
      Object.assign(this.globals, state.globals);
    }

    // Restore dynamic mode
    if (state.dynamicEnabled !== undefined) this._dynamicEnabled = state.dynamicEnabled;
    if (state.globalLock !== undefined) this._globalLock = state.globalLock;

    // Reset journey bases so journey modulates around restored values
    this.journeyBases = null;

    // Rebuild panel UI if it's visible
    if (this.panelEl) {
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
      // Update global knobs
      this._globalKnobs.forEach(k => {
        const val = this.globals[k.param.key];
        if (val !== undefined) {
          k.value = val;
          k.baseValue = val;
          k.updateVisual();
        }
      });
      // Update B&W knobs
      this._bwKnobs.forEach(k => {
        const val = this.globals[k.param.key];
        if (val !== undefined) {
          k.value = val;
          k.baseValue = val;
          k.updateVisual();
        }
      });
    }
  }

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

  _getImageData(ctx, bw, bh, layer) {
    // Reuse cached ImageData to avoid allocation every frame
    if (layer._cachedImageData && layer._cachedImageData.width === bw && layer._cachedImageData.height === bh) {
      return layer._cachedImageData;
    }
    layer._cachedImageData = ctx.createImageData(bw, bh);
    return layer._cachedImageData;
  }

  _renderWash(layer, ctx, bw, bh, time, audioLevel) {
    const imageData = this._getImageData(ctx, bw, bh, layer);
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
        const val = fbm(nx + warp, ny + warp * 0.8 + t * 0.05, 2);

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
    const imageData = this._getImageData(ctx, bw, bh, layer);
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
    const imageData = this._getImageData(ctx, bw, bh, layer);
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
        const warpX = fbm(nx + ox, ny + oy + t * 0.05, 2);
        const warpY = fbm(nx + ox + 5.2, ny + oy + 1.3 + t * 0.04, 2);
        const dist = audioDist * 4;
        const val = fbm(nx + warpX * dist + t * 0.02, ny + warpY * dist, 2 + Math.min(1, Math.round(audioTurb)));

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
    const imageData = this._getImageData(ctx, bw, bh, layer);
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
    const imageData = this._getImageData(ctx, bw, bh, layer);
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

    const gain = scale * 1.2; // scale knob = amplitude gain
    const sweep = 0.2 + speed * 3.8; // speed knob = sweep (time compression)
    const glow = turbulence; // turbulence knob = glow amount
    const react = reactivity;
    const audioMod = audioLevel * react * 0.4; // dampened audio response

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
    ctx.lineWidth = 1.5 + audioMod * 0.3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 3 + glow * 10 + audioMod * 1.5;
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

  _renderPulse(layer, ctx, w, h, time, audioLevel) {
    const { scale, speed, turbulence, opacity, drift, rotation, distortion, reactivity } = layer.params;
    const hNorm = layer.hue / 360;
    const react = reactivity;
    const audioMod = audioLevel * react;

    // Per-band audio, respecting the layer's Audio dropdown (none/bass/mids/highs/full)
    const src = layer.audioSource;
    const isOff = !layer.audioSync || src === 'none';
    const bass = isOff ? 0 : (src === 'mids' || src === 'highs') ? 0 : this.smoothBass * react;
    const energy = isOff ? 0 : audioLevel * react;

    // Beat detection — always uses raw bass for reliable beat detection regardless of audio filter
    const rawBass = isOff ? 0 : this.smoothBass * react;
    if (!layer._peakBass) layer._peakBass = 0;
    layer._peakBass *= 0.88;
    if (rawBass > layer._peakBass) layer._peakBass = rawBass;
    const beat = rawBass > 0.005 ? rawBass / Math.max(layer._peakBass, 0.01) : 0;
    const isBeat = beat > 0.55 && rawBass > 0.04;

    // Persistence — fade previous frame
    const decay = distortion;
    if (decay > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - decay * 0.92})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    // Lazy init per-layer pulse state
    if (!layer._pulseRings) layer._pulseRings = [];
    if (!layer._lastPulseTime) layer._lastPulseTime = time;

    const maxR = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2) * 1.1;

    // Ring emission: base rate from scale, but audio dramatically increases density
    const beatOnly = (layer._pulseMode === 'beat');
    const baseInterval = Math.max(0.08, 0.5 - scale * 0.12);
    const interval = isOff ? baseInterval : Math.max(0.04, baseInterval - energy * 0.25);
    const ringSpeed = 25 + speed * 120 + energy * 140;
    const ringWidth = 0.5 + distortion * 2 + rawBass * 5;

    // Emit new rings — in beat mode, only emit on beats (burst of 2-4 rings)
    if (beatOnly) {
      // Keep lastPulseTime current to avoid burst backlog
      if (time - layer._lastPulseTime > 0.5) layer._lastPulseTime = time;
      if (isBeat && layer._pulseRings.length < 50) {
        const burstCount = 2 + Math.floor(rawBass * 5);
        for (let b = 0; b < burstCount; b++) {
          layer._pulseRings.push({
            born: time - b * 0.012,
            speed: ringSpeed * (1.0 + Math.random() * 0.3) + 60,
            width: ringWidth * 2.5 + rawBass * 8 + b * 0.5,
            colorOffset: Math.random() * 0.15,
            brightness: 0.6 + energy * 0.4 + Math.random() * 0.05,
            isBeat: true,
          });
        }
      }
    } else {
      // Constant mode — emit rings at regular interval
      while (time - layer._lastPulseTime >= interval) {
        layer._lastPulseTime += interval;
        if (layer._pulseRings.length < 50) {
          layer._pulseRings.push({
            born: layer._lastPulseTime,
            speed: ringSpeed * (0.8 + Math.random() * 0.4) + (isBeat ? 80 : 0),
            width: (isBeat ? ringWidth * 2.5 + rawBass * 6 : ringWidth * (0.5 + Math.random() * 0.5)),
            colorOffset: Math.random() * 0.15,
            brightness: (isBeat ? 0.6 + energy * 0.4 : 0.15 + energy * 0.5) + Math.random() * 0.05,
            isBeat,
          });
        }
      }
    }

    // Center with drift
    const driftX = drift * 40 * noise2D(time * 0.12 + layer.offset.x, time * 0.08);
    const driftY = drift * 40 * noise2D(time * 0.1 + layer.offset.y, time * 0.06 + 5);
    const cx = w / 2 + driftX;
    const cy = h / 2 + driftY;

    // Rotation
    const rot = rotation * Math.PI * 0.5 * Math.sin(time * 0.15);

    ctx.save();
    if (Math.abs(rot) > 0.001) {
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.translate(-cx, -cy);
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Derive colors from hue
    const isMono = layer.colorMode === 'mono';
    const sat = isMono ? 0 : 0.85;

    // Draw rings
    layer._pulseRings = layer._pulseRings.filter(ring => {
      const age = time - ring.born;
      const r = age * ring.speed;
      if (r > maxR) return false;

      const fade = Math.max(0, 1 - r / maxR);
      const h360 = ((hNorm + ring.colorOffset) % 1) * 360;
      const lightness = Math.round(ring.brightness * fade * 100);

      ctx.beginPath();
      ctx.strokeStyle = `hsla(${h360}, ${Math.round(sat * 100)}%, ${Math.max(5, lightness)}%, ${fade * opacity * (ring.isBeat ? 0.9 : 0.25)})`;
      ctx.lineWidth = ring.width * (1 + fade * 0.5);
      ctx.shadowBlur = ring.isBeat
        ? turbulence * 25 * fade + energy * 15
        : turbulence * 3 * fade;
      ctx.shadowColor = `hsl(${h360}, ${Math.round(sat * 100)}%, ${Math.min(90, lightness + 30)}%)`;

      // Draw distorted circle
      const segs = 48;
      for (let s = 0; s <= segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        const distort = turbulence > 0.01
          ? noise2D(angle * 2 + time * 0.3 + layer.offset.x, r * 0.01 + layer.offset.y) * turbulence * 35
          : 0;
        const x = cx + Math.cos(angle) * (r + distort);
        const y = cy + Math.sin(angle) * (r + distort);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return true;
    });

    // Central glow — pulses dramatically with beat
    const glowR = 10 + (isBeat ? bass * 120 : 0) + energy * 50;
    const glowBright = isBeat ? 0.8 : 0.4;
    const [gr, gg, gb] = hslToRgb(hNorm, isMono ? 0 : 0.7, glowBright);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grad.addColorStop(0, `rgba(${gr},${gg},${gb},${(isBeat ? 0.7 : 0.1 + energy * 0.3) * opacity})`);
    grad.addColorStop(0.5, `rgba(${gr},${gg},${gb},${(isBeat ? 0.3 : 0.05) * opacity})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.shadowBlur = 0;
    ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _renderLissajous(layer, ctx, w, h, time, audioLevel) {
    const { scale, speed, turbulence, opacity, drift, rotation, distortion, reactivity } = layer.params;
    const hNorm = layer.hue / 360;
    const react = reactivity;
    const audioMod = audioLevel * react;
    const animTime = time * speed;

    // Audio — respect the layer's Audio dropdown; scale down for gentle response
    const aLev = audioLevel * react;
    // Dampen heavily: at low react, almost no response; at max react, moderate response
    const bass   = aLev * 0.4;
    const mid    = aLev * 0.35;
    const treble = aLev * 0.25;
    const energy = aLev * 0.3;

    // Persistence/decay
    const decay = distortion;
    if (decay > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - decay * 0.95})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    // Shape selection
    const shapeIdx = Math.max(0, Math.min(LISSAJOUS_SHAPES.length - 1, (layer._lissajousShape || 2) - 1));
    const shapeOscs = LISSAJOUS_SHAPES[shapeIdx];
    const isDot = shapeIdx === 0;

    // Derive color — brightness pulses gently with energy
    const isMono = layer.colorMode === 'mono';
    const isMultiColor = layer.hue > 360;
    const effectiveHNorm = isMultiColor ? ((time * 20) % 360) / 360 : hNorm;
    const [cr, cg, cb] = hslToRgb(effectiveHNorm, isMono ? 0 : 0.9, 0.55 + energy * 0.04);
    const [gr, gg, gb] = hslToRgb(effectiveHNorm, isMono ? 0 : 0.7, 0.7 + energy * 0.03);
    const coreColor = `rgb(${cr},${cg},${cb})`;
    const glowColor = `rgb(${gr},${gg},${gb})`;

    // Center with drift
    const driftX = drift * 30 * noise2D(animTime * 0.1 + layer.offset.x, 0);
    const driftY = drift * 30 * noise2D(0, animTime * 0.1 + layer.offset.y);
    const cx = w / 2 + driftX;
    const cy = h / 2 + driftY;
    // Scale pulses very gently with bass
    const curveScale = Math.min(w, h) * 0.35 * scale * (1 + bass * 0.08);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (isDot) {
      // Dot mode: very gentle movement from audio
      const bassMove = bass * 0.1;
      const midMove = mid * 0.08;
      const trebleSpread = treble * 0.02;

      const dx = bassMove * Math.sin(animTime * 1.3)
               + midMove * Math.sin(animTime * 3.7 + 1.2)
               + trebleSpread * Math.sin(animTime * 7);
      const dy = bassMove * Math.cos(animTime * 0.9 + 0.5)
               + midMove * Math.cos(animTime * 2.3)
               + trebleSpread * Math.cos(animTime * 5);

      const px = cx + dx * curveScale;
      const py = cy + dy * curveScale;
      const dotR = 4 + energy * 2;

      // Glow
      const grad = ctx.createRadialGradient(px, py, 0, px, py, dotR * 3);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${opacity})`);
      grad.addColorStop(0.4, `rgba(${gr},${gg},${gb},${opacity * 0.5})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.shadowBlur = turbulence * 30;
      ctx.shadowColor = glowColor;
      ctx.fillRect(px - dotR * 3, py - dotR * 3, dotR * 6, dotR * 6);

      // Core dot
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fillStyle = coreColor;
      ctx.globalAlpha = opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      return;
    }

    // Compute Lissajous points — bass warps frequencies, mid drives rotation, treble adds shimmer
    const pointCount = 800;
    const points = [];
    const rotSpeed = 0.05 + mid * 0.08;

    for (let i = 0; i <= pointCount; i++) {
      const t = (i / pointCount) * Math.PI * 2;
      let x = 0, y = 0;

      for (let j = 0; j < shapeOscs.length; j++) {
        const o = shapeOscs[j];
        if (o.amp < 0.01) continue;

        // Bass-driven frequency modulation — very gentle warping
        const fmX = 1 + bass * 0.12 * Math.sin(animTime * 0.7 + j * 2.1);
        const fmY = 1 + bass * 0.12 * Math.cos(animTime * 0.5 + j * 1.7);

        // Treble adds very subtle harmonic shimmer
        const trebleDistort = treble * 0.03 * Math.sin(t * (j + 4) * 2);

        // Phase evolution (rotation knob + mid control speed)
        const phaseEvo = animTime * rotSpeed * (1 + rotation * 3) * (j + 1);

        x += Math.sin(t * o.fX * fmX + o.phase + phaseEvo) * (o.amp + trebleDistort);
        y += Math.cos(t * o.fY * fmY + phaseEvo * 1.3) * (o.amp + trebleDistort);
      }

      points.push({ x: cx + x * curveScale, y: cy + y * curveScale });
    }

    // Dynamic glow — smooth and gentle
    const dynGlow = turbulence * (1 + energy * 0.25);
    const glowWidth = 2.5 + dynGlow * 1 + bass * 0.5;
    const coreWidth = 1.2 + energy * 0.2;
    const segSize = 20; // points per segment for multi-color

    if (isMultiColor && !isMono) {
      // Multi-color: draw per-segment with rainbow hue
      const baseHue = (time * 40) % 360;
      // Pass 1: Glow segments
      ctx.lineWidth = glowWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let s = 0; s < pointCount; s += segSize) {
        const segHue = (baseHue + (s / pointCount) * 180) % 360;
        const [sr, sg, sb] = hslToRgb(segHue / 360, 0.9, 0.55);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${sr},${sg},${sb},${opacity * (0.45 + energy * 0.08)})`;
        ctx.shadowBlur = dynGlow * 10;
        ctx.shadowColor = `hsl(${segHue}, 70%, 70%)`;
        for (let i = s; i <= Math.min(s + segSize, pointCount); i++) {
          const p = points[i];
          const jX = (Math.random() - 0.5) * 0.2 * (1 + treble * 0.5);
          const jY = (Math.random() - 0.5) * 0.2 * (1 + treble * 0.5);
          if (i === s) ctx.moveTo(p.x + jX, p.y + jY);
          else ctx.lineTo(p.x + jX, p.y + jY);
        }
        ctx.stroke();
      }
      // Pass 2: Core segments
      ctx.globalAlpha = opacity;
      ctx.lineWidth = coreWidth;
      for (let s = 0; s < pointCount; s += segSize) {
        const segHue = (baseHue + (s / pointCount) * 180) % 360;
        ctx.beginPath();
        ctx.strokeStyle = `hsl(${segHue}, 100%, ${58 + energy * 4}%)`;
        ctx.shadowBlur = dynGlow * 3;
        ctx.shadowColor = `hsl(${segHue}, 100%, 70%)`;
        for (let i = s; i <= Math.min(s + segSize, pointCount); i++) {
          const p = points[i];
          if (i === s) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    } else {
      // Single color mode
      // Pass 1: Glow
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${opacity * (0.45 + energy * 0.08)})`;
      ctx.lineWidth = glowWidth;
      ctx.shadowBlur = dynGlow * 10;
      ctx.shadowColor = glowColor;
      for (let i = 0; i <= pointCount; i++) {
        const p = points[i];
        const jX = (Math.random() - 0.5) * 0.2 * (1 + treble * 0.5);
        const jY = (Math.random() - 0.5) * 0.2 * (1 + treble * 0.5);
        if (i === 0) ctx.moveTo(p.x + jX, p.y + jY);
        else ctx.lineTo(p.x + jX, p.y + jY);
      }
      ctx.stroke();

      // Pass 2: Core line
      ctx.beginPath();
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = coreWidth;
      ctx.shadowBlur = dynGlow * 3;
      ctx.shadowColor = glowColor;
      ctx.globalAlpha = opacity;
      for (let i = 0; i <= pointCount; i++) {
        const p = points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Pass 3: Subtle hot white only at high energy
    if (energy > 0.5) {
      const whiteHue = isMultiColor ? ((time * 20) % 360) : Math.round(effectiveHNorm * 360);
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${whiteHue}, ${isMono ? 0 : 60}%, 92%)`;
      ctx.lineWidth = 0.4;
      ctx.shadowBlur = dynGlow * 2;
      ctx.globalAlpha = (energy - 0.5) * 0.3 * opacity;
      for (let i = 0; i <= pointCount; i++) {
        const p = points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
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
      case 'pulse': this._renderPulse(layer, lCtx, bw, bh, time, audioLevel); break;
      case 'lissajous': this._renderLissajous(layer, lCtx, bw, bh, time, audioLevel); break;
    }

    // Apply per-layer post effects

    // Invert
    if (layer.params.invert >= 0.5) {
      lCtx.globalCompositeOperation = 'difference';
      lCtx.fillStyle = '#ffffff';
      lCtx.fillRect(0, 0, bw, bh);
      lCtx.globalCompositeOperation = 'source-over';
    }

    // Mirror (0=off, 1=horizontal, 2=vertical, 3=both)
    const mirror = Math.round(layer.params.mirror || 0);
    if (mirror > 0) {
      if (!this._tmpCanvas) {
        this._tmpCanvas = document.createElement('canvas');
      }
      const tc = this._tmpCanvas;
      if (tc.width !== bw || tc.height !== bh) { tc.width = bw; tc.height = bh; }
      const tCtx = tc.getContext('2d');
      tCtx.clearRect(0, 0, bw, bh);
      tCtx.drawImage(lCanvas, 0, 0);
      if (mirror === 1 || mirror === 3) {
        lCtx.save();
        lCtx.translate(bw, 0);
        lCtx.scale(-1, 1);
        lCtx.drawImage(tc, 0, 0, bw / 2, bh, 0, 0, bw / 2, bh);
        lCtx.restore();
      }
      if (mirror === 2 || mirror === 3) {
        const src = mirror === 3 ? lCanvas : tc;
        lCtx.save();
        lCtx.translate(0, bh);
        lCtx.scale(1, -1);
        lCtx.drawImage(src, 0, 0, bw, bh / 2, 0, 0, bw, bh / 2);
        lCtx.restore();
      }
    }

    // Zoom (center crop + scale)
    const zoom = layer.params.zoom || 1;
    if (zoom > 1.02) {
      if (!this._tmpCanvas) {
        this._tmpCanvas = document.createElement('canvas');
      }
      const tc = this._tmpCanvas;
      if (tc.width !== bw || tc.height !== bh) { tc.width = bw; tc.height = bh; }
      const tCtx = tc.getContext('2d');
      tCtx.clearRect(0, 0, bw, bh);
      tCtx.drawImage(lCanvas, 0, 0);
      lCtx.clearRect(0, 0, bw, bh);
      const sw = bw / zoom, sh = bh / zoom;
      const sx = (bw - sw) / 2, sy = (bh - sh) / 2;
      lCtx.drawImage(tc, sx, sy, sw, sh, 0, 0, bw, bh);
    }

    // Tint — overlay the layer's hue color at the tint intensity
    const tint = layer.params.tint || 0;
    if (tint > 0.01) {
      const hue = layer.hue + (layer._jHue || 0);
      const rgb = hslToRgb((((hue % 360) + 360) % 360) / 360, 1, 0.5);
      lCtx.globalCompositeOperation = 'color';
      lCtx.globalAlpha = tint;
      lCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      lCtx.fillRect(0, 0, bw, bh);
      lCtx.globalAlpha = 1;
      lCtx.globalCompositeOperation = 'source-over';
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

    // Timing instrumentation
    const timing = this._timing || (this._timing = { layers: [], post: {}, total: 0 });
    timing.layers.length = 0;
    const drawStart = performance.now();

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
      const t0 = performance.now();
      this._renderLayer(layer, lCanvas, globalTime, audioLevel);
      timing.layers.push({ index: i + 1, type: layer.type, ms: performance.now() - t0 });
    }

    // Composite
    if (this.compCanvas.width !== w || this.compCanvas.height !== h) {
      this.compCanvas.width = w;
      this.compCanvas.height = h;
    }
    const compCtx = this.compCtx;

    // Check if any active layer uses fade
    let anyFade = false;
    for (let i = 0; i < this.layers.length; i++) {
      if (this._isLayerActive(this.layers[i]) && (this.layers[i].params.fade || 0) > 0.01) {
        anyFade = true;
        break;
      }
    }

    if (!anyFade) {
      // No fade — clear and composite fresh
      compCtx.clearRect(0, 0, w, h);
      compCtx.fillStyle = '#000';
      compCtx.fillRect(0, 0, w, h);
    } else {
      // Dim previous frame for trails effect (keep previous content, darken it)
      compCtx.globalCompositeOperation = 'source-over';
      compCtx.fillStyle = '#000';
      // Find max fade among active layers to control trail persistence
      let maxFade = 0;
      for (let i = 0; i < this.layers.length; i++) {
        if (this._isLayerActive(this.layers[i])) {
          maxFade = Math.max(maxFade, this.layers[i].params.fade || 0);
        }
      }
      compCtx.globalAlpha = 1 - maxFade * 0.95; // at fade=1, only 5% darkening per frame = long trails
      compCtx.fillRect(0, 0, w, h);
      compCtx.globalAlpha = 1;
    }

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

    // Post-processing (with timing)
    this._postProcess(w, h, audio, timing);
    timing.total = performance.now() - drawStart;
  }

  _postProcess(w, h, audio, timing) {
    const ctx = this.ctx;
    const { bloom, softness, contrast, saturation, grain, bw, threshold, density, bwGlow } = this.globals;
    const post = timing ? timing.post = {} : null;
    let t0;

    // Bloom
    if (bloom > 0.01) {
      t0 = performance.now();
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
      if (post) post.bloom = performance.now() - t0;
    }

    // Softness
    if (softness > 0.05) {
      t0 = performance.now();
      ctx.filter = `blur(${Math.round(softness * 3)}px)`;
      ctx.drawImage(this.canvas, 0, 0);
      ctx.filter = 'none';
      if (post) post.softness = performance.now() - t0;
    }

    // Contrast + Saturation
    const contrastVal = 0.6 + contrast * 1.4;
    const satVal = saturation * 2;
    if (Math.abs(contrastVal - 1) > 0.05 || Math.abs(satVal - 1) > 0.05) {
      t0 = performance.now();
      ctx.filter = `contrast(${contrastVal}) saturate(${satVal})`;
      ctx.drawImage(this.canvas, 0, 0);
      ctx.filter = 'none';
      if (post) post.contrast = performance.now() - t0;
    }

    // B&W mode
    if (bw) {
      t0 = performance.now();
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
      if (post) post.bw = performance.now() - t0;
    }

    // Grain (global — applied once over the final composite)
    if (grain > 0.01) {
      t0 = performance.now();
      // Use a small buffer (1/4 res) for performance, then stretch it
      const gw = Math.ceil(w / 4), gh = Math.ceil(h / 4);
      if (!this._grainCanvas) {
        this._grainCanvas = document.createElement('canvas');
      }
      const gc = this._grainCanvas;
      if (gc.width !== gw || gc.height !== gh) {
        gc.width = gw; gc.height = gh;
        this._grainImageData = null;
      }
      const gCtx = gc.getContext('2d');
      if (!this._grainImageData) {
        this._grainImageData = gCtx.createImageData(gw, gh);
      }
      const data = this._grainImageData.data;
      const intensity = grain * 100;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() - 0.5) * intensity;
        data[i] = data[i + 1] = data[i + 2] = 128 + v;
        data[i + 3] = 255;
      }
      gCtx.putImageData(this._grainImageData, 0, 0);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = grain * 0.5;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(gc, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (post) post.grain = performance.now() - t0;
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

    // Randomize everything on first visit this session
    if (!this._hasInitialized) {
      this._hasInitialized = true;
      this._randomizeAllLayersInternal();
    }

    // Add class to control panel for vertical stacking layout
    controlPanelEl.classList.add('ll-active');
    this._controlPanelEl = controlPanelEl;

    const panel = document.createElement('fieldset');
    panel.className = 'group-box ll-panel';
    const legend = document.createElement('legend');
    legend.textContent = 'Liquid Lights';
    panel.appendChild(legend);

    // --- Saved Presets dropdown ---
    const presetRow = document.createElement('div');
    presetRow.className = 'll-preset-row';
    const presetLabel = document.createElement('label');
    presetLabel.textContent = 'Saved Presets';
    presetLabel.style.cssText = 'font-size:10px;font-weight:bold;color:#000;margin-right:4px;';
    this._presetSelect = document.createElement('select');
    this._presetSelect.className = 'll-preset-select';
    this._presetSelect.style.cssText = 'font-size:10px;max-width:180px;';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Select —';
    this._presetSelect.appendChild(defaultOpt);
    LL_PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      this._presetSelect.appendChild(opt);
    });
    this._presetSelect.addEventListener('change', () => {
      const id = this._presetSelect.value;
      if (!id) return;
      const preset = LL_PRESETS.find(p => p.id === id);
      if (preset) {
        this._currentPresetId = preset.id;
        this.setState(JSON.parse(JSON.stringify(preset.vizState)));
        this._pushHistory();
      }
    });
    presetRow.appendChild(presetLabel);
    presetRow.appendChild(this._presetSelect);
    panel.appendChild(presetRow);

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
      if (this._globalLock) return;
      if (this.layers.length >= 6) return;
      this.layers.push(this._createLayer('wash'));
      this.selectedLayerIndex = this.layers.length - 1;
      this.selectedLayerIndices = new Set([this.selectedLayerIndex]);
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
      this._pushHistory();
    });
    dupBtn.addEventListener('click', () => {
      if (this._globalLock) return;
      if (this.layers.length >= 6) return;
      const src = this.layers[this.selectedLayerIndex];
      const copy = JSON.parse(JSON.stringify(src));
      copy.offset = { x: Math.random() * 1000, y: Math.random() * 1000 };
      this.layers.splice(this.selectedLayerIndex + 1, 0, copy);
      this.selectedLayerIndex++;
      this.selectedLayerIndices = new Set([this.selectedLayerIndex]);
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
      this._pushHistory();
    });
    delBtn.addEventListener('click', () => {
      if (this._globalLock) return;
      if (this.layers.length <= 1) return;
      this.layers.splice(this.selectedLayerIndex, 1);
      if (this.selectedLayerIndex >= this.layers.length) this.selectedLayerIndex = this.layers.length - 1;
      if (this.soloLayerIndex >= this.layers.length) this.soloLayerIndex = -1;
      this.selectedLayerIndices = new Set([this.selectedLayerIndex]);
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
      this._pushHistory();
    });
    upBtn.addEventListener('click', () => {
      if (this._globalLock) return;
      if (this.selectedLayerIndex <= 0) return;
      const i = this.selectedLayerIndex;
      [this.layers[i], this.layers[i-1]] = [this.layers[i-1], this.layers[i]];
      this.selectedLayerIndex--;
      this.selectedLayerIndices = new Set([this.selectedLayerIndex]);
      this._rebuildLayerList();
      this._pushHistory();
    });
    downBtn.addEventListener('click', () => {
      if (this._globalLock) return;
      if (this.selectedLayerIndex >= this.layers.length - 1) return;
      const i = this.selectedLayerIndex;
      [this.layers[i], this.layers[i+1]] = [this.layers[i+1], this.layers[i]];
      this.selectedLayerIndex++;
      this.selectedLayerIndices = new Set([this.selectedLayerIndex]);
      this._rebuildLayerList();
      this._pushHistory();
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

    // Seed the undo history with the initial state
    if (this._history.length === 0) {
      this._pushHistory();
    }
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

  // --- Lock Helpers ---

  _isLayerLocked(layerIndex) {
    if (this._globalLock) return true;
    const layer = typeof layerIndex === 'number' ? this.layers[layerIndex] : layerIndex;
    return layer && layer.locked;
  }

  // --- Undo/Redo History ---

  _snapshotState() {
    // Lightweight serializable snapshot of all mutable state
    return JSON.stringify({
      layers: this.layers.map(l => ({
        type: l.type, visible: l.visible, locked: l.locked,
        params: { ...l.params }, blendMode: l.blendMode,
        audioSource: l.audioSource, audioSync: l.audioSync,
        colorMode: l.colorMode, hue: l.hue,
        offset: { ...l.offset },
        imageSrc: l.type === 'image' && l.imageData ? l.imageData.src : undefined,
        lissajousShape: l.type === 'lissajous' ? (l._lissajousShape || 2) : undefined,
        pulseMode: l.type === 'pulse' ? (l._pulseMode || 'constant') : undefined,
      })),
      selectedLayerIndex: this.selectedLayerIndex,
      selectedLayerIndices: [...this.selectedLayerIndices],
      soloLayerIndex: this.soloLayerIndex,
      globals: { ...this.globals },
    });
  }

  _pushHistory() {
    if (this._historyPaused) return;
    const snap = this._snapshotState();
    // Don't push if identical to current
    if (this._historyIndex >= 0 && this._history[this._historyIndex] === snap) return;
    // Truncate any forward history
    this._history = this._history.slice(0, this._historyIndex + 1);
    this._history.push(snap);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }
    this._historyIndex = this._history.length - 1;
    this._updateHistoryButtons();
  }

  _undo() {
    if (this._historyIndex <= 0) return;
    this._historyIndex--;
    this._restoreSnapshot(this._history[this._historyIndex]);
    this._updateHistoryButtons();
  }

  _redo() {
    if (this._historyIndex >= this._history.length - 1) return;
    this._historyIndex++;
    this._restoreSnapshot(this._history[this._historyIndex]);
    this._updateHistoryButtons();
  }

  _restoreSnapshot(json) {
    this._historyPaused = true;
    const state = JSON.parse(json);

    this.layers = state.layers.map(saved => {
      const layer = this._createLayer(saved.type, {
        ...saved.params, blendMode: saved.blendMode,
        audioSource: saved.audioSource, audioSync: saved.audioSync,
        colorMode: saved.colorMode, hue: saved.hue,
      });
      layer.visible = saved.visible;
      if (saved.locked !== undefined) layer.locked = saved.locked;
      if (saved.offset) layer.offset = { ...saved.offset };
      if (saved.type === 'image' && saved.imageSrc) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = saved.imageSrc;
        layer.imageData = img;
      }
      if (saved.type === 'lissajous' && saved.lissajousShape !== undefined) {
        layer._lissajousShape = saved.lissajousShape;
      }
      if (saved.type === 'pulse' && saved.pulseMode !== undefined) {
        layer._pulseMode = saved.pulseMode;
      }
      return layer;
    });

    this.selectedLayerIndex = state.selectedLayerIndex;
    this.selectedLayerIndices = state.selectedLayerIndices
      ? new Set(state.selectedLayerIndices)
      : new Set([state.selectedLayerIndex]);
    this.soloLayerIndex = state.soloLayerIndex;
    Object.assign(this.globals, state.globals);

    this._rebuildLayerList();
    this._rebuildLayerKnobs();
    this._buildGlobalControls();
    this._historyPaused = false;
  }

  _updateHistoryButtons() {
    if (this._undoBtn) {
      this._undoBtn.disabled = this._historyIndex <= 0;
      this._undoBtn.style.opacity = this._historyIndex <= 0 ? '0.4' : '1';
    }
    if (this._redoBtn) {
      this._redoBtn.disabled = this._historyIndex >= this._history.length - 1;
      this._redoBtn.style.opacity = this._historyIndex >= this._history.length - 1 ? '0.4' : '1';
    }
  }

  // --- Layer List ---

  _rebuildLayerList() {
    const list = this._layerListEl;
    if (!list) return;
    list.innerHTML = '';

    this.layers.forEach((layer, i) => {
      const row = document.createElement('div');
      const isSelected = this.selectedLayerIndices.has(i);
      const isPrimary = i === this.selectedLayerIndex;
      row.className = 'll-layer-row' + (isSelected ? ' selected' : '') + (isSelected && !isPrimary ? ' multi-selected' : '');

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

      // Lock toggle
      const lock = document.createElement('button');
      lock.className = 'll-lock' + (layer.locked ? ' active' : '');
      lock.textContent = layer.locked ? '\u{1F512}' : '\u{1F513}';
      lock.title = 'Lock layer';
      lock.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.locked = !layer.locked;
        lock.classList.toggle('active', layer.locked);
        lock.textContent = layer.locked ? '\u{1F512}' : '\u{1F513}';
        row.classList.toggle('locked', layer.locked);
        this._rebuildLayerKnobs();
      });

      // Audio sync toggle
      const audioSync = document.createElement('button');
      audioSync.className = 'll-audio-sync' + (layer.audioSync ? ' active' : '');
      audioSync.textContent = '\u266A';
      audioSync.title = 'Audio Sync';
      audioSync.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._isLayerLocked(i)) return;
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
        if (this._isLayerLocked(i)) { typeSelect.value = layer.type; return; }
        layer.type = typeSelect.value;
        layer._imgCanvas = null;
        layer._imgPixels = null;
        layer._pulseRings = null;
        layer._lastPulseTime = null;
        this._rebuildLayerList();
        this._rebuildLayerKnobs();
        this._pushHistory();
      });
      typeSelect.addEventListener('click', (e) => e.stopPropagation());

      const name = document.createElement('span');
      name.className = 'll-layer-name';
      name.textContent = `${i + 1}.`;

      if (layer.locked) row.classList.add('locked');

      row.appendChild(eye);
      row.appendChild(solo);
      row.appendChild(lock);
      row.appendChild(audioSync);
      row.appendChild(name);
      row.appendChild(typeSelect);

      row.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          // Toggle this layer in the multi-selection
          if (this.selectedLayerIndices.has(i)) {
            if (this.selectedLayerIndices.size > 1) {
              this.selectedLayerIndices.delete(i);
              // Update primary to first remaining
              this.selectedLayerIndex = [...this.selectedLayerIndices][0];
            }
          } else {
            this.selectedLayerIndices.add(i);
          }
        } else if (e.shiftKey && this.selectedLayerIndices.size > 0) {
          // Range select from primary to clicked
          const lo = Math.min(this.selectedLayerIndex, i);
          const hi = Math.max(this.selectedLayerIndex, i);
          this.selectedLayerIndices.clear();
          for (let idx = lo; idx <= hi; idx++) this.selectedLayerIndices.add(idx);
        } else {
          // Normal click — single select
          this.selectedLayerIndex = i;
          this.selectedLayerIndices = new Set([i]);
        }
        this.selectedLayerIndex = [...this.selectedLayerIndices][0];
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

    const isMulti = this.selectedLayerIndices.size > 1;
    const selectedLayers = [...this.selectedLayerIndices].map(i => this.layers[i]).filter(Boolean);
    const isLocked = this._isLayerLocked(this.selectedLayerIndex);
    const anyLocked = selectedLayers.some((_, idx) => this._isLayerLocked([...this.selectedLayerIndices][idx]));

    // Header
    const header = document.createElement('div');
    header.className = 'll-section-header';
    if (isMulti) {
      header.textContent = `${selectedLayers.length} Layers Selected` + (anyLocked ? ' \u{1F512}' : '');
    } else {
      header.textContent = `Layer ${this.selectedLayerIndex + 1} — ${LAYER_TYPE_LABELS[layer.type]}` + (isLocked ? ' \u{1F512}' : '');
    }
    container.appendChild(header);

    // Apply locked overlay class to container
    container.classList.toggle('ll-locked', isMulti ? anyLocked : isLocked);

    // Knobs row
    const knobsRow = document.createElement('div');
    knobsRow.className = 'll-knobs-row';

    // Lock check for knobs
    const lockCheck = () => isMulti ? anyLocked : this._isLayerLocked(this.selectedLayerIndex);

    // Build knobs with group labels
    const allParams = [
      { ...{ key: 'hue', label: 'Hue', min: 0, max: 360, default: 180, step: 1, group: 'Core', tip: 'Base color of the layer' }, _isHue: true },
      ...LAYER_PARAMS,
    ];

    let lastGroup = null;
    let currentGroupKnobs = null;
    allParams.forEach(param => {
      if (param.group && param.group !== lastGroup) {
        lastGroup = param.group;
        // Create group container with vertical label + knobs
        const groupDiv = document.createElement('div');
        groupDiv.className = 'll-knob-group';
        const groupLabel = document.createElement('div');
        groupLabel.className = 'll-knob-group-label';
        groupLabel.textContent = param.group;
        groupDiv.appendChild(groupLabel);
        currentGroupKnobs = document.createElement('div');
        currentGroupKnobs.className = 'll-knob-group-knobs';
        groupDiv.appendChild(currentGroupKnobs);
        knobsRow.appendChild(groupDiv);
      }
      const target = currentGroupKnobs || knobsRow;
      const value = param._isHue ? layer.hue : layer.params[param.key];
      const knobData = this._createKnob(target, param, value, (val) => {
        if (param._isHue) {
          selectedLayers.forEach(l => { l.hue = val; });
        } else {
          selectedLayers.forEach(l => { l.params[param.key] = val; });
        }
      }, { lockCheck });
      this._panelKnobs.push(knobData);
    });
    container.appendChild(knobsRow);

    // Dropdowns row
    const dropRow = document.createElement('div');
    dropRow.className = 'll-dropdowns-row';

    // Blend mode — greyed out in multi-select
    const blendSelect = this._createSelect('Blend', BLEND_MODES.map(b => b.label), BLEND_MODES.findIndex(b => b.value === layer.blendMode), (idx) => {
      if (isMulti || this._isLayerLocked(this.selectedLayerIndex)) return;
      layer.blendMode = BLEND_MODES[idx].value;
      this._pushHistory();
    });
    if (isMulti) blendSelect.classList.add('ll-disabled');
    dropRow.appendChild(blendSelect);

    // Audio source — greyed out in multi-select
    const audioSelect = this._createSelect('Audio', AUDIO_SOURCES.map(s => s.charAt(0).toUpperCase() + s.slice(1)), AUDIO_SOURCES.indexOf(layer.audioSource), (idx) => {
      if (isMulti || this._isLayerLocked(this.selectedLayerIndex)) return;
      layer.audioSource = AUDIO_SOURCES[idx];
      this._pushHistory();
    });
    if (isMulti) audioSelect.classList.add('ll-disabled');
    dropRow.appendChild(audioSelect);

    // Color mode toggle — greyed out in multi-select
    const colorToggle = document.createElement('button');
    colorToggle.className = 'll-toggle' + (layer.colorMode === 'mono' ? ' active' : '') + (isMulti ? ' ll-disabled' : '');
    colorToggle.textContent = layer.colorMode === 'mono' ? 'Mono' : 'Color';
    colorToggle.addEventListener('click', () => {
      if (isMulti || this._isLayerLocked(this.selectedLayerIndex)) return;
      layer.colorMode = layer.colorMode === 'color' ? 'mono' : 'color';
      colorToggle.classList.toggle('active', layer.colorMode === 'mono');
      colorToggle.textContent = layer.colorMode === 'mono' ? 'Mono' : 'Color';
      this._pushHistory();
    });
    dropRow.appendChild(colorToggle);

    container.appendChild(dropRow);

    // Image upload row (only for image layers, single-select only)
    if (layer.type === 'image' && !isMulti) {
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

    // Pulse mode selector (only for pulse layers, single-select only)
    if (layer.type === 'pulse' && !isMulti) {
      const pulseRow = document.createElement('div');
      pulseRow.className = 'll-image-row';
      pulseRow.style.gap = '4px';

      const pulseLabel = document.createElement('span');
      pulseLabel.style.cssText = 'font-size:10px;color:#0f0;margin-right:4px;white-space:nowrap;';
      pulseLabel.textContent = 'Mode:';
      pulseRow.appendChild(pulseLabel);

      const currentMode = layer._pulseMode || 'constant';
      ['constant', 'beat'].forEach(mode => {
        const btn = document.createElement('button');
        btn.className = 'll-toggle' + (currentMode === mode ? ' active' : '');
        btn.textContent = mode === 'constant' ? 'Constant' : 'Beat Sync';
        btn.title = mode === 'constant' ? 'Rings emit continuously' : 'Rings only emit on beat hits';
        btn.style.cssText = 'padding:2px 6px;font-size:10px;';
        btn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._pulseMode = mode;
          pulseRow.querySelectorAll('.ll-toggle').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._pushHistory();
        });
        pulseRow.appendChild(btn);
      });

      container.appendChild(pulseRow);
    }

    // Lissajous shape + color selector (only for lissajous layers, single-select only)
    if (layer.type === 'lissajous' && !isMulti) {
      const shapeRow = document.createElement('div');
      shapeRow.className = 'll-image-row';
      shapeRow.style.gap = '3px';

      const shapeLabel = document.createElement('span');
      shapeLabel.style.cssText = 'font-size:10px;color:#0f0;margin-right:4px;white-space:nowrap;';
      shapeLabel.textContent = 'Shape:';
      shapeRow.appendChild(shapeLabel);

      const currentShape = layer._lissajousShape || 2;
      LISSAJOUS_SHAPE_LABELS.forEach((label, idx) => {
        const btn = document.createElement('button');
        btn.className = 'll-toggle' + ((idx + 1) === currentShape ? ' active' : '');
        btn.textContent = (idx + 1);
        btn.title = label;
        btn.style.cssText = 'min-width:22px;padding:2px 4px;font-size:10px;';
        btn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._lissajousShape = idx + 1;
          shapeRow.querySelectorAll('.ll-toggle').forEach((b, bi) => {
            b.classList.toggle('active', bi === idx);
          });
          this._pushHistory();
        });
        shapeRow.appendChild(btn);
      });

      container.appendChild(shapeRow);

      // Multi-color toggle
      const colorRow = document.createElement('div');
      colorRow.className = 'll-image-row';
      colorRow.style.gap = '6px';

      const colorLabel = document.createElement('span');
      colorLabel.style.cssText = 'font-size:10px;color:#0f0;margin-right:4px;white-space:nowrap;';
      colorLabel.textContent = 'Color:';
      colorRow.appendChild(colorLabel);

      const isMultiColor = layer.hue > 360;
      const multiBtn = document.createElement('button');
      multiBtn.className = 'll-toggle' + (isMultiColor ? ' active' : '');
      multiBtn.textContent = 'Multi';
      multiBtn.title = 'Rainbow cycling colors';
      multiBtn.style.cssText = 'min-width:44px;padding:2px 6px;font-size:10px;';
      multiBtn.addEventListener('click', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        if (layer.hue > 360) {
          layer.hue = layer._savedHue || 180;
        } else {
          layer._savedHue = layer.hue;
          layer.hue = 365;
        }
        multiBtn.classList.toggle('active', layer.hue > 360);
        // Update hue knob display
        const hueKnobData = this._panelKnobs.find(k => k.param.key === 'hue');
        if (hueKnobData) {
          hueKnobData.value = layer.hue;
          hueKnobData.updateVisual?.(layer.hue);
        }
        this._pushHistory();
      });
      colorRow.appendChild(multiBtn);

      container.appendChild(colorRow);
    }

    // Toolbar: Randomize + Randomize All + Dynamic
    const toolbar = document.createElement('div');
    toolbar.className = 'param-toolbar ll-toolbar';

    const randomBtn = document.createElement('button');
    randomBtn.className = 'param-tool-btn';
    randomBtn.innerHTML = '\u{1F3B2} Randomize';
    randomBtn.title = 'Randomize selected layer';
    randomBtn.addEventListener('click', () => {
      // Randomize all selected layers
      for (const idx of this.selectedLayerIndices) {
        if (this._isLayerLocked(idx)) continue;
        this.selectedLayerIndex = idx;
        this._randomizeLayerAt(idx);
      }
      this.selectedLayerIndex = [...this.selectedLayerIndices][0];
      this._currentPresetId = null;
      if (this._presetSelect) this._presetSelect.value = '';
      this._rebuildLayerList();
      this._rebuildLayerKnobs();
      this._pushHistory();
    });

    const randomAllBtn = document.createElement('button');
    randomAllBtn.className = 'param-tool-btn';
    randomAllBtn.innerHTML = '\u{1F3B2} Randomize All';
    randomAllBtn.title = 'Randomize all layers at once';
    randomAllBtn.addEventListener('click', () => {
      if (this._globalLock) return;
      this._randomizeAllLayers();
    });

    const dynamicBtn = document.createElement('button');
    dynamicBtn.className = 'param-tool-btn' + (this._dynamicEnabled ? ' active' : '');
    dynamicBtn.textContent = '\u2726 Dynamic';
    dynamicBtn.addEventListener('click', () => {
      if (this._globalLock) return;
      this._toggleDynamic();
    });
    this._dynamicBtn = dynamicBtn;

    const lockAllBtn = document.createElement('button');
    lockAllBtn.className = 'param-tool-btn ll-lock-all-btn' + (this._globalLock ? ' active' : '');
    lockAllBtn.textContent = this._globalLock ? '\u{1F512} Locked' : '\u{1F513} Lock All';
    lockAllBtn.title = 'Lock all settings (performance mode)';
    lockAllBtn.addEventListener('click', () => {
      this._globalLock = !this._globalLock;
      lockAllBtn.classList.toggle('active', this._globalLock);
      lockAllBtn.textContent = this._globalLock ? '\u{1F512} Locked' : '\u{1F513} Lock All';
      container.classList.toggle('ll-locked', this._isLayerLocked(this.selectedLayerIndex));
      // Update global controls locked state
      if (this._globalControlsEl) {
        this._globalControlsEl.classList.toggle('ll-locked', this._globalLock);
      }
    });

    // Undo / Redo buttons
    const undoBtn = document.createElement('button');
    undoBtn.className = 'param-tool-btn ll-history-btn';
    undoBtn.innerHTML = '\u25C0 Back';
    undoBtn.title = 'Undo (go back to previous settings)';
    undoBtn.addEventListener('click', () => this._undo());
    this._undoBtn = undoBtn;

    const redoBtn = document.createElement('button');
    redoBtn.className = 'param-tool-btn ll-history-btn';
    redoBtn.innerHTML = 'Fwd \u25B6';
    redoBtn.title = 'Redo (go forward to next settings)';
    redoBtn.addEventListener('click', () => this._redo());
    this._redoBtn = redoBtn;

    this._updateHistoryButtons();

    toolbar.appendChild(undoBtn);
    toolbar.appendChild(redoBtn);
    toolbar.appendChild(randomBtn);
    toolbar.appendChild(randomAllBtn);
    toolbar.appendChild(dynamicBtn);
    toolbar.appendChild(lockAllBtn);
    container.appendChild(toolbar);
  }

  // --- Global Controls ---

  _buildGlobalControls() {
    const container = this._globalControlsEl;
    if (!container) return;
    container.innerHTML = '';
    this._globalKnobs = [];
    this._bwKnobs = [];

    container.classList.toggle('ll-locked', this._globalLock);

    const header = document.createElement('div');
    header.className = 'll-section-header';
    header.textContent = 'Environment';
    container.appendChild(header);

    const knobsRow = document.createElement('div');
    knobsRow.className = 'll-knobs-row';

    const globalLockCheck = () => this._globalLock;
    let lastGlobalGroup = null;
    let currentGlobalGroupKnobs = null;
    GLOBAL_PARAMS.forEach(param => {
      if (param.group && param.group !== lastGlobalGroup) {
        lastGlobalGroup = param.group;
        const groupDiv = document.createElement('div');
        groupDiv.className = 'll-knob-group';
        const groupLabel = document.createElement('div');
        groupLabel.className = 'll-knob-group-label';
        groupLabel.textContent = param.group;
        groupDiv.appendChild(groupLabel);
        currentGlobalGroupKnobs = document.createElement('div');
        currentGlobalGroupKnobs.className = 'll-knob-group-knobs';
        groupDiv.appendChild(currentGlobalGroupKnobs);
        knobsRow.appendChild(groupDiv);
      }
      const target = currentGlobalGroupKnobs || knobsRow;
      const knobData = this._createKnob(target, param, this.globals[param.key], (val) => {
        this.globals[param.key] = val;
      }, { lockCheck: globalLockCheck });
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
      if (this._globalLock) return;
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
      }, { lockCheck: globalLockCheck });
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

  _createKnob(container, param, initialValue, onChange, opts = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'knob-wrapper ll-knob-wrapper';
    if (param.tip) wrapper.setAttribute('data-tip', param.tip);

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
    const isLocked = () => opts.lockCheck ? opts.lockCheck() : false;
    const onStart = (e) => {
      e.preventDefault();
      if (isLocked()) return;
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
      this._pushHistory();
    };
    knob.addEventListener('mousedown', onStart);
    knob.addEventListener('touchstart', onStart, { passive: false });
    knob.addEventListener('dblclick', () => {
      if (isLocked()) return;
      knobData.value = param.default;
      knobData.baseValue = param.default;
      updateVisual();
      onChange(param.default);
      this._pushHistory();
    });

    return knobData;
  }

  // --- Randomize ---

  // Biased random that favors the middle of the range (less extreme values)
  _biasedRandom(min, max, center, spread) {
    // Gaussian-ish: average of 2 randoms biased toward center
    const r = (Math.random() + Math.random()) / 2; // triangular distribution, peaks at 0.5
    return min + (max - min) * (center + (r - 0.5) * spread * 2);
  }

  _randomizeLayerParams(layer) {
    // Per-param biased ranges — tuned for properly-exposed average
    const biases = {
      opacity:    { center: 0.45, spread: 0.55 },   // pulled down slightly for less blow-out
      reactivity: { center: 0.4, spread: 0.55 },    // moderate reactivity
      distortion: { center: 0.4, spread: 0.6 },
      scale:      { center: 0.45, spread: 0.7 },
      mirror:     null,  // uniform is fine for integer params
      invert:     null,
      zoom:       { center: 0.25, spread: 0.45 },   // favor lower zoom
      fade:       { center: 0.15, spread: 0.4 },    // favor low/no fade
      tint:       { center: 0.25, spread: 0.55 },   // subtle-moderate tint
    };

    LAYER_PARAMS.forEach(param => {
      const bias = biases[param.key];
      let newValue;
      if (bias) {
        newValue = this._biasedRandom(param.min, param.max, bias.center, bias.spread);
      } else {
        newValue = param.min + Math.random() * (param.max - param.min);
      }
      newValue = Math.round(newValue / param.step) * param.step;
      newValue = Math.max(param.min, Math.min(param.max, newValue));
      layer.params[param.key] = newValue;
    });

    layer.hue = Math.random() * 360;

    // Weighted blend modes — balanced for proper exposure on average
    const blendWeights = [
      { value: 'source-over', weight: 5 },
      { value: 'lighter', weight: 1 },
      { value: 'screen', weight: 3 },
      { value: 'lighten', weight: 3 },
      { value: 'multiply', weight: 2 },
      { value: 'difference', weight: 1 },
    ];
    const totalWeight = blendWeights.reduce((s, b) => s + b.weight, 0);
    let r = Math.random() * totalWeight;
    for (const b of blendWeights) {
      r -= b.weight;
      if (r <= 0) { layer.blendMode = b.value; break; }
    }

    layer.audioSource = AUDIO_SOURCES[Math.floor(Math.random() * AUDIO_SOURCES.length)];
  }

  _randomizeLayerAt(layerIndex) {
    const layer = this.layers[layerIndex];
    if (!layer) return;
    const newType = LAYER_TYPES[Math.floor(Math.random() * LAYER_TYPES.length)];
    layer.type = newType;
    if (newType === 'image') {
      const idx = Math.floor(Math.random() * GALLERY_IMAGES.length);
      const img = getGalleryImage(idx);
      layer.imageData = img;
      layer._imgCanvas = null;
      layer._imgPixels = null;
    }
    if (newType === 'lissajous') {
      layer._lissajousShape = 1 + Math.floor(Math.random() * 9);
    }
    if (newType === 'pulse') {
      layer._pulseRings = null;
      layer._lastPulseTime = null;
    }
    this._randomizeLayerParams(layer);
  }

  _randomizeLayer() {
    const layer = this.layers[this.selectedLayerIndex];
    if (!layer) return;
    this._randomizeLayerAt(this.selectedLayerIndex);
    this._rebuildLayerList();
    this._rebuildLayerKnobs();
    this._pushHistory();
  }

  _randomizeAllLayersInternal() {
    this._currentPresetId = null;
    if (this._presetSelect) this._presetSelect.value = '';
    this.layers.forEach(layer => {
      const newType = LAYER_TYPES[Math.floor(Math.random() * LAYER_TYPES.length)];
      layer.type = newType;

      if (newType === 'image') {
        const idx = Math.floor(Math.random() * GALLERY_IMAGES.length);
        const img = getGalleryImage(idx);
        layer.imageData = img;
        layer._imgCanvas = null;
        layer._imgPixels = null;
      }
      if (newType === 'lissajous') {
        layer._lissajousShape = 1 + Math.floor(Math.random() * 9);
      }
      if (newType === 'pulse') {
        layer._pulseRings = null;
        layer._lastPulseTime = null;
      }

      this._randomizeLayerParams(layer);
    });

    // Randomize global params too
    GLOBAL_PARAMS.forEach(p => {
      this.globals[p.key] = p.min + Math.random() * (p.max - p.min);
      this.globals[p.key] = Math.round(this.globals[p.key] / p.step) * p.step;
      this.globals[p.key] = Math.max(p.min, Math.min(p.max, this.globals[p.key]));
    });
  }

  _randomizeAllLayers() {
    this._currentPresetId = null;
    if (this._presetSelect) this._presetSelect.value = '';
    // Skip locked layers when called interactively
    this.layers.forEach(layer => {
      if (layer.locked) return;
      const newType = LAYER_TYPES[Math.floor(Math.random() * LAYER_TYPES.length)];
      layer.type = newType;
      if (newType === 'image') {
        const idx = Math.floor(Math.random() * GALLERY_IMAGES.length);
        const img = getGalleryImage(idx);
        layer.imageData = img;
        layer._imgCanvas = null;
        layer._imgPixels = null;
      }
      if (newType === 'lissajous') {
        layer._lissajousShape = 1 + Math.floor(Math.random() * 9);
      }
      if (newType === 'pulse') {
        layer._pulseRings = null;
        layer._lastPulseTime = null;
      }
      this._randomizeLayerParams(layer);
    });
    this._rebuildLayerList();
    this._rebuildLayerKnobs();
    this._pushHistory();
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
        k.dynamicFreq = 0.03 + Math.random() * 0.05;
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
      const amplitude = range * 0.12;
      // Multi-sine for organic motion instead of a single mechanical sine wave
      const offset = amplitude * (
        0.6 * Math.sin(time * k.dynamicFreq + k.dynamicPhase) +
        0.3 * Math.sin(time * k.dynamicFreq * 0.37 + k.dynamicPhase * 1.7) +
        0.1 * Math.sin(time * k.dynamicFreq * 0.13 + k.dynamicPhase * 2.3)
      );
      // Smooth interpolation — don't snap to step grid, let it flow continuously
      let newValue = k.baseValue + offset;
      newValue = Math.max(k.param.min, Math.min(k.param.max, newValue));
      // Only snap for integer-step params (like mirror 0-3, invert 0-1)
      if (k.param.step >= 1) {
        newValue = Math.round(newValue);
      }
      // Smooth toward target to avoid any remaining jitter
      if (k._smoothValue === undefined) k._smoothValue = newValue;
      k._smoothValue += (newValue - k._smoothValue) * 0.08;
      const finalValue = k.param.step >= 1 ? Math.round(k._smoothValue) : k._smoothValue;
      k.value = finalValue;
      k.updateVisual();
      k.onChange(finalValue);
    });
  }
}
