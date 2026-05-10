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
const LAYER_TYPES = ['wash', 'blob', 'marbling', 'bubble', 'image', 'scope', 'pulse', 'lissajous', 'stars', 'lightning'];
const LAYER_TYPE_LABELS = { wash: 'Wash', blob: 'Blob', marbling: 'Marbling', bubble: 'Bubble', image: 'Image', scope: 'Scope', pulse: 'Pulse', lissajous: 'Lissajous', stars: 'Stars', lightning: 'Lightning' };
// Layer types that support the canvas-level spin rotation controls
const SPIN_LAYER_TYPES = new Set(['wash', 'bubble', 'pulse', 'image', 'lissajous']);
const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'lighter', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'difference', label: 'Difference' },
];
const AUDIO_SOURCES = ['none', 'bass', 'mids', 'highs', 'full'];
const LAYER_SCALES = { wash: 8, blob: 6, marbling: 7, bubble: 7, image: 4, scope: 1, pulse: 1, lissajous: 1, stars: 1, lightning: 1 };

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
  { key: 'brightness', label: 'Bright', min: -1, max: 1, default: 0, step: 0.05, group: 'Effects', tip: 'Layer brightness (-1 dark → 0 normal → +1 bright)' },
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

    // --- Mask editor state ---
    this._maskEditingLayerIndex = -1;
    this._maskTool = 'rect';        // 'rect' | 'ellipse' | 'freehand' | 'polygon'
    this._maskDrawing = false;
    this._maskDrawStart = null;     // { x, y } in normalized 0-1 coords
    this._maskCurrentDraw = null;   // in-progress shape preview
    this._maskToolbarEl = null;
    this._maskCanvasHandlers = null;
    this._maskPanelPrevDisplay = undefined; // saved panel.style.display while editing
    this._maskPolygonPoints = [];   // in-progress polygon vertices [[x,y], ...]
    this._maskPolygonCursor = null; // current cursor pos for preview line
    this._maskPolyDragging = false;    // true while dragging an existing vertex
    this._maskPolyDragSource = null;   // { type:'inprogress'|'mask', maskIdx?, ptIdx }
    this._maskPolyDragWas = false;     // set true when a drag occurred (suppress next click)
    this._maskSelectedShapeIdx = -1;   // index of the selected mask shape (-1 = none)
    this._maskShiftKey = false;        // shift key held (constrain rect→square, ellipse→circle)
    this._maskMoveState = null;        // { maskIdx, startPt, origMasks } during shape move
    this._maskResizeState = null;      // { maskIdx, handleId, origShape } during resize
    this._maskLocalHistory = [];       // per-session undo stack (arrays of mask snapshots)
    this._maskLocalHistoryIdx = -1;    // current position in local history
    this._maskUndoBtn = null;          // reference for enable/disable
    this._maskRedoBtn = null;

    // Full-UI hide (canvas click to toggle all chrome)
    this._llUiHidden = false;
    this._canvasUIClickHandler = null;

    // Feathered mask compositing — reused offscreen canvases
    this._featherMaskCanvas = null;
    this._featherTmpCanvas  = null;
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
      // Mask system: array of shapes (rect/ellipse/freehand) in normalized 0-1 coords.
      // Stored as array to allow future multi-mask support without data migration.
      _masks: [],
      _maskMode: 'include',    // 'include' (render only inside) or 'exclude' (render everywhere except)
      _maskFeather: 0,          // feather radius in pixels (0 = hard edge)
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
        imgPanMode:    l.type === 'image' ? (l._imgPanMode    ?? 'off') : undefined,
        imgPanSpeed:   l.type === 'image' ? (l._imgPanSpeed   ?? 0.3)   : undefined,
        imgMotionBlur: l.type === 'image' ? (l._imgMotionBlur ?? 0)     : undefined,
        lissajousShape: l.type === 'lissajous' ? (l._lissajousShape || 2) : undefined,
        pulseMode: l.type === 'pulse' ? (l._pulseMode || 'constant') : undefined,
        starsRotSpeed: l.type === 'stars' ? (l._starsRotSpeed ?? 0) : undefined,
        starsRotDir: l.type === 'stars' ? (l._starsRotDir ?? 'cw') : undefined,
        starsThickness: l.type === 'stars' ? (l._starsThickness ?? 1.0) : undefined,
        starsOriginRadius: l.type === 'stars' ? (l._starsOriginRadius ?? 0) : undefined,
        starsFlowDir: l.type === 'stars' ? (l._starsFlowDir ?? 'forward') : undefined,
        starsParticleShape: l.type === 'stars' ? (l._starsParticleShape ?? 'streak') : undefined,
        starsSize: l.type === 'stars' ? (l._starsSize ?? 1.0) : undefined,
        starsTailLength: l.type === 'stars' ? (l._starsTailLength ?? 1.0) : undefined,
        starsHyperspace: l.type === 'stars' ? (l._hyperspace ?? false) : undefined,
        lightFreq:      l.type === 'lightning' ? (l._lightFreq      ?? 0.4) : undefined,
        lightIntensity: l.type === 'lightning' ? (l._lightIntensity ?? 0.6) : undefined,
        lightBranching: l.type === 'lightning' ? (l._lightBranching ?? 0.5) : undefined,
        lightDuration:  l.type === 'lightning' ? (l._lightDuration  ?? 0.4) : undefined,
        spinSpeed: SPIN_LAYER_TYPES.has(l.type) ? (l._spinSpeed ?? 0) : undefined,
        spinDir:   SPIN_LAYER_TYPES.has(l.type) ? (l._spinDir   ?? 'cw') : undefined,
        masks: Array.isArray(l._masks) && l._masks.length > 0 ? this._cloneMasks(l._masks) : undefined,
        maskMode: Array.isArray(l._masks) && l._masks.length > 0 ? (l._maskMode ?? 'include') : undefined,
        maskFeather: (l._maskFeather ?? 0) > 0 ? l._maskFeather : undefined,
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

    // Exit mask edit mode before swapping layers — indices may no longer be valid
    if (this._maskEditingLayerIndex >= 0) {
      this._exitMaskEditMode();
    }

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
        if (saved.type === 'image') {
          if (saved.imgPanMode    !== undefined) layer._imgPanMode    = saved.imgPanMode;
          if (saved.imgPanSpeed   !== undefined) layer._imgPanSpeed   = saved.imgPanSpeed;
          if (saved.imgMotionBlur !== undefined) layer._imgMotionBlur = saved.imgMotionBlur;
        }
        // Restore lissajous shape
        if (saved.type === 'lissajous' && saved.lissajousShape !== undefined) {
          layer._lissajousShape = saved.lissajousShape;
        }
        // Restore pulse mode
        if (saved.type === 'pulse' && saved.pulseMode !== undefined) {
          layer._pulseMode = saved.pulseMode;
        }
        // Restore stars params
        if (saved.type === 'stars') {
          if (saved.starsRotSpeed !== undefined) layer._starsRotSpeed = saved.starsRotSpeed;
          if (saved.starsRotDir !== undefined) layer._starsRotDir = saved.starsRotDir;
          if (saved.starsThickness !== undefined) layer._starsThickness = saved.starsThickness;
          if (saved.starsOriginRadius !== undefined) layer._starsOriginRadius = saved.starsOriginRadius;
          if (saved.starsFlowDir !== undefined) layer._starsFlowDir = saved.starsFlowDir;
          if (saved.starsParticleShape !== undefined) layer._starsParticleShape = saved.starsParticleShape;
          if (saved.starsSize !== undefined) layer._starsSize = saved.starsSize;
          if (saved.starsTailLength !== undefined) layer._starsTailLength = saved.starsTailLength;
          if (saved.starsHyperspace !== undefined) layer._hyperspace = saved.starsHyperspace;
        }
        // Restore lightning params
        if (saved.type === 'lightning') {
          if (saved.lightFreq !== undefined)      layer._lightFreq      = saved.lightFreq;
          if (saved.lightIntensity !== undefined) layer._lightIntensity = saved.lightIntensity;
          if (saved.lightBranching !== undefined) layer._lightBranching = saved.lightBranching;
          if (saved.lightDuration !== undefined)  layer._lightDuration  = saved.lightDuration;
        }
        // Restore spin params
        if (SPIN_LAYER_TYPES.has(saved.type)) {
          if (saved.spinSpeed !== undefined) layer._spinSpeed = saved.spinSpeed;
          if (saved.spinDir   !== undefined) layer._spinDir   = saved.spinDir;
        }
        // Restore mask params
        if (Array.isArray(saved.masks)) {
          layer._masks = this._cloneMasks(saved.masks);
        } else {
          layer._masks = [];
        }
        layer._maskMode    = saved.maskMode ?? 'include';
        layer._maskFeather = saved.maskFeather ?? 0;
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

    // --- Pan state ---
    const panMode  = layer._imgPanMode  ?? 'off';
    const panSpeed = layer._imgPanSpeed ?? 0.3;
    const motionBlur = layer._imgMotionBlur ?? 0;

    // Per-frame dt for wander integration
    if (layer._imgLastTime === undefined) layer._imgLastTime = time;
    const dt = Math.min(0.1, time - layer._imgLastTime);
    layer._imgLastTime = time;
    if (layer._imgWanderX === undefined) layer._imgWanderX = 0;
    if (layer._imgWanderY === undefined) layer._imgWanderY = 0;

    // Compute pan offset in pixels
    // Pendulum is handled per-pixel in the render loop (vertical warp, no constant translation)
    let panOffX = 0, panOffY = 0;
    if (panMode === 'wander') {
      // Direction driven by smooth noise — never jerky, never stops
      const noiseFreq = 0.04 + panSpeed * 0.06;
      const wanderAngle = noise2D(time * noiseFreq + layer.offset.x * 0.01,
                                  time * noiseFreq * 0.8 + layer.offset.y * 0.01) * Math.PI * 2;
      const vel = (8 + panSpeed * 52) * dt; // 8–60 px/s
      layer._imgWanderX += Math.cos(wanderAngle) * vel;
      layer._imgWanderY += Math.sin(wanderAngle) * vel;
      // Soft pull back to centre so it doesn't drift off permanently
      const maxDist = 80 + panSpeed * 120;
      const d = Math.hypot(layer._imgWanderX, layer._imgWanderY);
      if (d > maxDist) {
        const pull = Math.min(0.06, (d - maxDist) / d * 0.1);
        layer._imgWanderX *= (1 - pull);
        layer._imgWanderY *= (1 - pull);
      }
      panOffX = layer._imgWanderX;
      panOffY = layer._imgWanderY;
    }

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

        // Map back to pixel coordinates, incorporating pan offset
        let pxOffX = panOffX, pxOffY = panOffY;
        if (panMode === 'pendulum') {
          // Vertical warp: bottom is anchored (factor=0), top sways freely (factor=1).
          // No image translation — every row just shifts its sampling point horizontally.
          const swayFactor = (bh - 1 - py) / Math.max(1, bh - 1);
          const maxSway = Math.min(bw, bh) * 0.06; // ~6% of smaller dimension
          const swayHz   = 0.1 + panSpeed * 0.35;  // 0.1–0.45 Hz
          pxOffX = maxSway * swayFactor * Math.sin(time * swayHz * Math.PI * 2);
          pxOffY = 0;
        } else if (panMode === 'wave') {
          const waveAmp = motionBlur * 35;
          pxOffX = waveAmp * Math.sin(py * (Math.PI * 2 / (bh * 0.4)) + time * panSpeed * 4);
          pxOffY = waveAmp * 0.6 * Math.sin(px * (Math.PI * 2 / (bw * 0.5)) + time * panSpeed * 3 + 1.8);
        }
        let srcX = ((nx + warpX + ripple) / (audioScl * 2) + 0.5) * bw + pxOffX;
        let srcY = ((ny + warpY + ripple) / (audioScl * 2) + 0.5) * bh + pxOffY;

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

    if (motionBlur < 0.01 || panMode === 'wave') {
      // No blur (or Wave mode — wave uses per-pixel UV warp, not accumulation)
      ctx.putImageData(imageData, 0, 0);
    } else {
      // Frame compositing via two-canvas blend.
      // Strategy: write new frame to tmp, then draw OLD accumulator ON TOP at
      // globalAlpha=persist (source-over gives: persist*old + (1-persist)*new).
      // This avoids putImageData's fully-opaque overwrite problem.
      if (!layer._panAccCanvas ||
          layer._panAccCanvas.width !== bw ||
          layer._panAccCanvas.height !== bh) {
        layer._panAccCanvas = document.createElement('canvas');
        layer._panAccCanvas.width = bw;
        layer._panAccCanvas.height = bh;
      }
      if (!layer._panTmpCanvas ||
          layer._panTmpCanvas.width !== bw ||
          layer._panTmpCanvas.height !== bh) {
        layer._panTmpCanvas = document.createElement('canvas');
        layer._panTmpCanvas.width = bw;
        layer._panTmpCanvas.height = bh;
      }
      const persist = motionBlur * 0.90;
      const tmpCtx = layer._panTmpCanvas.getContext('2d');
      // Step 1: write new frame to tmp canvas
      tmpCtx.putImageData(imageData, 0, 0);
      // Step 2: draw old accumulator on top of new frame at persist opacity
      // source-over formula: output = persist*oldAcc + (1-persist)*newFrame
      if (persist > 0.001) {
        tmpCtx.globalAlpha = persist;
        tmpCtx.drawImage(layer._panAccCanvas, 0, 0);
        tmpCtx.globalAlpha = 1;
      }
      // Step 3: copy tmp → acc
      const accCtx = layer._panAccCanvas.getContext('2d');
      accCtx.clearRect(0, 0, bw, bh);
      accCtx.drawImage(layer._panTmpCanvas, 0, 0);
      // Step 4: copy acc → output
      ctx.clearRect(0, 0, bw, bh);
      ctx.drawImage(layer._panAccCanvas, 0, 0);
    }
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

  /**
   * Compute a spawn (angle, r) for a particle on a shaped perimeter.
   * t ∈ [0,1) parameterises position along the perimeter.
   * jitter is a small positive radial offset for natural softening.
   */
  /**
   * Draw a single particle shape path centered at (px, py) with its leading
   * tip facing direction `dir` (radians). The caller must call ctx.fill().
   * Vertices are rotated manually to avoid ctx.save/restore overhead.
   */
  _starsDrawShape(ctx, shape, px, py, size, dir) {
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(px, py, size, 0, Math.PI * 2);
      return;
    }
    const c = Math.cos(dir), s = Math.sin(dir);
    // pt: add a rotated vertex at local (lx,ly); move=true for first point
    const pt = (lx, ly, move) => {
      const x = px + c * lx - s * ly;
      const y = py + s * lx + c * ly;
      move ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    };
    if (shape === 'star') {
      // 5-point star; outer tip at local (size,0) faces direction of travel
      const inn = size * 0.38;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? size : inn;
        const a = (i / 10) * Math.PI * 2;
        pt(Math.cos(a) * r, Math.sin(a) * r, i === 0);
      }
    } else if (shape === 'triangle') {
      // Isoceles triangle; apex at local (size,0) = forward
      pt( size,         0,          true);
      pt(-size * 0.6,  -size * 0.75, false);
      pt(-size * 0.6,   size * 0.75, false);
    } else if (shape === 'diamond') {
      // Diamond (rhombus); front tip at local (size,0) = forward
      pt( size,        0,          true);
      pt( 0,           size * 0.5, false);
      pt(-size * 0.75, 0,          false);
      pt( 0,          -size * 0.5, false);
    }
    ctx.closePath();
  }

  /**
   * Stars / hyperspace warp tunnel.
   * Particles spawn near a central vanishing point and fly outward radially.
   * Per-particle shapes (streak, star, triangle, diamond, circle) are drawn at
   * the leading edge of each particle with a tapered trail behind them.
   */
  _renderStars(layer, ctx, w, h, time, audioLevel) {
    const { scale, speed, turbulence, opacity, drift, distortion, reactivity } = layer.params;
    const hNorm = layer.hue / 360;
    const isMono = layer.colorMode === 'mono';

    // Stars-specific params (with defaults for backward compat)
    const rotSpeed = layer._starsRotSpeed ?? 0;
    const rotDir = layer._starsRotDir ?? 'cw';
    const thickness = layer._starsThickness ?? 1.0;
    const starSize = layer._starsSize ?? 1.0;
    const tailLength = layer._starsTailLength ?? 1.0;
    const originRadius = layer._starsOriginRadius ?? 0;
    const isBackward = (layer._starsFlowDir ?? 'forward') === 'backward';
    const particleShape = layer._starsParticleShape ?? 'streak';
    const isMultiColor = layer.hue > 360;
    // Effective hue for single-color mode; multicolor cycles per-particle
    const effectiveHNorm = isMultiColor ? ((time * 0.05) % 1) : ((hNorm % 1 + 1) % 1);

    // Audio
    const audioBoost = audioLevel * reactivity;
    // Low end extends to near-zero: floor of 2px/s instead of 80px/s
    const baseVel = 2 + speed * 600;
    const radialVel = baseVel + audioBoost * 800;
    const streakFactor = (1.5 + speed * 2.5 + audioBoost * 6) * tailLength;

    // Persistence / decay
    const decay = distortion;
    if (decay > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - decay * 0.92})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    // Per-layer state
    if (!layer._stars) layer._stars = [];
    if (layer._lastStarsTime === undefined) layer._lastStarsTime = time;
    if (layer._starsRotAngle === undefined) layer._starsRotAngle = 0;

    const dt = Math.min(0.1, Math.max(0, time - layer._lastStarsTime));
    layer._lastStarsTime = time;

    if (rotSpeed > 0) {
      layer._starsRotAngle += rotSpeed * dt * (Math.PI / 6) * (rotDir === 'cw' ? 1 : -1);
    }

    // Vanishing point
    const driftX = drift * 30 * Math.sin(time * 0.13 + layer.offset.x);
    const driftY = drift * 30 * Math.cos(time * 0.11 + layer.offset.y);
    const cx = w / 2 + driftX;
    const cy = h / 2 + driftY;

    const maxR = Math.sqrt((w * 0.5) ** 2 + (h * 0.5) ** 2) * 1.15;
    const minDim = Math.min(w, h);
    const spawnR = originRadius * minDim * 0.5;

    const targetCount = Math.min(350, Math.floor(80 + scale * 100 + audioBoost * 80));

    const spawnStar = (star) => {
      if (isBackward) {
        star.angle = Math.random() * Math.PI * 2;
        star.r = maxR * (0.82 + Math.random() * 0.13);
      } else {
        star.angle = Math.random() * Math.PI * 2;
        star.r = spawnR + Math.random() * minDim * 0.04 + 1;
      }
      star.prevR = star.r;
      star.velMul = 0.5 + Math.random() * 0.9;
      star.brightness = 0.55 + Math.random() * 0.45;
      star.hueOffset = (Math.random() - 0.5) * 0.06;
      star.hueBase = Math.random(); // 0–1 random hue for multicolor cycling
    };

    while (layer._stars.length < targetCount) {
      const star = {};
      spawnStar(star);
      layer._stars.push(star);
    }

    // Update + build draw list
    const drawList = [];
    for (let i = layer._stars.length - 1; i >= 0; i--) {
      const star = layer._stars[i];
      star.prevR = star.r;
      star.r += (isBackward ? -1 : 1) * radialVel * star.velMul * dt;

      const expired = isBackward
        ? (star.r < Math.max(1, spawnR * 0.5))
        : (star.r > maxR);
      if (expired) { spawnStar(star); continue; }

      const step = Math.abs(star.r - star.prevR);
      const streakLen = Math.min(maxR * 0.6, step * streakFactor);
      const tailR = isBackward
        ? Math.min(maxR * 1.05, star.r + streakLen)
        : Math.max(0, star.r - streakLen);

      const depth = star.r / maxR;
      const edgeFade = isBackward
        ? (depth < 0.15 ? Math.max(0, depth / 0.15) : 1)
        : (depth > 0.85 ? Math.max(0, 1 - (depth - 0.85) / 0.15) : 1);

      const cosA = Math.cos(star.angle);
      const sinA = Math.sin(star.angle);
      // headDir: direction the shape's leading tip should face
      // Forward → pointing outward from center; backward → pointing toward center
      const headDir = isBackward ? (star.angle + Math.PI) : star.angle;
      drawList.push({
        x1: cx + cosA * tailR,   // tail
        y1: cy + sinA * tailR,
        x2: cx + cosA * star.r,  // head
        y2: cy + sinA * star.r,
        depth, edgeFade, headDir,
        brightness: star.brightness,
        hueOffset: star.hueOffset,
        hueBase: star.hueBase,
      });
    }

    ctx.lineCap = 'round';
    ctx.globalAlpha = opacity;

    // Rotation transform
    const rotAngle = layer._starsRotAngle;
    const hasRotation = rotAngle !== 0;
    if (hasRotation) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotAngle);
      ctx.translate(-cx, -cy);
    }

    const isStreak = particleShape === 'streak';

    // --- Glow pass (lighter composite, bloom halo) ---
    const glowStrength = turbulence * 0.7 + audioBoost * 0.9;
    if (glowStrength > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < drawList.length; i++) {
        const d = drawList[i];
        const alpha = d.brightness * d.edgeFade * glowStrength * 0.45;
        if (alpha < 0.02) continue;
        const baseW = (0.5 + d.depth * (1.5 + speed * 1.2 + scale * 0.6)) * thickness;
        const h360 = isMultiColor
          ? (((d.hueBase + time * 0.05) % 1) * 360)
          : ((effectiveHNorm + d.hueOffset) % 1) * 360;
        const sat = isMono ? 0 : 0.4 + (1 - d.depth) * 0.3;
        const lightness = 60 + d.depth * 25;
        const style = `hsla(${h360},${Math.round(sat*100)}%,${Math.min(95,lightness)}%,${alpha})`;
        if (isStreak) {
          ctx.strokeStyle = style;
          ctx.lineWidth = baseW * (3.5 + d.depth * 2.5) * starSize;
          ctx.beginPath();
          ctx.moveTo(d.x1, d.y1);
          ctx.lineTo(d.x2, d.y2);
          ctx.stroke();
        } else {
          const shapeR = Math.max(3, baseW) * (3.5 + d.depth * 2.0) * starSize;
          // Tapered trail line stops just before the shape head
          const dxHT = d.x1 - d.x2, dyHT = d.y1 - d.y2;
          const lenHT = Math.hypot(dxHT, dyHT) || 1;
          if (lenHT > shapeR) {
            ctx.strokeStyle = style;
            ctx.lineWidth = baseW * 1.5 * starSize;
            ctx.beginPath();
            ctx.moveTo(d.x1, d.y1);
            ctx.lineTo(d.x2 + dxHT / lenHT * shapeR, d.y2 + dyHT / lenHT * shapeR);
            ctx.stroke();
          }
          ctx.fillStyle = style;
          this._starsDrawShape(ctx, particleShape, d.x2, d.y2, shapeR, d.headDir);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // --- Core pass (crisp solid shapes / lines) ---
    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      const alpha = d.brightness * d.edgeFade;
      const baseW = (0.5 + d.depth * (1.5 + speed * 1.2 + scale * 0.6)) * thickness;
      const h360 = isMultiColor
        ? (((d.hueBase + time * 0.05) % 1) * 360)
        : ((effectiveHNorm + d.hueOffset) % 1) * 360;
      const sat = isMono ? 0 : 0.15 + (1 - d.depth) * 0.25;
      const lightness = 70 + d.depth * 25;
      const style = `hsla(${h360},${Math.round(sat*100)}%,${Math.min(98,lightness)}%,${alpha})`;
      if (isStreak) {
        ctx.strokeStyle = style;
        ctx.lineWidth = baseW * starSize;
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
      } else {
        const shapeR = Math.max(3, baseW) * 2.5 * starSize;
        const dxHT = d.x1 - d.x2, dyHT = d.y1 - d.y2;
        const lenHT = Math.hypot(dxHT, dyHT) || 1;
        if (lenHT > shapeR) {
          ctx.strokeStyle = style;
          ctx.lineWidth = baseW * 0.6 * starSize;
          ctx.beginPath();
          ctx.moveTo(d.x1, d.y1);
          ctx.lineTo(d.x2 + dxHT / lenHT * shapeR, d.y2 + dyHT / lenHT * shapeR);
          ctx.stroke();
        }
        ctx.fillStyle = style;
        this._starsDrawShape(ctx, particleShape, d.x2, d.y2, shapeR, d.headDir);
        ctx.fill();
      }
    }

    if (hasRotation) ctx.restore();

    // Central vanishing-point glow (suppressed for backward mode and large spread)
    const centralGlowFade = isBackward ? 0 : Math.max(0, 1 - originRadius * 8);
    const coreR = 6 + audioBoost * 30;
    if (centralGlowFade > 0.01 && coreR > 4) {
      const [r, g, b] = hslToRgb(hNorm, isMono ? 0 : 0.4, 0.85);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      grad.addColorStop(0, `rgba(${r},${g},${b},${(0.18 + audioBoost * 0.5) * opacity * centralGlowFade})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.shadowBlur = 0;
      ctx.fillStyle = grad;
      ctx.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ============================================================
  // Lightning layer
  // ============================================================

  /**
   * Recursively subdivide a segment into a jagged path with optional
   * branching offshoots. Returns the main path; branches are pushed
   * into the `branches` array.
   */
  _genLightningPath(x1, y1, x2, y2, jitter, depth, maxDepth, branchProb, branches, maxBranches) {
    if (depth >= maxDepth) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular unit vector
    const px = -dy / len, py = dx / len;
    // Jittered midpoint
    const off = (Math.random() - 0.5) * jitter;
    const mx = (x1 + x2) / 2 + px * off;
    const my = (y1 + y2) / 2 + py * off;

    // Possibly spawn a branch from the midpoint (deeper levels only — keeps tree readable)
    if (depth >= 2 && branches.length < maxBranches && Math.random() < branchProb) {
      const baseAngle = Math.atan2(dy, dx);
      const branchAngle = baseAngle + (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.9);
      const branchLen = len * (0.35 + Math.random() * 0.4);
      const bx = mx + Math.cos(branchAngle) * branchLen;
      const by = my + Math.sin(branchAngle) * branchLen;
      const bPath = this._genLightningPath(mx, my, bx, by, jitter * 0.55, depth + 1, maxDepth - 1, branchProb * 0.5, branches, maxBranches);
      branches.push(bPath);
    }

    const left = this._genLightningPath(x1, y1, mx, my, jitter * 0.55, depth + 1, maxDepth, branchProb, branches, maxBranches);
    const right = this._genLightningPath(mx, my, x2, y2, jitter * 0.55, depth + 1, maxDepth, branchProb, branches, maxBranches);
    return left.concat(right.slice(1));
  }

  /**
   * Build a single lightning strike with main bolt + branches.
   * Two strike types:
   *   'arc'    — full-screen, edge-to-edge or corner-to-corner
   *   'local'  — short, concentrated bolt at a random spot
   */
  _spawnLightningStrike(layer, w, h, time, intensity, branching, audioBoost) {
    const isArc = Math.random() < 0.55;
    let x1, y1, x2, y2, baseLen;

    if (isArc) {
      // Pick two points on different edges of the canvas
      const pickEdgePoint = () => {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) return [Math.random() * w, -h * 0.05];           // top
        if (side === 1) return [w * 1.05, Math.random() * h];            // right
        if (side === 2) return [Math.random() * w, h * 1.05];            // bottom
        return [-w * 0.05, Math.random() * h];                            // left
      };
      let [ax, ay] = pickEdgePoint();
      let [bx, by] = pickEdgePoint();
      // If both ended up on the same side, force opposite
      if (Math.hypot(bx - ax, by - ay) < Math.min(w, h) * 0.5) {
        bx = w - ax; by = h - ay;
      }
      x1 = ax; y1 = ay; x2 = bx; y2 = by;
      baseLen = Math.hypot(x2 - x1, y2 - y1);
    } else {
      // Local strike — a shorter bolt at a random position with random direction
      const cx = w * (0.15 + Math.random() * 0.7);
      const cy = h * (0.15 + Math.random() * 0.7);
      const localLen = Math.min(w, h) * (0.18 + Math.random() * 0.32) * (0.6 + intensity * 0.9);
      const angle = Math.random() * Math.PI * 2;
      x1 = cx - Math.cos(angle) * localLen * 0.5;
      y1 = cy - Math.sin(angle) * localLen * 0.5;
      x2 = cx + Math.cos(angle) * localLen * 0.5;
      y2 = cy + Math.sin(angle) * localLen * 0.5;
      baseLen = localLen;
    }

    const jitter = baseLen * (0.08 + branching * 0.1);
    const maxDepth = isArc ? 7 : 6;
    const branches = [];
    const maxBranches = Math.floor(2 + branching * 14);
    const branchProb = 0.18 + branching * 0.6;
    const main = this._genLightningPath(x1, y1, x2, y2, jitter, 0, maxDepth, branchProb, branches, maxBranches);

    // Pick color — multi-color sentinel (>360) randomizes per strike
    const isMulti = layer.hue > 360;
    const strikeHue = isMulti ? Math.random() * 360 : layer.hue;

    return {
      type: isArc ? 'arc' : 'local',
      main, branches,
      born: time,
      duration: layer._lightStrikeDuration,
      intensity: intensity * (0.85 + Math.random() * 0.3) * (1 + audioBoost * 0.6),
      hue: strikeHue,
      // Flash bloom anchor — brightest near the middle of the bolt
      flashX: (x1 + x2) * 0.5,
      flashY: (y1 + y2) * 0.5,
      flashR: baseLen * (isArc ? 0.35 : 0.55),
    };
  }

  _renderLightning(layer, ctx, w, h, time, audioLevel) {
    const { opacity, distortion, reactivity, scale } = layer.params;
    const isMono = layer.colorMode === 'mono';

    // Lightning-specific params (with defaults)
    const freq      = layer._lightFreq       ?? 0.4;
    const intensity = layer._lightIntensity  ?? 0.6;
    const branching = layer._lightBranching  ?? 0.5;
    const durationP = layer._lightDuration   ?? 0.4;

    // 0..1 → real seconds, sharp flash + glow tail
    layer._lightStrikeDuration = 0.08 + durationP * 1.2;

    const audioActive = layer.audioSync && layer.audioSource !== 'none';
    // audioLevel is already source-filtered (bass/mids/treble/full/none) from _getAudioForLayer
    const audioBoost = audioLevel * reactivity;

    // Persistence / decay (background fade-out)
    const decay = distortion;
    if (decay > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - decay * 0.92})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    // Per-layer state
    if (!layer._strikes) layer._strikes = [];
    if (layer._lightNextTime === undefined) layer._lightNextTime = time + 0.05;
    if (layer._lightLastBeatTime === undefined) layer._lightLastBeatTime = 0;

    if (audioActive) {
      // --- Audio sensitivity mode ---
      // Frequency = threshold lever: how loud audio needs to be to trigger a strike.
      // Remap slider 0..1 → internal 0.35..1 so the floor matches the old freq=0.35 feel.
      const fMapped = 0.35 + freq * 0.65;
      const threshold = 0.03 + Math.pow(1 - fMapped, 2.0) * 0.97;
      const cooldown  = 0.06 + Math.pow(1 - fMapped, 1.6) * 1.54;
      if (audioBoost > threshold && time - layer._lightLastBeatTime > cooldown && layer._strikes.length < 14) {
        layer._lightLastBeatTime = time;
        layer._lightNextTime = time + cooldown; // keep timer synced
        layer._strikes.push(this._spawnLightningStrike(layer, w, h, time, intensity, branching, audioBoost));
      }
    } else {
      // --- Pure rate mode (no audio) ---
      // freq=0 → ~5 s between strikes, freq=1 → ~0.05 s
      const baseInt = 0.05 + Math.pow(1 - freq, 2.2) * 5;
      let safety = 8;
      while (time >= layer._lightNextTime && layer._strikes.length < 14 && safety-- > 0) {
        layer._strikes.push(this._spawnLightningStrike(layer, w, h, time, intensity, branching, 0));
        layer._lightNextTime = time + baseInt * (0.6 + Math.random() * 0.8);
      }
    }

    // Draw all live strikes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;

    // Helper: stroke a path array with current ctx style
    const strokePath = (path) => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let k = 1; k < path.length; k++) ctx.lineTo(path[k].x, path[k].y);
      ctx.stroke();
    };

    for (let i = layer._strikes.length - 1; i >= 0; i--) {
      const s = layer._strikes[i];
      const age = time - s.born;
      if (age >= s.duration) { layer._strikes.splice(i, 1); continue; }

      const t = age / s.duration; // 0..1
      // Sharp flash spike at birth (first ~8% of lifetime), then exponential glow tail
      const flashWindow = 0.08;
      const flash = t < flashWindow ? 1 : Math.exp(-(t - flashWindow) * 5);
      const glow  = Math.exp(-t * 3.5);

      const baseW = (1 + intensity * 4 + scale * 0.5) * (s.type === 'arc' ? 1 : 0.85);
      const strikeAlpha = s.intensity;

      // Saturation: mono collapses to 0, otherwise high saturation so the hue is visible
      const glowSat  = isMono ? 0 : 85;   // % — fully saturated colored glow
      const glowLight = 52;                // % — mid-range so hue reads clearly through `lighter`

      // --- 1) Bloom flash: white-hot at center, colored corona around it ---
      if (flash > 0.04) {
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(s.flashX, s.flashY, 0, s.flashX, s.flashY, s.flashR);
        const fa = Math.min(0.75, flash * strikeAlpha * 0.65);
        // Center: near-white blast; outer ring: hue-colored
        grad.addColorStop(0,    `hsla(${s.hue}, ${isMono ? 0 : 15}%, 92%, ${fa})`);
        grad.addColorStop(0.25, `hsla(${s.hue}, ${glowSat}%, 60%, ${fa * 0.7})`);
        grad.addColorStop(0.65, `hsla(${s.hue}, ${glowSat}%, ${glowLight}%, ${fa * 0.3})`);
        grad.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(s.flashX - s.flashR, s.flashY - s.flashR, s.flashR * 2, s.flashR * 2);
      }

      // --- 2) Outer glow halo — wide, colored, fades with glow curve ---
      ctx.globalCompositeOperation = 'lighter';
      const haloAlpha = Math.min(0.55, (glow * 0.55 + flash * 0.3) * strikeAlpha);
      if (haloAlpha > 0.02) {
        ctx.strokeStyle = `hsla(${s.hue}, ${glowSat}%, ${glowLight}%, ${haloAlpha})`;
        ctx.lineWidth = baseW * 5 + flash * 4;
        strokePath(s.main);
        ctx.lineWidth = baseW * 2.5 + flash * 2;
        for (let b = 0; b < s.branches.length; b++) strokePath(s.branches[b]);
      }

      // --- 3) Core bolt — white-hot during flash, transitions to hue-colored glow tail ---
      ctx.globalCompositeOperation = 'lighter';
      const coreAlpha = Math.min(1, (flash * 0.9 + glow * 0.4) * strikeAlpha);
      if (coreAlpha > 0.03) {
        // At flash=1: nearly white (hot impact). As flash→0: full hue color (glow residue).
        const coreSat   = isMono ? 0 : Math.round(glowSat * (1 - flash * 0.92));
        const coreLight = Math.round(isMono ? 60 + flash * 38 : 58 + flash * 40);
        ctx.strokeStyle = `hsla(${s.hue}, ${coreSat}%, ${Math.min(98, coreLight)}%, ${coreAlpha})`;
        ctx.lineWidth = Math.max(1, baseW * (1 + flash * 0.6));
        strokePath(s.main);
        ctx.lineWidth = Math.max(0.7, baseW * 0.55);
        for (let b = 0; b < s.branches.length; b++) strokePath(s.branches[b]);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
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
      case 'stars': this._renderStars(layer, lCtx, bw, bh, time, audioLevel); break;
      case 'lightning': this._renderLightning(layer, lCtx, bw, bh, time, audioLevel); break;
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

    // Brightness — CSS filter applied via drawImage through a tmp canvas
    const brightness = layer.params.brightness ?? 0;
    if (Math.abs(brightness) > 0.01) {
      const bVal = Math.max(0, 1 + brightness); // -1→0 (black), 0→1 (normal), +1→2 (2× bright)
      if (!this._tmpCanvas) this._tmpCanvas = document.createElement('canvas');
      const btc = this._tmpCanvas;
      if (btc.width !== bw || btc.height !== bh) { btc.width = bw; btc.height = bh; }
      const btCtx = btc.getContext('2d');
      btCtx.clearRect(0, 0, bw, bh);
      btCtx.drawImage(lCanvas, 0, 0);
      lCtx.clearRect(0, 0, bw, bh);
      lCtx.filter = `brightness(${bVal.toFixed(3)})`;
      lCtx.drawImage(btc, 0, 0);
      lCtx.filter = 'none';
    }

    // Spin rotation — canvas-level post-render rotation around the layer centre
    if (SPIN_LAYER_TYPES.has(layer.type)) {
      const spinSpeed = layer._spinSpeed ?? 0;
      if (layer._spinAngle === undefined) layer._spinAngle = 0;
      if (layer._lastSpinTime === undefined) layer._lastSpinTime = time;
      const spinDt = Math.min(0.1, time - layer._lastSpinTime);
      layer._lastSpinTime = time;
      if (spinSpeed > 0) {
        const spinDir = layer._spinDir ?? 'cw';
        layer._spinAngle += spinSpeed * spinDt * (Math.PI / 6) * (spinDir === 'cw' ? 1 : -1);
      }
      if (spinSpeed > 0) {
        // Only apply the rotation transform when spin is actually running.
        // Gating on spinSpeed (not _spinAngle) means the layer snaps back to
        // normal 1:1 size the instant speed returns to zero, with no lingering zoom.
        if (!this._spinTmpCanvas) this._spinTmpCanvas = document.createElement('canvas');
        const stc = this._spinTmpCanvas;
        if (stc.width !== bw || stc.height !== bh) { stc.width = bw; stc.height = bh; }
        const stCtx = stc.getContext('2d');
        stCtx.clearRect(0, 0, bw, bh);
        stCtx.drawImage(lCanvas, 0, 0);
        const spinScale = Math.hypot(bw, bh) / Math.min(bw, bh);
        lCtx.clearRect(0, 0, bw, bh);
        lCtx.save();
        lCtx.translate(bw / 2, bh / 2);
        lCtx.rotate(layer._spinAngle);
        lCtx.scale(spinScale, spinScale);
        lCtx.translate(-bw / 2, -bh / 2);
        lCtx.drawImage(stc, 0, 0);
        lCtx.restore();
      }
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

  // --- Mask helpers ---

  _cloneMasks(masks) {
    if (!Array.isArray(masks)) return [];
    return masks.map(m => {
      const o = { type: m.type };
      if (m.type === 'rect' || m.type === 'ellipse') {
        o.x = m.x; o.y = m.y; o.w = m.w; o.h = m.h;
      } else if (m.type === 'freehand' && Array.isArray(m.points)) {
        o.points = m.points.map(p => [p[0], p[1]]);
      }
      return o;
    });
  }

  _layerHasActiveMask(layer) {
    return Array.isArray(layer._masks) && layer._masks.length > 0;
  }

  // Add the union of all mask shapes (in normalized coords) to a Path2D, scaled to (w,h)
  _addMaskShapesToPath(path, masks, w, h) {
    if (!Array.isArray(masks)) return;
    for (const m of masks) {
      if (m.type === 'rect') {
        path.rect(m.x * w, m.y * h, m.w * w, m.h * h);
      } else if (m.type === 'ellipse') {
        const cx = (m.x + m.w / 2) * w;
        const cy = (m.y + m.h / 2) * h;
        const rx = Math.max(0, Math.abs(m.w / 2) * w);
        const ry = Math.max(0, Math.abs(m.h / 2) * h);
        if (rx > 0 && ry > 0) path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else if (m.type === 'freehand' && Array.isArray(m.points) && m.points.length > 1) {
        path.moveTo(m.points[0][0] * w, m.points[0][1] * h);
        for (let i = 1; i < m.points.length; i++) {
          path.lineTo(m.points[i][0] * w, m.points[i][1] * h);
        }
        path.closePath();
      }
    }
  }

  // Apply the layer's mask as a clipping region on the given ctx.
  // Caller must ctx.save() before and ctx.restore() after.
  _applyMaskClip(ctx, layer, w, h) {
    const path = new Path2D();
    if ((layer._maskMode ?? 'include') === 'exclude') {
      // Render everywhere EXCEPT inside the masks.
      // Outer rect + inner shapes with even-odd fill creates a hole-punched clip.
      path.rect(0, 0, w, h);
      this._addMaskShapesToPath(path, layer._masks, w, h);
      ctx.clip(path, 'evenodd');
    } else {
      this._addMaskShapesToPath(path, layer._masks, w, h);
      ctx.clip(path);
    }
  }

  // --- Mask shape hit testing & geometry helpers ---

  // Point-in-polygon via ray casting (normalized coords)
  _pointInPolygon(px, py, points) {
    let inside = false;
    const n = points.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = points[i][0], yi = points[i][1];
      const xj = points[j][0], yj = points[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Test whether normalized point (px, py) lies inside mask shape m
  _maskShapeHitTest(m, px, py) {
    if (m.type === 'rect') {
      const left = Math.min(m.x, m.x + m.w), right  = Math.max(m.x, m.x + m.w);
      const top  = Math.min(m.y, m.y + m.h), bottom = Math.max(m.y, m.y + m.h);
      return px >= left && px <= right && py >= top && py <= bottom;
    }
    if (m.type === 'ellipse') {
      const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
      const rx = Math.abs(m.w / 2), ry = Math.abs(m.h / 2);
      if (rx < 0.001 || ry < 0.001) return false;
      return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
    }
    if (m.type === 'freehand' && Array.isArray(m.points) && m.points.length > 2) {
      return this._pointInPolygon(px, py, m.points);
    }
    return false;
  }

  // Return index of topmost mask shape containing point, or -1
  _maskFindShapeAtPoint(masks, px, py) {
    for (let i = masks.length - 1; i >= 0; i--) {
      if (this._maskShapeHitTest(masks[i], px, py)) return i;
    }
    return -1;
  }

  // Resize handle descriptors for a rect or ellipse (normalized coords)
  _maskGetHandles(m) {
    if (m.type !== 'rect' && m.type !== 'ellipse') return [];
    const left = Math.min(m.x, m.x + m.w), right  = Math.max(m.x, m.x + m.w);
    const top  = Math.min(m.y, m.y + m.h), bottom = Math.max(m.y, m.y + m.h);
    const mx = (left + right) / 2, my = (top + bottom) / 2;
    return [
      { id: 'tl', nx: left, ny: top    }, { id: 't',  nx: mx,    ny: top    },
      { id: 'tr', nx: right, ny: top   }, { id: 'r',  nx: right, ny: my     },
      { id: 'br', nx: right, ny: bottom}, { id: 'b',  nx: mx,    ny: bottom },
      { id: 'bl', nx: left, ny: bottom }, { id: 'l',  nx: left,  ny: my     },
    ];
  }

  // Find which resize handle is within ~8 canvas-px of (px, py), or null
  _maskFindHandle(m, px, py, cw, ch) {
    const thresh = 9 / Math.min(cw, ch);
    for (const h of this._maskGetHandles(m)) {
      if (Math.hypot(px - h.nx, py - h.ny) < thresh) return h;
    }
    return null;
  }

  // Apply a resize drag to origShape: handle dragged to (px, py), shift = lock aspect ratio
  _maskApplyResize(origShape, handleId, px, py, shiftKey) {
    const left0 = Math.min(origShape.x, origShape.x + origShape.w);
    const right0 = Math.max(origShape.x, origShape.x + origShape.w);
    const top0   = Math.min(origShape.y, origShape.y + origShape.h);
    const bot0   = Math.max(origShape.y, origShape.y + origShape.h);

    let left = left0, right = right0, top = top0, bot = bot0;
    const tl = handleId.includes('l'), tr = handleId.includes('r');
    const tt = handleId.includes('t'), tb = handleId.includes('b');
    if (tl) left  = Math.min(px, right0 - 0.005);
    if (tr) right = Math.max(px, left0  + 0.005);
    if (tt) top   = Math.min(py, bot0   - 0.005);
    if (tb) bot   = Math.max(py, top0   + 0.005);

    if (shiftKey && tl !== tr && tt !== tb) { // corner handle
      const origAR = (right0 - left0) / (bot0 - top0);
      const newW = right - left, newH = bot - top;
      if (newW / origAR >= newH) { // width dominates
        const h2 = newW / origAR;
        if (tt) top = bot - h2; else bot = top + h2;
      } else {
        const w2 = newH * origAR;
        if (tl) left = right - w2; else right = left + w2;
      }
    }
    return { ...origShape, x: left, y: top, w: right - left, h: bot - top };
  }

  // --- Mask local undo/redo ---

  _maskHistoryPush() {
    const layer = this.layers[this._maskEditingLayerIndex];
    if (!layer) return;
    // Truncate any redo tail
    this._maskLocalHistory = this._maskLocalHistory.slice(0, this._maskLocalHistoryIdx + 1);
    this._maskLocalHistory.push(this._cloneMasks(layer._masks));
    this._maskLocalHistoryIdx = this._maskLocalHistory.length - 1;
    this._maskUpdateUndoRedo();
  }

  _maskHistoryUndo() {
    if (this._maskLocalHistoryIdx <= 0) return;
    const layer = this.layers[this._maskEditingLayerIndex];
    if (!layer) return;
    this._maskLocalHistoryIdx--;
    layer._masks = this._cloneMasks(this._maskLocalHistory[this._maskLocalHistoryIdx]);
    this._maskSelectedShapeIdx = -1;
    this._maskUpdateUndoRedo();
  }

  _maskHistoryRedo() {
    if (this._maskLocalHistoryIdx >= this._maskLocalHistory.length - 1) return;
    const layer = this.layers[this._maskEditingLayerIndex];
    if (!layer) return;
    this._maskLocalHistoryIdx++;
    layer._masks = this._cloneMasks(this._maskLocalHistory[this._maskLocalHistoryIdx]);
    this._maskSelectedShapeIdx = -1;
    this._maskUpdateUndoRedo();
  }

  _maskUpdateUndoRedo() {
    if (this._maskUndoBtn) this._maskUndoBtn.disabled = this._maskLocalHistoryIdx <= 0;
    if (this._maskRedoBtn) this._maskRedoBtn.disabled = this._maskLocalHistoryIdx >= this._maskLocalHistory.length - 1;
  }

  // --- Mask edit mode ---

  _enterMaskEditMode(layerIndex) {
    if (layerIndex < 0 || layerIndex >= this.layers.length) return;
    const layer = this.layers[layerIndex];
    if (!Array.isArray(layer._masks)) layer._masks = [];
    if (!layer._maskMode) layer._maskMode = 'include';
    this._maskEditingLayerIndex = layerIndex;
    this._maskDrawing = false;
    this._maskCurrentDraw = null;
    this._maskPolygonPoints = [];
    this._maskPolygonCursor = null;
    this._maskPolyDragging = false;
    this._maskPolyDragSource = null;
    this._maskPolyDragWas = false;
    this._maskSelectedShapeIdx = -1;
    this._maskShiftKey = false;
    this._maskMoveState = null;
    this._maskResizeState = null;
    this._maskLocalHistory = [];
    this._maskLocalHistoryIdx = -1;
    // Seed the local history with the current mask state
    this._maskHistoryPush();
    // Hide the settings panel so the canvas is fully visible while drawing.
    // The mask toolbar is `position:fixed` and stays on top.
    if (this.panelEl && this._maskPanelPrevDisplay === undefined) {
      this._maskPanelPrevDisplay = this.panelEl.style.display || '';
      this.panelEl.style.display = 'none';
    }
    // Also force-hide the title bar, menu bar, and status bar so only the
    // mask toolbar floats over the canvas. On exit we restore to _llUiHidden
    // so the user's chosen global hide state is honoured.
    for (const cls of ['.title-bar', '.menu-bar', '.status-bar']) {
      const el = document.querySelector(cls);
      if (el) el.style.display = 'none';
    }
    this._buildMaskToolbar();
    this._attachMaskCanvasHandlers();
    // Note: _rebuildLayerKnobs not needed here — panel is hidden.
    // It will be rebuilt when we restore on exit.
  }

  _exitMaskEditMode() {
    this._maskEditingLayerIndex = -1;
    this._maskDrawing = false;
    this._maskCurrentDraw = null;
    this._maskPolygonPoints = [];
    this._maskPolygonCursor = null;
    this._maskPolyDragging = false;
    this._maskPolyDragSource = null;
    this._maskPolyDragWas = false;
    this._maskSelectedShapeIdx = -1;
    this._maskShiftKey = false;
    this._maskMoveState = null;
    this._maskResizeState = null;
    this._maskLocalHistory = [];
    this._maskLocalHistoryIdx = -1;
    this._maskUndoBtn = null;
    this._maskRedoBtn = null;
    this._destroyMaskToolbar();
    this._detachMaskCanvasHandlers();
    // Restore the settings panel to whatever display state it had before
    if (this.panelEl && this._maskPanelPrevDisplay !== undefined) {
      this.panelEl.style.display = this._maskPanelPrevDisplay;
      this._maskPanelPrevDisplay = undefined;
    }
    // Restore title / menu bars to the user's chosen global UI state.
    // If _llUiHidden is true the user had hidden everything; keep it hidden.
    // If false, show the bars again.
    for (const cls of ['.title-bar', '.menu-bar', '.status-bar']) {
      const el = document.querySelector(cls);
      if (el) el.style.display = this._llUiHidden ? 'none' : '';
    }
    this._rebuildLayerList();
    this._rebuildLayerKnobs();
    this._pushHistory();
  }

  // Toggle all UI chrome: settings panel + title bar + menu bar + status bar.
  // Used by canvas-click-to-hide on desktop and by main.js setUIHidden on mobile.
  _toggleLLFullUI() {
    this._llUiHidden = !this._llUiHidden;
    this._applyLLUIHidden(this._llUiHidden);
  }

  _applyLLUIHidden(hidden) {
    if (this.panelEl) this.panelEl.style.display = hidden ? 'none' : '';
    for (const cls of ['.title-bar', '.menu-bar', '.status-bar']) {
      const el = document.querySelector(cls);
      if (el) el.style.display = hidden ? 'none' : '';
    }
  }

  // Called by main.js on mobile tap-to-hide so the visualizer controls its own chrome.
  setUIHidden(hidden) {
    this._llUiHidden = hidden;
    // Panel visibility is already handled by main.js (ll-ui-hidden class).
    // We only need to handle the extra chrome elements here.
    for (const cls of ['.title-bar', '.menu-bar', '.status-bar']) {
      const el = document.querySelector(cls);
      if (el) el.style.display = hidden ? 'none' : '';
    }
  }

  // Close and commit the in-progress polygon.
  _closePolygon() {
    const layer = this.layers[this._maskEditingLayerIndex];
    const pts = this._maskPolygonPoints;
    this._maskPolygonPoints = [];
    this._maskPolygonCursor = null;
    if (!layer || pts.length < 3) return;
    if (!Array.isArray(layer._masks)) layer._masks = [];
    layer._masks.push({ type: 'freehand', points: pts });
    this._maskSelectedShapeIdx = layer._masks.length - 1;
    this._maskHistoryPush();
  }

  _buildMaskToolbar() {
    this._destroyMaskToolbar();
    const layer = this.layers[this._maskEditingLayerIndex];
    if (!layer) return;

    const bar = document.createElement('div');
    bar.className = 'll-mask-toolbar';
    bar.style.cssText = [
      'position:fixed;left:50%;top:16px;transform:translateX(-50%);',
      'display:flex;gap:6px;align-items:center;',
      'background:rgba(15,15,18,0.92);border:1px solid #444;border-radius:8px;',
      'padding:6px 10px;z-index:10000;',
      'font-family:monospace;color:#eee;box-shadow:0 4px 16px rgba(0,0,0,0.5);',
      'user-select:none;',
    ].join('');

    const title = document.createElement('span');
    title.textContent = `🎭 Mask: Layer ${this._maskEditingLayerIndex + 1}`;
    title.style.cssText = 'font-size:11px;font-weight:bold;margin-right:6px;';
    bar.appendChild(title);

    const makeBtn = (label, title, active) => {
      const b = document.createElement('button');
      b.className = 'll-toggle' + (active ? ' active' : '');
      b.textContent = label;
      b.title = title;
      b.style.cssText = 'padding:4px 8px;font-size:11px;';
      return b;
    };

    // Tool buttons
    const tools = [
      ['rect',     '▭ Rect',     'Drag to draw a rectangle mask'],
      ['ellipse',  '◯ Ellipse',  'Drag to draw an ellipse mask'],
      ['freehand', '✏ Freehand', 'Drag to draw a freehand region'],
      ['polygon',  '⬡ Polygon',  'Click to place vertices; double-click or click first point to close'],
    ];
    const toolBtns = {};
    tools.forEach(([key, label, tip]) => {
      const b = makeBtn(label, tip, this._maskTool === key);
      b.addEventListener('click', () => {
        // Cancel any in-progress polygon when switching tools
        this._maskPolygonPoints = [];
        this._maskPolygonCursor = null;
        this._maskTool = key;
        Object.values(toolBtns).forEach(bb => bb.classList.remove('active'));
        b.classList.add('active');
      });
      toolBtns[key] = b;
      bar.appendChild(b);
    });

    // Separator
    const sep1 = document.createElement('span');
    sep1.style.cssText = 'width:1px;height:18px;background:#444;margin:0 2px;';
    bar.appendChild(sep1);

    // Include/Exclude toggle
    const modeLabel = document.createElement('span');
    modeLabel.textContent = 'Mode:';
    modeLabel.style.cssText = 'font-size:11px;color:#aaa;';
    bar.appendChild(modeLabel);

    const incBtn = makeBtn('Include', 'Layer renders only inside masked region', layer._maskMode === 'include');
    incBtn.style.cssText += 'background:' + (layer._maskMode === 'include' ? '#2a6' : 'transparent') + ';';
    const excBtn = makeBtn('Exclude', 'Layer renders everywhere except masked region', layer._maskMode === 'exclude');
    excBtn.style.cssText += 'background:' + (layer._maskMode === 'exclude' ? '#a62' : 'transparent') + ';';
    incBtn.addEventListener('click', () => {
      layer._maskMode = 'include';
      incBtn.classList.add('active');
      excBtn.classList.remove('active');
      incBtn.style.background = '#2a6';
      excBtn.style.background = 'transparent';
    });
    excBtn.addEventListener('click', () => {
      layer._maskMode = 'exclude';
      excBtn.classList.add('active');
      incBtn.classList.remove('active');
      excBtn.style.background = '#a62';
      incBtn.style.background = 'transparent';
    });
    bar.appendChild(incBtn);
    bar.appendChild(excBtn);

    // Separator
    const sep2 = document.createElement('span');
    sep2.style.cssText = 'width:1px;height:18px;background:#444;margin:0 2px;';
    bar.appendChild(sep2);

    // Clear
    const clearBtn = makeBtn('Clear', 'Remove all mask shapes for this layer', false);
    clearBtn.addEventListener('click', () => {
      layer._masks = [];
      this._maskPolygonPoints = [];
      this._maskPolygonCursor = null;
      this._maskSelectedShapeIdx = -1;
      this._maskHistoryPush();
    });
    bar.appendChild(clearBtn);

    // Separator
    const sep3 = document.createElement('span');
    sep3.style.cssText = 'width:1px;height:18px;background:#444;margin:0 2px;';
    bar.appendChild(sep3);

    // Undo / Redo
    const undoBtn = makeBtn('↩ Undo', 'Undo last mask change (Cmd+Z)', false);
    undoBtn.disabled = true;
    this._maskUndoBtn = undoBtn;
    undoBtn.addEventListener('click', () => this._maskHistoryUndo());
    bar.appendChild(undoBtn);

    const redoBtn = makeBtn('↪ Redo', 'Redo (Cmd+Shift+Z)', false);
    redoBtn.disabled = true;
    this._maskRedoBtn = redoBtn;
    redoBtn.addEventListener('click', () => this._maskHistoryRedo());
    bar.appendChild(redoBtn);

    // Separator
    const sep4 = document.createElement('span');
    sep4.style.cssText = 'width:1px;height:18px;background:#444;margin:0 2px;';
    bar.appendChild(sep4);

    // Feather slider
    const featherLabel = document.createElement('span');
    featherLabel.style.cssText = 'font-size:11px;color:#aaa;white-space:nowrap;';
    featherLabel.textContent = `Feather: ${Math.round(layer._maskFeather ?? 0)}px`;
    bar.appendChild(featherLabel);

    const featherSlider = document.createElement('input');
    featherSlider.type = 'range';
    featherSlider.min = 0;
    featherSlider.max = 80;
    featherSlider.step = 1;
    featherSlider.value = Math.round(layer._maskFeather ?? 0);
    featherSlider.style.cssText = 'width:80px;accent-color:#3478f6;vertical-align:middle;';
    featherSlider.title = 'Soften mask edges — 0 = hard edge, higher = graduated fade';
    featherSlider.addEventListener('input', () => {
      layer._maskFeather = Number(featherSlider.value);
      featherLabel.textContent = `Feather: ${featherSlider.value}px`;
    });
    featherSlider.addEventListener('change', () => {
      this._pushHistory();
    });
    bar.appendChild(featherSlider);

    // Done
    const doneBtn = makeBtn('✓ Done', 'Exit mask edit mode', false);
    doneBtn.style.cssText += 'background:#3478f6;color:#fff;font-weight:bold;';
    doneBtn.addEventListener('click', () => {
      this._exitMaskEditMode();
    });
    bar.appendChild(doneBtn);

    document.body.appendChild(bar);
    this._maskToolbarEl = bar;
  }

  _destroyMaskToolbar() {
    if (this._maskToolbarEl) {
      this._maskToolbarEl.remove();
      this._maskToolbarEl = null;
    }
  }

  // --- Mask draw mouse handlers ---

  _attachMaskCanvasHandlers() {
    this._detachMaskCanvasHandlers();
    const canvas = this.canvas;
    if (!canvas) return;
    // Save the previous cursor so we can restore it
    this._maskPrevCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';

    const getNorm = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
      const cy = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
      return {
        x: Math.max(0, Math.min(1, (cx - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (cy - rect.top)  / rect.height)),
      };
    };

    // Return cursor string for a resize handle id
    const handleCursor = (id) => {
      const map = { tl: 'nw-resize', t: 'n-resize', tr: 'ne-resize', r: 'e-resize',
                    br: 'se-resize', b: 's-resize', bl: 'sw-resize', l: 'w-resize' };
      return map[id] || 'nw-resize';
    };

    // Helper: find a draggable vertex within threshold of point p
    const findVertex = (p) => {
      const rect = canvas.getBoundingClientRect();
      const thresh = 16 / Math.min(rect.width, rect.height);
      // Check in-progress polygon vertices first
      for (let i = 0; i < this._maskPolygonPoints.length; i++) {
        const pt = this._maskPolygonPoints[i];
        if (Math.hypot(p.x - pt[0], p.y - pt[1]) < thresh) {
          return { type: 'inprogress', ptIdx: i };
        }
      }
      // Check completed freehand/polygon shapes
      const layer = this.layers[this._maskEditingLayerIndex];
      if (layer && Array.isArray(layer._masks)) {
        for (let mi = 0; mi < layer._masks.length; mi++) {
          const m = layer._masks[mi];
          if (m.type === 'freehand' && Array.isArray(m.points)) {
            for (let pi = 0; pi < m.points.length; pi++) {
              if (Math.hypot(p.x - m.points[pi][0], p.y - m.points[pi][1]) < thresh) {
                return { type: 'mask', maskIdx: mi, ptIdx: pi };
              }
            }
          }
        }
      }
      return null;
    };

    const onDown = (e) => {
      if (this._maskEditingLayerIndex < 0) return;
      const p = getNorm(e);
      const layer = this.layers[this._maskEditingLayerIndex];
      const masks = layer && Array.isArray(layer._masks) ? layer._masks : [];
      const rect = canvas.getBoundingClientRect();

      if (this._maskTool === 'polygon') {
        // 1. Vertex drag check (in-progress or completed freehand shapes)
        const hit = findVertex(p);
        if (hit) {
          e.preventDefault();
          this._maskPolyDragging = true;
          this._maskPolyDragSource = hit;
          this._maskPolyDragWas = false;
          return;
        }
        // 2. Resize handle on selected shape (rect/ellipse only, even in polygon mode)
        if (this._maskSelectedShapeIdx >= 0 && this._maskSelectedShapeIdx < masks.length) {
          const selShape = masks[this._maskSelectedShapeIdx];
          const h = this._maskFindHandle(selShape, p.x, p.y, rect.width, rect.height);
          if (h) {
            e.preventDefault();
            this._maskResizeState = {
              maskIdx: this._maskSelectedShapeIdx,
              handleId: h.id,
              origShape: { ...selShape },
            };
            return;
          }
        }
        // 3. Shape interior → select + move
        const shapeIdx = this._maskFindShapeAtPoint(masks, p.x, p.y);
        if (shapeIdx >= 0) {
          e.preventDefault();
          this._maskSelectedShapeIdx = shapeIdx;
          this._maskMoveState = {
            maskIdx: shapeIdx,
            startPt: p,
            origMasks: this._cloneMasks(masks),
            moved: false,
          };
          return;
        }
        // 4. Otherwise: let onPolyClick handle vertex placement (fall through)
        return;
      }

      // Non-polygon tools:
      // 1. Resize handle on selected shape
      if (this._maskSelectedShapeIdx >= 0 && this._maskSelectedShapeIdx < masks.length) {
        const selShape = masks[this._maskSelectedShapeIdx];
        const h = this._maskFindHandle(selShape, p.x, p.y, rect.width, rect.height);
        if (h) {
          e.preventDefault();
          this._maskResizeState = {
            maskIdx: this._maskSelectedShapeIdx,
            handleId: h.id,
            origShape: { ...selShape },
          };
          return;
        }
      }
      // 2. Shape interior → select + move
      const shapeIdx = this._maskFindShapeAtPoint(masks, p.x, p.y);
      if (shapeIdx >= 0) {
        e.preventDefault();
        this._maskSelectedShapeIdx = shapeIdx;
        this._maskMoveState = {
          maskIdx: shapeIdx,
          startPt: p,
          origMasks: this._cloneMasks(masks),
          moved: false,
        };
        return;
      }
      // 3. Deselect + start drawing
      this._maskSelectedShapeIdx = -1;
      e.preventDefault();
      this._maskDrawStart = p;
      this._maskDrawing = true;
      if (this._maskTool === 'freehand') {
        this._maskCurrentDraw = { type: 'freehand', points: [[p.x, p.y]] };
      } else {
        this._maskCurrentDraw = { type: this._maskTool, x: p.x, y: p.y, w: 0, h: 0 };
      }
    };

    const onMove = (e) => {
      if (this._maskEditingLayerIndex < 0) return;
      const p = getNorm(e);
      const layer = this.layers[this._maskEditingLayerIndex];
      const masks = layer && Array.isArray(layer._masks) ? layer._masks : [];
      const rect = canvas.getBoundingClientRect();

      // --- Resize in progress ---
      if (this._maskResizeState) {
        e.preventDefault();
        const rs = this._maskResizeState;
        if (masks[rs.maskIdx]) {
          masks[rs.maskIdx] = this._maskApplyResize(rs.origShape, rs.handleId, p.x, p.y, e.shiftKey);
        }
        return;
      }

      // --- Move in progress ---
      if (this._maskMoveState) {
        e.preventDefault();
        const ms = this._maskMoveState;
        const dx = p.x - ms.startPt.x;
        const dy = p.y - ms.startPt.y;
        const orig = ms.origMasks[ms.maskIdx];
        const tgt  = masks[ms.maskIdx];
        if (orig && tgt) {
          if (tgt.type === 'rect' || tgt.type === 'ellipse') {
            tgt.x = orig.x + dx;
            tgt.y = orig.y + dy;
          } else if (tgt.type === 'freehand' && Array.isArray(orig.points)) {
            tgt.points = orig.points.map(([ox, oy]) => [ox + dx, oy + dy]);
          }
        }
        ms.moved = true;
        canvas.style.cursor = 'grabbing';
        return;
      }

      // --- Polygon tool: vertex drag / cursor feedback ---
      if (this._maskTool === 'polygon') {
        this._maskPolygonCursor = p;

        if (this._maskPolyDragging && this._maskPolyDragSource) {
          e.preventDefault();
          const src = this._maskPolyDragSource;
          if (src.type === 'inprogress') {
            this._maskPolygonPoints[src.ptIdx] = [p.x, p.y];
          } else {
            if (layer && layer._masks[src.maskIdx]) {
              layer._masks[src.maskIdx].points[src.ptIdx] = [p.x, p.y];
            }
          }
          this._maskPolyDragWas = true;
          canvas.style.cursor = 'grabbing';
          return;
        }

        // Cursor feedback: handles → vertices → shape interior → crosshair
        if (this._maskSelectedShapeIdx >= 0 && this._maskSelectedShapeIdx < masks.length) {
          const sel = masks[this._maskSelectedShapeIdx];
          const h = this._maskFindHandle(sel, p.x, p.y, rect.width, rect.height);
          if (h) { canvas.style.cursor = handleCursor(h.id); return; }
        }
        const vhit = findVertex(p);
        if (vhit) { canvas.style.cursor = 'grab'; return; }
        const si = this._maskFindShapeAtPoint(masks, p.x, p.y);
        canvas.style.cursor = si >= 0 ? 'move' : 'crosshair';
        return;
      }

      // --- Drawing in progress ---
      if (this._maskDrawing && this._maskCurrentDraw) {
        e.preventDefault();
        const m = this._maskCurrentDraw;
        if (m.type === 'freehand') {
          const last = m.points[m.points.length - 1];
          if (!last || Math.hypot(p.x - last[0], p.y - last[1]) > 0.003) {
            m.points.push([p.x, p.y]);
          }
        } else {
          let dw = p.x - this._maskDrawStart.x;
          let dh = p.y - this._maskDrawStart.y;
          if (e.shiftKey) {
            // Constrain to square/circle: use the larger absolute delta, preserving sign
            const dim = Math.max(Math.abs(dw), Math.abs(dh));
            dw = Math.sign(dw) * dim;
            dh = Math.sign(dh) * dim;
          }
          m.w = dw;
          m.h = dh;
        }
        return;
      }

      // --- Hover cursor feedback (no drag active) ---
      if (this._maskSelectedShapeIdx >= 0 && this._maskSelectedShapeIdx < masks.length) {
        const sel = masks[this._maskSelectedShapeIdx];
        const h = this._maskFindHandle(sel, p.x, p.y, rect.width, rect.height);
        if (h) { canvas.style.cursor = handleCursor(h.id); return; }
      }
      const si = this._maskFindShapeAtPoint(masks, p.x, p.y);
      canvas.style.cursor = si >= 0 ? 'move' : 'crosshair';
    };

    const onUp = (e) => {
      const layer = this.layers[this._maskEditingLayerIndex];

      // End resize
      if (this._maskResizeState) {
        this._maskResizeState = null;
        canvas.style.cursor = 'crosshair';
        this._maskHistoryPush();
        return;
      }

      // End move
      if (this._maskMoveState) {
        const ms = this._maskMoveState;
        if (ms.moved) {
          this._maskPolyDragWas = true; // suppress polygon vertex placement
          this._maskHistoryPush();
        }
        this._maskMoveState = null;
        canvas.style.cursor = 'crosshair';
        return;
      }

      // End vertex drag (polygon tool)
      if (this._maskPolyDragging) {
        this._maskPolyDragging = false;
        this._maskPolyDragSource = null;
        canvas.style.cursor = 'crosshair';
        if (layer) this._maskHistoryPush();
        return;
      }

      if (!this._maskDrawing) return;
      e?.preventDefault?.();
      this._maskDrawing = false;
      const m = this._maskCurrentDraw;
      this._maskCurrentDraw = null;
      if (!layer || !m) return;
      if (m.type === 'rect' || m.type === 'ellipse') {
        // Normalize negative w/h
        if (m.w < 0) { m.x += m.w; m.w = -m.w; }
        if (m.h < 0) { m.y += m.h; m.h = -m.h; }
        if (m.w < 0.01 || m.h < 0.01) return; // ignore tiny shapes
      } else if (m.type === 'freehand') {
        if (!m.points || m.points.length < 3) return; // ignore degenerate
      }
      if (!Array.isArray(layer._masks)) layer._masks = [];
      layer._masks.push(m);
      this._maskSelectedShapeIdx = layer._masks.length - 1;
      this._maskHistoryPush();
    };

    // Polygon: click to place vertices, double-click or first-vertex click to close
    const onPolyClick = (e) => {
      if (this._maskTool !== 'polygon' || this._maskEditingLayerIndex < 0) return;
      // A drag / move just ended — suppress vertex placement for this click
      if (this._maskPolyDragWas) {
        this._maskPolyDragWas = false;
        return;
      }
      // A move selection just happened — suppress vertex placement
      if (this._maskMoveState) return;
      e.preventDefault();
      const p = getNorm(e);

      // Double-click (e.detail >= 2) closes the polygon
      if (e.detail >= 2) {
        this._closePolygon();
        return;
      }

      // Click near the first vertex also closes (when we have ≥ 3 points)
      if (this._maskPolygonPoints.length >= 3) {
        const first = this._maskPolygonPoints[0];
        const rect = canvas.getBoundingClientRect();
        const thresh = 16 / Math.min(rect.width, rect.height);
        if (Math.hypot(p.x - first[0], p.y - first[1]) < thresh) {
          this._closePolygon();
          return;
        }
      }

      // Place a new vertex
      this._maskPolygonPoints.push([p.x, p.y]);
    };

    const onKeyDown = (e) => {
      // Escape → cancel in-progress polygon
      if (e.key === 'Escape') {
        this._maskPolygonPoints = [];
        this._maskPolygonCursor = null;
      }
      // Delete / Backspace → remove selected shape
      if ((e.key === 'Delete' || e.key === 'Backspace') && this._maskSelectedShapeIdx >= 0) {
        const layer = this.layers[this._maskEditingLayerIndex];
        if (layer && Array.isArray(layer._masks)) {
          layer._masks.splice(this._maskSelectedShapeIdx, 1);
          this._maskSelectedShapeIdx = -1;
          this._maskHistoryPush();
          e.preventDefault();
        }
      }
      // Cmd+Z / Ctrl+Z → undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this._maskHistoryUndo();
      }
      // Cmd+Shift+Z / Ctrl+Shift+Z → redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        this._maskHistoryRedo();
      }
    };

    const onKeyUp = (e) => { /* reserved for future use */ };

    canvas.addEventListener('mousedown',  onDown);
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup',    onUp);
    canvas.addEventListener('click',      onPolyClick);
    window.addEventListener('keydown',    onKeyDown);
    window.addEventListener('keyup',      onKeyUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('touchend',   onUp);

    this._maskCanvasHandlers = { onDown, onMove, onUp, onPolyClick, onKeyDown, onKeyUp };
  }

  _detachMaskCanvasHandlers() {
    const canvas = this.canvas;
    const h = this._maskCanvasHandlers;
    if (canvas && this._maskPrevCursor !== undefined) {
      canvas.style.cursor = this._maskPrevCursor;
      this._maskPrevCursor = undefined;
    }
    if (!h || !canvas) {
      this._maskCanvasHandlers = null;
      return;
    }
    canvas.removeEventListener('mousedown',  h.onDown);
    window.removeEventListener('mousemove',  h.onMove);
    window.removeEventListener('mouseup',    h.onUp);
    canvas.removeEventListener('click',      h.onPolyClick);
    window.removeEventListener('keydown',    h.onKeyDown);
    if (h.onKeyUp) window.removeEventListener('keyup', h.onKeyUp);
    canvas.removeEventListener('touchstart', h.onDown);
    window.removeEventListener('touchmove',  h.onMove);
    window.removeEventListener('touchend',   h.onUp);
    this._maskCanvasHandlers = null;
  }

  // --- Mask edit overlay (drawn after post-process) ---

  _drawMaskEditOverlay(w, h) {
    const layer = this.layers[this._maskEditingLayerIndex];
    if (!layer) return;
    const ctx = this.ctx;
    const mode = layer._maskMode ?? 'include';

    // Build the path of all current masks + current in-progress shape preview
    const previewMasks = Array.isArray(layer._masks) ? [...layer._masks] : [];
    if (this._maskDrawing && this._maskCurrentDraw) {
      const m = this._maskCurrentDraw;
      if (m.type === 'freehand') {
        previewMasks.push(m);
      } else {
        // Normalize negative w/h for live preview
        let x = m.x, y = m.y, ww = m.w, hh = m.h;
        if (ww < 0) { x += ww; ww = -ww; }
        if (hh < 0) { y += hh; hh = -hh; }
        previewMasks.push({ type: m.type, x, y, w: ww, h: hh });
      }
    }

    ctx.save();

    // Dim the area that WON'T be rendered:
    // include mode → dim everywhere outside mask
    // exclude mode → dim inside mask
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    if (previewMasks.length === 0) {
      // No mask yet: dim entire canvas to indicate "nothing will render in include mode"
      // For exclude mode, with no mask everything renders so don't dim.
      if (mode === 'include') ctx.fillRect(0, 0, w, h);
    } else {
      const dimPath = new Path2D();
      if (mode === 'include') {
        // Dim outside: full rect + mask shapes with evenodd
        dimPath.rect(0, 0, w, h);
        this._addMaskShapesToPath(dimPath, previewMasks, w, h);
        ctx.fill(dimPath, 'evenodd');
      } else {
        // Dim inside the masks
        this._addMaskShapesToPath(dimPath, previewMasks, w, h);
        ctx.fill(dimPath);
      }
    }

    // Draw mask outlines
    if (previewMasks.length > 0) {
      const outlinePath = new Path2D();
      this._addMaskShapesToPath(outlinePath, previewMasks, w, h);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = mode === 'include' ? 'rgba(120,255,160,0.95)' : 'rgba(255,160,120,0.95)';
      ctx.stroke(outlinePath);
      ctx.setLineDash([]);
    }

    // --- Polygon tool overlays (in-progress + completed vertex handles) ---
    if (this._maskTool === 'polygon') {
      const polyColor = mode === 'include' ? 'rgba(120,255,160,0.95)' : 'rgba(255,160,120,0.95)';
      const hoverThresh = 16 / Math.min(w, h); // normalized units
      const cur = this._maskPolygonCursor;

      const isHovered = (nx, ny) =>
        cur && Math.hypot(cur.x - nx, cur.y - ny) < hoverThresh;

      // Draw in-progress polygon
      if (this._maskPolygonPoints.length > 0) {
        const pts = this._maskPolygonPoints;

        // Dashed edges + preview line to cursor
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = polyColor;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
        }
        if (cur) ctx.lineTo(cur.x * w, cur.y * h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Vertex dot handles (with hover highlight)
        for (let i = 0; i < pts.length; i++) {
          const [nx, ny] = pts[i];
          const px = nx * w, py = ny * h;
          const isFirst = i === 0;
          const hovered = isHovered(nx, ny);
          ctx.fillStyle = hovered ? '#fff' : polyColor;
          ctx.beginPath();
          ctx.arc(px, py, hovered ? 7 : (isFirst ? 6 : 4), 0, Math.PI * 2);
          ctx.fill();
          // Close-ring on first vertex when ≥ 3 points
          if (isFirst && pts.length >= 3) {
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px, py, 9, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Draw draggable vertex handles on completed freehand/polygon shapes
      if (Array.isArray(layer._masks)) {
        for (const m of layer._masks) {
          if (m.type === 'freehand' && Array.isArray(m.points)) {
            for (const [nx, ny] of m.points) {
              const px = nx * w, py = ny * h;
              const hovered = isHovered(nx, ny);
              ctx.fillStyle = hovered ? '#fff' : polyColor;
              ctx.beginPath();
              ctx.arc(px, py, hovered ? 7 : 4, 0, Math.PI * 2);
              ctx.fill();
              if (hovered) {
                ctx.strokeStyle = polyColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(px, py, 9, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
          }
        }
      }
    }

    // --- Selection highlight + resize handles for selected shape ---
    if (this._maskSelectedShapeIdx >= 0 && Array.isArray(layer._masks)) {
      const selShape = layer._masks[this._maskSelectedShapeIdx];
      if (selShape) {
        // Gold solid outline for selected shape
        const selPath = new Path2D();
        this._addMaskShapesToPath(selPath, [selShape], w, h);
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,220,50,0.95)';
        ctx.stroke(selPath);

        // Resize handles: 8 small squares for rect and ellipse
        if (selShape.type === 'rect' || selShape.type === 'ellipse') {
          const handles = this._maskGetHandles(selShape);
          const hSize = 6; // half-size of handle square in canvas pixels
          for (const hd of handles) {
            const hx = hd.nx * w, hy = hd.ny * h;
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#3478f6';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.fillRect(hx - hSize, hy - hSize, hSize * 2, hSize * 2);
            ctx.strokeRect(hx - hSize, hy - hSize, hSize * 2, hSize * 2);
          }
        }
      }
    }

    // Top-left badge with mode + tool
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'top';
    const selHint = this._maskSelectedShapeIdx >= 0 ? ' | ⌫ delete · drag to move' : '';
    const badge = `MASK EDIT — ${mode.toUpperCase()} | tool: ${this._maskTool}${selHint}`;
    const tw = ctx.measureText(badge).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(8, 8, tw + 16, 22);
    ctx.fillStyle = mode === 'include' ? '#7fff9f' : '#ffa07f';
    ctx.fillText(badge, 16, 13);

    ctx.restore();
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
      if (!this._cameraMode) {
        compCtx.fillStyle = '#000';
        compCtx.fillRect(0, 0, w, h);
      }
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
      if (!this._cameraMode) {
        compCtx.globalAlpha = 1 - maxFade * 0.95; // at fade=1, only 5% darkening per frame = long trails
        compCtx.fillRect(0, 0, w, h);
        compCtx.globalAlpha = 1;
      } else {
        compCtx.clearRect(0, 0, w, h);
      }
    }

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!this._isLayerActive(layer)) continue;

      const effectiveOpacity = Math.max(0, Math.min(1, layer.params.opacity + (layer.params._jOpacity || 0)));
      compCtx.globalAlpha = effectiveOpacity;
      compCtx.globalCompositeOperation = layer.blendMode;
      compCtx.imageSmoothingEnabled = true;
      compCtx.imageSmoothingQuality = 'high';
      const hasMask = this._layerHasActiveMask(layer);
      const feather  = layer._maskFeather ?? 0;
      if (hasMask && feather > 0) {
        // Feathered mask: composite via alpha-channel approach
        this._compositeLayerWithFeather(compCtx, this.layerCanvases[i], layer, w, h, feather);
      } else if (hasMask) {
        compCtx.save();
        this._applyMaskClip(compCtx, layer, w, h);
        compCtx.drawImage(this.layerCanvases[i], 0, 0, w, h);
        compCtx.restore();
      } else {
        compCtx.drawImage(this.layerCanvases[i], 0, 0, w, h);
      }
    }
    compCtx.globalAlpha = 1;
    compCtx.globalCompositeOperation = 'source-over';

    // Draw to main canvas
    ctx.drawImage(this.compCanvas, 0, 0);

    // Post-processing (with timing)
    this._postProcess(w, h, audio, timing);

    // Mask edit mode overlay (drawn last, on top of everything)
    if (this._maskEditingLayerIndex >= 0) {
      this._drawMaskEditOverlay(w, h);
    }

    timing.total = performance.now() - drawStart;
  }

  // Composite a layer through a feathered (blurred-edge) alpha mask instead of a hard clip.
  // Called with globalAlpha and globalCompositeOperation already set on compCtx.
  _compositeLayerWithFeather(compCtx, layerCanvas, layer, w, h, feather) {
    const mode = layer._maskMode ?? 'include';

    // --- Build the mask alpha canvas ---
    if (!this._featherMaskCanvas) this._featherMaskCanvas = document.createElement('canvas');
    const mc = this._featherMaskCanvas;
    if (mc.width !== w || mc.height !== h) { mc.width = w; mc.height = h; }
    const mCtx = mc.getContext('2d');
    mCtx.clearRect(0, 0, w, h);

    const path = new Path2D();
    this._addMaskShapesToPath(path, layer._masks, w, h);

    if (mode === 'include') {
      // White blurred shapes → alpha fades at edges
      mCtx.filter = `blur(${feather}px)`;
      mCtx.fillStyle = '#fff';
      mCtx.fill(path);
      mCtx.filter = 'none';
    } else {
      // Full white background, then cut blurred holes for excluded regions
      mCtx.fillStyle = '#fff';
      mCtx.fillRect(0, 0, w, h);
      mCtx.filter = `blur(${feather}px)`;
      mCtx.globalCompositeOperation = 'destination-out';
      mCtx.fillStyle = '#fff';
      mCtx.fill(path);
      mCtx.filter = 'none';
      mCtx.globalCompositeOperation = 'source-over';
    }

    // --- Apply the alpha mask to a copy of the layer ---
    if (!this._featherTmpCanvas) this._featherTmpCanvas = document.createElement('canvas');
    const tmp = this._featherTmpCanvas;
    if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; }
    const tCtx = tmp.getContext('2d');
    tCtx.clearRect(0, 0, w, h);
    tCtx.drawImage(layerCanvas, 0, 0, w, h);
    tCtx.globalCompositeOperation = 'destination-in';
    tCtx.drawImage(mc, 0, 0);
    tCtx.globalCompositeOperation = 'source-over';

    // --- Composite the masked layer (blendMode + globalAlpha already set on compCtx) ---
    compCtx.drawImage(tmp, 0, 0, w, h);
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
      // If we're editing the mask of the layer being deleted, exit mask edit mode
      if (this._maskEditingLayerIndex === this.selectedLayerIndex) {
        this._exitMaskEditMode();
      } else if (this._maskEditingLayerIndex > this.selectedLayerIndex) {
        // Layer indices shift down by 1 after splice
        this._maskEditingLayerIndex--;
      }
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

    // Canvas click → toggle all UI chrome (desktop "clean canvas" mode)
    this._llUiHidden = false; // always start visible when panel is built
    if (this._canvasUIClickHandler) {
      this.canvas.removeEventListener('click', this._canvasUIClickHandler);
    }
    this._canvasUIClickHandler = (e) => {
      // Only respond to clicks directly on the canvas element
      if (e.target !== this.canvas) return;
      // Mask edit mode owns canvas clicks; leave them alone
      if (this._maskEditingLayerIndex >= 0) return;
      this._toggleLLFullUI();
    };
    this.canvas.addEventListener('click', this._canvasUIClickHandler);
  }

  destroyPanel() {
    // Clean up mask editor if active
    if (this._maskEditingLayerIndex >= 0) {
      this._exitMaskEditMode();
    }
    this._destroyMaskToolbar();
    this._detachMaskCanvasHandlers();
    // Clean up canvas UI-click handler and restore any hidden UI
    if (this._canvasUIClickHandler) {
      this.canvas.removeEventListener('click', this._canvasUIClickHandler);
      this._canvasUIClickHandler = null;
    }
    if (this._llUiHidden) {
      this._llUiHidden = false;
      this._applyLLUIHidden(false);
    }
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
        imgPanMode:    l.type === 'image' ? (l._imgPanMode    ?? 'off') : undefined,
        imgPanSpeed:   l.type === 'image' ? (l._imgPanSpeed   ?? 0.3)   : undefined,
        imgMotionBlur: l.type === 'image' ? (l._imgMotionBlur ?? 0)     : undefined,
        lissajousShape: l.type === 'lissajous' ? (l._lissajousShape || 2) : undefined,
        pulseMode: l.type === 'pulse' ? (l._pulseMode || 'constant') : undefined,
        starsRotSpeed: l.type === 'stars' ? (l._starsRotSpeed ?? 0) : undefined,
        starsRotDir: l.type === 'stars' ? (l._starsRotDir ?? 'cw') : undefined,
        starsThickness: l.type === 'stars' ? (l._starsThickness ?? 1.0) : undefined,
        starsOriginRadius: l.type === 'stars' ? (l._starsOriginRadius ?? 0) : undefined,
        starsFlowDir: l.type === 'stars' ? (l._starsFlowDir ?? 'forward') : undefined,
        starsParticleShape: l.type === 'stars' ? (l._starsParticleShape ?? 'streak') : undefined,
        starsSize: l.type === 'stars' ? (l._starsSize ?? 1.0) : undefined,
        starsTailLength: l.type === 'stars' ? (l._starsTailLength ?? 1.0) : undefined,
        starsHyperspace: l.type === 'stars' ? (l._hyperspace ?? false) : undefined,
        lightFreq:      l.type === 'lightning' ? (l._lightFreq      ?? 0.4) : undefined,
        lightIntensity: l.type === 'lightning' ? (l._lightIntensity ?? 0.6) : undefined,
        lightBranching: l.type === 'lightning' ? (l._lightBranching ?? 0.5) : undefined,
        lightDuration:  l.type === 'lightning' ? (l._lightDuration  ?? 0.4) : undefined,
        spinSpeed: SPIN_LAYER_TYPES.has(l.type) ? (l._spinSpeed ?? 0) : undefined,
        spinDir:   SPIN_LAYER_TYPES.has(l.type) ? (l._spinDir   ?? 'cw') : undefined,
        masks: Array.isArray(l._masks) && l._masks.length > 0 ? this._cloneMasks(l._masks) : undefined,
        maskMode: Array.isArray(l._masks) && l._masks.length > 0 ? (l._maskMode ?? 'include') : undefined,
        maskFeather: (l._maskFeather ?? 0) > 0 ? l._maskFeather : undefined,
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

    // Mask edit mode references this.layers[idx]; bail before we swap them out
    if (this._maskEditingLayerIndex >= 0) {
      this._exitMaskEditMode();
    }

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
      if (saved.type === 'image') {
        if (saved.imgPanMode    !== undefined) layer._imgPanMode    = saved.imgPanMode;
        if (saved.imgPanSpeed   !== undefined) layer._imgPanSpeed   = saved.imgPanSpeed;
        if (saved.imgMotionBlur !== undefined) layer._imgMotionBlur = saved.imgMotionBlur;
      }
      if (saved.type === 'lissajous' && saved.lissajousShape !== undefined) {
        layer._lissajousShape = saved.lissajousShape;
      }
      if (saved.type === 'pulse' && saved.pulseMode !== undefined) {
        layer._pulseMode = saved.pulseMode;
      }
      if (saved.type === 'stars') {
        if (saved.starsRotSpeed !== undefined) layer._starsRotSpeed = saved.starsRotSpeed;
        if (saved.starsRotDir !== undefined) layer._starsRotDir = saved.starsRotDir;
        if (saved.starsThickness !== undefined) layer._starsThickness = saved.starsThickness;
        if (saved.starsOriginRadius !== undefined) layer._starsOriginRadius = saved.starsOriginRadius;
        if (saved.starsFlowDir !== undefined) layer._starsFlowDir = saved.starsFlowDir;
        if (saved.starsParticleShape !== undefined) layer._starsParticleShape = saved.starsParticleShape;
        if (saved.starsSize !== undefined) layer._starsSize = saved.starsSize;
        if (saved.starsTailLength !== undefined) layer._starsTailLength = saved.starsTailLength;
        if (saved.starsHyperspace !== undefined) layer._hyperspace = saved.starsHyperspace;
      }
      if (saved.type === 'lightning') {
        if (saved.lightFreq !== undefined)      layer._lightFreq      = saved.lightFreq;
        if (saved.lightIntensity !== undefined) layer._lightIntensity = saved.lightIntensity;
        if (saved.lightBranching !== undefined) layer._lightBranching = saved.lightBranching;
        if (saved.lightDuration !== undefined)  layer._lightDuration  = saved.lightDuration;
      }
      if (SPIN_LAYER_TYPES.has(saved.type)) {
        if (saved.spinSpeed !== undefined) layer._spinSpeed = saved.spinSpeed;
        if (saved.spinDir   !== undefined) layer._spinDir   = saved.spinDir;
      }
      // Restore mask params (always set, default to empty)
      layer._masks       = Array.isArray(saved.masks) ? this._cloneMasks(saved.masks) : [];
      layer._maskMode    = saved.maskMode ?? 'include';
      layer._maskFeather = saved.maskFeather ?? 0;
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
        layer._panAccCanvas = null;
        layer._panTmpCanvas = null;
        layer._imgLastTime = undefined;
        layer._imgWanderX = undefined;
        layer._imgWanderY = undefined;
        layer._pulseRings = null;
        layer._lastPulseTime = null;
        layer._stars = null;
        layer._lastStarsTime = undefined;
        layer._starsRotAngle = undefined;
        layer._starsFlowDir = undefined;
        layer._starsParticleShape = undefined;
        layer._strikes = null;
        layer._lightNextTime = undefined;
        layer._lightLastBeatTime = undefined;
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

      // Mask indicator: small icon shown when layer has an active mask
      if (this._layerHasActiveMask(layer)) {
        const maskIcon = document.createElement('span');
        maskIcon.textContent = '🎭';
        maskIcon.title = `Mask active (${layer._maskMode ?? 'include'}, ${layer._masks.length} shape${layer._masks.length === 1 ? '' : 's'})`;
        maskIcon.style.cssText = 'font-size:11px;margin-left:4px;opacity:0.85;';
        row.appendChild(maskIcon);
      }

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

    // ── Hyperspace mini-button: injected after the React knob, Stars layers only ──
    if (layer.type === 'stars' && !isMulti) {
      const reactKnobData = this._panelKnobs.find(k => k.param.key === 'reactivity');
      if (reactKnobData) {
        const reactWrapper = reactKnobData.element.parentElement;
        const hsActive = !!layer._hyperspace;
        const hsBtn = document.createElement('button');
        hsBtn.className = 'll-toggle' + (hsActive ? ' active' : '');
        hsBtn.textContent = '⚡';
        hsBtn.title = 'Hyperspace: snap layer to warp settings. Click again to restore.';
        hsBtn.style.cssText = [
          'display:flex;flex-direction:column;align-items:center;justify-content:center;',
          'width:34px;height:100%;min-height:52px;padding:2px 4px;',
          'font-size:14px;line-height:1;align-self:stretch;',
          'border-radius:6px;',
        ].join('');
        const hsToggle = (lyr) => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          if (!lyr._hyperspace) {
            // ── Activate ──
            lyr._hyperspaceSnapshot = {
              params:             { ...lyr.params },
              starsRotSpeed:      lyr._starsRotSpeed      ?? 0,
              starsThickness:     lyr._starsThickness     ?? 1.0,
              starsOriginRadius:  lyr._starsOriginRadius  ?? 0,
              starsFlowDir:       lyr._starsFlowDir       ?? 'forward',
              starsParticleShape: lyr._starsParticleShape ?? 'streak',
              starsSize:          lyr._starsSize          ?? 1.0,
              starsTailLength:    lyr._starsTailLength    ?? 1.0,
              hue:       lyr.hue,
              blendMode: lyr.blendMode,
            };
            lyr._hyperspaceGlobalSnapshot = {
              speed:      this.globals.speed,
              bloom:      this.globals.bloom,
              softness:   this.globals.softness,
              saturation: this.globals.saturation,
            };
            lyr.params.scale       = 0.1;
            lyr.params.speed       = 2.0;
            lyr.params.opacity     = 1.0;
            lyr.params.drift       = 0;
            lyr.params.rotation    = 0;
            lyr.params.zoom        = 1;
            lyr.params.mirror      = 0;
            lyr.params.turbulence  = 0.45;
            lyr.params.distortion  = 0.5;
            lyr.params.fade        = 0;
            lyr.params.tint        = 0;
            lyr.params.invert      = 0;
            lyr.params.brightness  = 0.5;
            lyr.params.reactivity  = 0;
            lyr._starsRotSpeed      = 0;
            lyr._starsThickness     = 1.0;
            lyr._starsOriginRadius  = 0;
            lyr._starsFlowDir       = 'forward';
            lyr._starsParticleShape = 'streak';
            lyr._starsSize          = 1.1;
            lyr._starsTailLength    = 0.7;
            lyr._stars              = null;
            if (lyr.hue <= 360) lyr._savedHue = lyr.hue;
            lyr.hue       = 365;
            lyr.blendMode = 'lighter';
            lyr._hyperspace = true;
            this.globals.speed      = 2.0;
            this.globals.bloom      = 0.55;
            this.globals.softness   = 0.5;
            this.globals.saturation = 0.95;
          } else {
            // ── Deactivate ──
            if (lyr._hyperspaceSnapshot) {
              Object.assign(lyr.params, lyr._hyperspaceSnapshot.params);
              lyr._starsRotSpeed      = lyr._hyperspaceSnapshot.starsRotSpeed;
              lyr._starsThickness     = lyr._hyperspaceSnapshot.starsThickness;
              lyr._starsOriginRadius  = lyr._hyperspaceSnapshot.starsOriginRadius;
              lyr._starsFlowDir       = lyr._hyperspaceSnapshot.starsFlowDir;
              lyr._starsParticleShape = lyr._hyperspaceSnapshot.starsParticleShape;
              lyr._starsSize          = lyr._hyperspaceSnapshot.starsSize;
              lyr._starsTailLength    = lyr._hyperspaceSnapshot.starsTailLength;
              lyr.hue       = lyr._hyperspaceSnapshot.hue;
              lyr.blendMode = lyr._hyperspaceSnapshot.blendMode;
              lyr._stars    = null;
              lyr._hyperspaceSnapshot = null;
            }
            if (lyr._hyperspaceGlobalSnapshot) {
              this.globals.speed      = lyr._hyperspaceGlobalSnapshot.speed;
              this.globals.bloom      = lyr._hyperspaceGlobalSnapshot.bloom;
              this.globals.softness   = lyr._hyperspaceGlobalSnapshot.softness;
              this.globals.saturation = lyr._hyperspaceGlobalSnapshot.saturation;
              lyr._hyperspaceGlobalSnapshot = null;
            }
            lyr._hyperspace = false;
          }
          this._rebuildLayerKnobs();
          this._globalKnobs.forEach(k => {
            const val = this.globals[k.param.key];
            if (val !== undefined) { k.value = val; k.baseValue = val; k.updateVisual(); }
          });
          this._pushHistory();
        };
        hsBtn.addEventListener('click', () => hsToggle(layer));
        reactWrapper.insertAdjacentElement('afterend', hsBtn);
      }
    }

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

      // --- Pan Mode picker ---
      const imgLabelCss = 'font-size:9px;font-weight:bold;color:#000;white-space:nowrap;';
      const panRow = document.createElement('div');
      panRow.className = 'll-image-row';
      panRow.style.cssText = 'gap:4px;flex-wrap:wrap;';
      const panLabel = document.createElement('span');
      panLabel.style.cssText = imgLabelCss + 'margin-right:2px;';
      panLabel.textContent = 'Pan:';
      panRow.appendChild(panLabel);
      const currentPanMode = layer._imgPanMode ?? 'off';
      [['off', 'Off'], ['pendulum', 'Pendulum'], ['wander', 'Wander'], ['wave', 'Wave']].forEach(([key, label]) => {
        const btn = document.createElement('button');
        btn.className = 'll-toggle' + (currentPanMode === key ? ' active' : '');
        btn.textContent = label;
        btn.dataset.panMode = key;
        btn.style.cssText = 'padding:2px 6px;font-size:9px;';
        btn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._imgPanMode = key;
          // Reset wander position and motion blur accumulator so new mode starts clean
          layer._imgWanderX = 0;
          layer._imgWanderY = 0;
          layer._panAccCanvas = null;
          panRow.querySelectorAll('[data-pan-mode]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._pushHistory();
        });
        panRow.appendChild(btn);
      });
      container.appendChild(panRow);

      // --- Pan Speed slider ---
      const panSpeedRow = document.createElement('div');
      panSpeedRow.className = 'll-image-row';
      panSpeedRow.style.gap = '6px';
      const panSpeedLabel = document.createElement('span');
      panSpeedLabel.style.cssText = imgLabelCss;
      panSpeedLabel.textContent = 'Pan Speed:';
      panSpeedRow.appendChild(panSpeedLabel);
      const panSpeedSlider = document.createElement('input');
      panSpeedSlider.type = 'range';
      panSpeedSlider.className = 'll-row-slider';
      panSpeedSlider.min = '0'; panSpeedSlider.max = '1'; panSpeedSlider.step = '0.025';
      panSpeedSlider.value = String(layer._imgPanSpeed ?? 0.3);
      const panSpeedVal = document.createElement('span');
      panSpeedVal.style.cssText = 'font-size:10px;color:#aaa;min-width:28px;text-align:right;';
      panSpeedVal.textContent = Number(panSpeedSlider.value).toFixed(2);
      panSpeedSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._imgPanSpeed = parseFloat(panSpeedSlider.value);
        panSpeedVal.textContent = layer._imgPanSpeed.toFixed(2);
        this._pushHistory();
      });
      panSpeedRow.appendChild(panSpeedSlider);
      panSpeedRow.appendChild(panSpeedVal);
      container.appendChild(panSpeedRow);

      // --- Motion Blur slider ---
      const blurRow = document.createElement('div');
      blurRow.className = 'll-image-row';
      blurRow.style.gap = '6px';
      const blurLabel = document.createElement('span');
      blurLabel.style.cssText = imgLabelCss;
      blurLabel.textContent = (layer._imgPanMode === 'wave') ? 'Wave Intensity:' : 'Motion Blur:';
      blurRow.appendChild(blurLabel);
      const blurSlider = document.createElement('input');
      blurSlider.type = 'range';
      blurSlider.className = 'll-row-slider';
      blurSlider.min = '0'; blurSlider.max = '1'; blurSlider.step = '0.025';
      blurSlider.value = String(layer._imgMotionBlur ?? 0);
      const blurVal = document.createElement('span');
      blurVal.style.cssText = 'font-size:10px;color:#aaa;min-width:28px;text-align:right;';
      blurVal.textContent = Number(blurSlider.value).toFixed(2);
      blurSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._imgMotionBlur = parseFloat(blurSlider.value);
        // Reset accumulation canvas so old smear doesn't carry over
        layer._panAccCanvas = null;
        blurVal.textContent = layer._imgMotionBlur.toFixed(2);
        this._pushHistory();
      });
      blurRow.appendChild(blurSlider);
      blurRow.appendChild(blurVal);
      container.appendChild(blurRow);
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

    // Stars-specific controls (rotation, thickness, spread, shape, flow direction)
    if (layer.type === 'stars' && !isMulti) {
      const starsLabelCss = 'font-size:9px;font-weight:bold;color:#000;white-space:nowrap;';

      // --- Spin speed (max raised to 6, 3× previous ceiling) ---
      const rotRow = document.createElement('div');
      rotRow.className = 'll-image-row';
      rotRow.style.gap = '6px';
      const rotLabel = document.createElement('span');
      rotLabel.style.cssText = starsLabelCss;
      rotLabel.textContent = 'Spin:';
      rotRow.appendChild(rotLabel);
      const rotSlider = document.createElement('input');
      rotSlider.type = 'range';
      rotSlider.className = 'll-row-slider';
      rotSlider.min = '0'; rotSlider.max = '6'; rotSlider.step = '0.1';
      rotSlider.value = String(layer._starsRotSpeed ?? 0);
      const rotVal = document.createElement('span');
      rotVal.style.cssText = 'font-size:10px;color:#aaa;min-width:24px;text-align:right;';
      rotVal.textContent = Number(rotSlider.value).toFixed(1);
      rotSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._starsRotSpeed = parseFloat(rotSlider.value);
        rotVal.textContent = layer._starsRotSpeed.toFixed(1);
        this._pushHistory();
      });
      rotRow.appendChild(rotSlider);
      rotRow.appendChild(rotVal);
      container.appendChild(rotRow);

      // --- Direction row: Clockwise / Counter-Clockwise / Forward / Backward ---
      // Two independent toggle groups in one row.
      const dirRow = document.createElement('div');
      dirRow.className = 'll-image-row';
      dirRow.style.cssText = 'gap:4px;flex-wrap:wrap;';
      const dirLabel = document.createElement('span');
      dirLabel.style.cssText = starsLabelCss + 'margin-right:2px;';
      dirLabel.textContent = 'Direction:';
      dirRow.appendChild(dirLabel);

      const currentRotDir = layer._starsRotDir ?? 'cw';
      [['cw', '↻ Clockwise'], ['ccw', '↺ Counter-Clockwise']].forEach(([dir, text]) => {
        const btn = document.createElement('button');
        btn.className = 'll-toggle' + (currentRotDir === dir ? ' active' : '');
        btn.textContent = text;
        btn.dataset.rotDir = dir;
        btn.style.cssText = 'padding:2px 5px;font-size:9px;';
        btn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._starsRotDir = dir;
          dirRow.querySelectorAll('[data-rot-dir]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._pushHistory();
        });
        dirRow.appendChild(btn);
      });

      const currentFlowDir = layer._starsFlowDir ?? 'forward';
      [['forward', 'Forward'], ['backward', 'Backward']].forEach(([fd, text]) => {
        const btn = document.createElement('button');
        btn.className = 'll-toggle' + (currentFlowDir === fd ? ' active' : '');
        btn.textContent = text;
        btn.dataset.flowDir = fd;
        btn.style.cssText = 'padding:2px 5px;font-size:9px;';
        btn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._starsFlowDir = fd;
          // Reset particles so they respawn correctly for the new direction
          layer._stars = null;
          dirRow.querySelectorAll('[data-flow-dir]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._pushHistory();
        });
        dirRow.appendChild(btn);
      });
      container.appendChild(dirRow);

      // --- Star thickness (max raised to 15, 3× previous ceiling) ---
      const thickRow = document.createElement('div');
      thickRow.className = 'll-image-row';
      thickRow.style.gap = '6px';
      const thickLabel = document.createElement('span');
      thickLabel.style.cssText = starsLabelCss;
      thickLabel.textContent = 'Thickness:';
      thickRow.appendChild(thickLabel);
      const thickSlider = document.createElement('input');
      thickSlider.type = 'range';
      thickSlider.className = 'll-row-slider';
      thickSlider.min = '0.5'; thickSlider.max = '15'; thickSlider.step = '0.25';
      thickSlider.value = String(layer._starsThickness ?? 1.0);
      const thickVal = document.createElement('span');
      thickVal.style.cssText = 'font-size:10px;color:#aaa;min-width:24px;text-align:right;';
      thickVal.textContent = Number(thickSlider.value).toFixed(1);
      thickSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._starsThickness = parseFloat(thickSlider.value);
        thickVal.textContent = layer._starsThickness.toFixed(1);
        this._pushHistory();
      });
      thickRow.appendChild(thickSlider);
      thickRow.appendChild(thickVal);
      container.appendChild(thickRow);

      // --- Origin radius / Spread ---
      const spreadRow = document.createElement('div');
      spreadRow.className = 'll-image-row';
      spreadRow.style.gap = '6px';
      const spreadLabel = document.createElement('span');
      spreadLabel.style.cssText = starsLabelCss;
      spreadLabel.textContent = 'Spread:';
      spreadRow.appendChild(spreadLabel);
      const spreadSlider = document.createElement('input');
      spreadSlider.type = 'range';
      spreadSlider.className = 'll-row-slider';
      spreadSlider.min = '0'; spreadSlider.max = '1.35'; spreadSlider.step = '0.025';
      spreadSlider.value = String(layer._starsOriginRadius ?? 0);
      const spreadVal = document.createElement('span');
      spreadVal.style.cssText = 'font-size:10px;color:#aaa;min-width:28px;text-align:right;';
      spreadVal.textContent = Number(spreadSlider.value).toFixed(2);
      spreadSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._starsOriginRadius = parseFloat(spreadSlider.value);
        spreadVal.textContent = layer._starsOriginRadius.toFixed(2);
        layer._stars = null;
        this._pushHistory();
      });
      spreadRow.appendChild(spreadSlider);
      spreadRow.appendChild(spreadVal);
      container.appendChild(spreadRow);

      // --- Particle shape picker ---
      const shapeRow = document.createElement('div');
      shapeRow.className = 'll-image-row';
      shapeRow.style.cssText = 'gap:4px;flex-wrap:wrap;';
      const shapeLabel = document.createElement('span');
      shapeLabel.style.cssText = starsLabelCss + 'margin-right:2px;';
      shapeLabel.textContent = 'Shape:';
      shapeRow.appendChild(shapeLabel);
      const currentShape = layer._starsParticleShape ?? 'streak';
      const PARTICLE_SHAPES = [
        ['streak',   'Oval / Streak'],
        ['star',     '★ Star'],
        ['triangle', 'Triangle'],
        ['diamond',  '◆ Diamond'],
        ['circle',   'Circle'],
      ];
      PARTICLE_SHAPES.forEach(([key, label]) => {
        const btn = document.createElement('button');
        btn.className = 'll-toggle' + (currentShape === key ? ' active' : '');
        btn.textContent = label;
        btn.dataset.particleShape = key;
        btn.style.cssText = 'padding:2px 5px;font-size:9px;';
        btn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._starsParticleShape = key;
          shapeRow.querySelectorAll('[data-particle-shape]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._pushHistory();
        });
        shapeRow.appendChild(btn);
      });
      container.appendChild(shapeRow);

      // --- Size slider ---
      const sizeRow = document.createElement('div');
      sizeRow.className = 'll-image-row';
      sizeRow.style.gap = '6px';
      const sizeLabel = document.createElement('span');
      sizeLabel.style.cssText = starsLabelCss;
      sizeLabel.textContent = 'Size:';
      sizeRow.appendChild(sizeLabel);
      const sizeSlider = document.createElement('input');
      sizeSlider.type = 'range';
      sizeSlider.className = 'll-row-slider';
      sizeSlider.min = '0.2'; sizeSlider.max = '5.0'; sizeSlider.step = '0.1';
      sizeSlider.value = String(layer._starsSize ?? 1.0);
      const sizeVal = document.createElement('span');
      sizeVal.style.cssText = 'font-size:10px;color:#aaa;min-width:28px;text-align:right;';
      sizeVal.textContent = Number(sizeSlider.value).toFixed(1);
      sizeSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._starsSize = parseFloat(sizeSlider.value);
        sizeVal.textContent = layer._starsSize.toFixed(1);
        this._pushHistory();
      });
      sizeRow.appendChild(sizeSlider);
      sizeRow.appendChild(sizeVal);
      container.appendChild(sizeRow);

      // --- Tail Length slider ---
      const tailRow = document.createElement('div');
      tailRow.className = 'll-image-row';
      tailRow.style.gap = '6px';
      const tailLabel = document.createElement('span');
      tailLabel.style.cssText = starsLabelCss;
      tailLabel.textContent = 'Tail Length:';
      tailRow.appendChild(tailLabel);
      const tailSlider = document.createElement('input');
      tailSlider.type = 'range';
      tailSlider.className = 'll-row-slider';
      tailSlider.min = '0'; tailSlider.max = '5.0'; tailSlider.step = '0.1';
      tailSlider.value = String(layer._starsTailLength ?? 1.0);
      const tailVal = document.createElement('span');
      tailVal.style.cssText = 'font-size:10px;color:#aaa;min-width:28px;text-align:right;';
      tailVal.textContent = Number(tailSlider.value).toFixed(1);
      tailSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._starsTailLength = parseFloat(tailSlider.value);
        tailVal.textContent = layer._starsTailLength.toFixed(1);
        this._pushHistory();
      });
      tailRow.appendChild(tailSlider);
      tailRow.appendChild(tailVal);
      container.appendChild(tailRow);

      // --- Multicolor toggle ---
      const starsColorRow = document.createElement('div');
      starsColorRow.className = 'll-image-row';
      starsColorRow.style.gap = '6px';
      const starsColorLabel = document.createElement('span');
      starsColorLabel.style.cssText = starsLabelCss + 'margin-right:2px;';
      starsColorLabel.textContent = 'Color:';
      starsColorRow.appendChild(starsColorLabel);

      const starsIsMultiColor = layer.hue > 360;
      const starsMultiBtn = document.createElement('button');
      starsMultiBtn.className = 'll-toggle' + (starsIsMultiColor ? ' active' : '');
      starsMultiBtn.textContent = 'Multicolor';
      starsMultiBtn.title = 'Cycle unique hue per star particle';
      starsMultiBtn.style.cssText = 'padding:2px 6px;font-size:10px;';
      starsMultiBtn.addEventListener('click', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        if (layer.hue > 360) {
          layer.hue = layer._savedHue ?? 200;
        } else {
          layer._savedHue = layer.hue;
          layer.hue = 365;
        }
        const nowMulti = layer.hue > 360;
        starsMultiBtn.classList.toggle('active', nowMulti);
        // Update hue knob display and dim/undim it
        const hueKnobData = this._panelKnobs.find(k => k.param.key === 'hue');
        if (hueKnobData) {
          hueKnobData.value = layer.hue;
          hueKnobData.updateVisual?.(layer.hue);
          const hueWrapper = hueKnobData.element.parentElement;
          if (hueWrapper) hueWrapper.classList.toggle('ll-disabled', nowMulti);
        }
        this._pushHistory();
      });
      starsColorRow.appendChild(starsMultiBtn);
      container.appendChild(starsColorRow);

      // Dim hue knob on initial render if already in multicolor mode
      if (starsIsMultiColor) {
        requestAnimationFrame(() => {
          const hueKnobData = this._panelKnobs.find(k => k.param.key === 'hue');
          if (hueKnobData) {
            const hueWrapper = hueKnobData.element.parentElement;
            if (hueWrapper) hueWrapper.classList.add('ll-disabled');
          }
        });
      }
    }

    // Lightning-specific controls (Frequency, Intensity, Branching, Duration, Multi-color)
    if (layer.type === 'lightning' && !isMulti) {
      const ltLabelCss = 'font-size:9px;font-weight:bold;color:#000;white-space:nowrap;';
      const ltValCss = 'font-size:10px;color:#aaa;min-width:28px;text-align:right;';

      const addSlider = (labelText, key, defaultVal, min, max, step) => {
        const row = document.createElement('div');
        row.className = 'll-image-row';
        row.style.gap = '6px';
        const lbl = document.createElement('span');
        lbl.style.cssText = ltLabelCss;
        lbl.textContent = labelText;
        row.appendChild(lbl);
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'll-row-slider';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.value = String(layer[key] ?? defaultVal);
        const val = document.createElement('span');
        val.style.cssText = ltValCss;
        val.textContent = Number(slider.value).toFixed(2);
        slider.addEventListener('input', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer[key] = parseFloat(slider.value);
          val.textContent = layer[key].toFixed(2);
          this._pushHistory();
        });
        row.appendChild(slider);
        row.appendChild(val);
        container.appendChild(row);
      };

      addSlider('Frequency:', '_lightFreq',      0.4, 0, 1, 0.025);
      addSlider('Intensity:', '_lightIntensity', 0.6, 0, 1, 0.025);
      addSlider('Branching:', '_lightBranching', 0.5, 0, 1, 0.025);
      addSlider('Duration:',  '_lightDuration',  0.4, 0, 1, 0.025);

      // Multi-color toggle (same sentinel pattern as Lissajous: hue > 360)
      const colorRow = document.createElement('div');
      colorRow.className = 'll-image-row';
      colorRow.style.gap = '6px';
      const colorLabel = document.createElement('span');
      colorLabel.style.cssText = ltLabelCss + 'margin-right:2px;';
      colorLabel.textContent = 'Color:';
      colorRow.appendChild(colorLabel);

      const isMultiColor = layer.hue > 360;
      const multiBtn = document.createElement('button');
      multiBtn.className = 'll-toggle' + (isMultiColor ? ' active' : '');
      multiBtn.textContent = 'Multi';
      multiBtn.title = 'Cycle hue per strike';
      multiBtn.style.cssText = 'min-width:44px;padding:2px 6px;font-size:10px;';
      multiBtn.addEventListener('click', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        if (layer.hue > 360) {
          layer.hue = layer._savedHue ?? 200;
        } else {
          layer._savedHue = layer.hue;
          layer.hue = 365;
        }
        multiBtn.classList.toggle('active', layer.hue > 360);
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

    // --- Spin controls (shared: wash, bubble, pulse, image, lissajous, lightning) ---
    if (SPIN_LAYER_TYPES.has(layer.type) && !isMulti) {
      const spinLabelCss = 'font-size:9px;font-weight:bold;color:#000;white-space:nowrap;';

      // Spin Speed slider
      const spinSpeedRow = document.createElement('div');
      spinSpeedRow.className = 'll-image-row';
      spinSpeedRow.style.gap = '6px';
      const spinSpeedLabel = document.createElement('span');
      spinSpeedLabel.style.cssText = spinLabelCss;
      spinSpeedLabel.textContent = 'Spin Speed:';
      spinSpeedRow.appendChild(spinSpeedLabel);
      const spinSpeedSlider = document.createElement('input');
      spinSpeedSlider.type = 'range';
      spinSpeedSlider.className = 'll-row-slider';
      spinSpeedSlider.min = '0'; spinSpeedSlider.max = '10'; spinSpeedSlider.step = '0.1';
      spinSpeedSlider.value = String(layer._spinSpeed ?? 0);
      const spinSpeedVal = document.createElement('span');
      spinSpeedVal.style.cssText = 'font-size:10px;color:#aaa;min-width:28px;text-align:right;';
      spinSpeedVal.textContent = Number(spinSpeedSlider.value).toFixed(1);
      spinSpeedSlider.addEventListener('input', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        layer._spinSpeed = parseFloat(spinSpeedSlider.value);
        spinSpeedVal.textContent = layer._spinSpeed.toFixed(1);
        this._pushHistory();
      });
      spinSpeedRow.appendChild(spinSpeedSlider);
      spinSpeedRow.appendChild(spinSpeedVal);
      container.appendChild(spinSpeedRow);

      // Direction toggle: Clockwise / Counter-Clockwise
      const spinDirRow = document.createElement('div');
      spinDirRow.className = 'll-image-row';
      spinDirRow.style.cssText = 'gap:4px;flex-wrap:wrap;';
      const spinDirLabel = document.createElement('span');
      spinDirLabel.style.cssText = spinLabelCss + 'margin-right:2px;';
      spinDirLabel.textContent = 'Direction:';
      spinDirRow.appendChild(spinDirLabel);
      const currentSpinDir = layer._spinDir ?? 'cw';
      [['cw', '↻ Clockwise'], ['ccw', '↺ Counter-Clockwise']].forEach(([dir, text]) => {
        const btn = document.createElement('button');
        btn.className = 'll-toggle' + (currentSpinDir === dir ? ' active' : '');
        btn.textContent = text;
        btn.dataset.spinDir = dir;
        btn.style.cssText = 'padding:2px 5px;font-size:9px;';
        btn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._spinDir = dir;
          spinDirRow.querySelectorAll('[data-spin-dir]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._pushHistory();
        });
        spinDirRow.appendChild(btn);
      });
      container.appendChild(spinDirRow);
    }

    // --- Mask controls (all layer types) ---
    if (!isMulti) {
      const hasMask = this._layerHasActiveMask(layer);
      const isEditingThis = this._maskEditingLayerIndex === this.selectedLayerIndex;
      const maskRow = document.createElement('div');
      maskRow.className = 'll-image-row';
      maskRow.style.cssText = 'gap:6px;margin-top:4px;';

      const maskBtn = document.createElement('button');
      maskBtn.className = 'll-toggle' + (isEditingThis ? ' active' : '');
      const shapeCount = hasMask ? layer._masks.length : 0;
      maskBtn.textContent = isEditingThis
        ? '🎭 Editing…'
        : (hasMask ? `🎭 Edit Mask (${shapeCount})` : '🎭 Add Mask');
      maskBtn.title = hasMask
        ? `Edit mask shapes — currently ${layer._maskMode ?? 'include'} mode, ${shapeCount} shape${shapeCount === 1 ? '' : 's'}`
        : 'Add a mask to restrict where this layer renders';
      maskBtn.style.cssText = 'flex:1;padding:4px 8px;font-size:10px;';
      maskBtn.addEventListener('click', () => {
        if (this._isLayerLocked(this.selectedLayerIndex)) return;
        if (this._maskEditingLayerIndex === this.selectedLayerIndex) {
          this._exitMaskEditMode();
        } else {
          // If editing a different layer, swap
          if (this._maskEditingLayerIndex >= 0) this._exitMaskEditMode();
          this._enterMaskEditMode(this.selectedLayerIndex);
        }
      });
      maskRow.appendChild(maskBtn);

      // Mode quick-switch shown when mask exists (matches toolbar Include/Exclude)
      if (hasMask) {
        const modeBtn = document.createElement('button');
        const curMode = layer._maskMode ?? 'include';
        modeBtn.className = 'll-toggle';
        modeBtn.textContent = curMode === 'include' ? 'Inc' : 'Exc';
        modeBtn.title = `Mask mode: ${curMode}. Click to flip.`;
        modeBtn.style.cssText = 'padding:4px 8px;font-size:10px;min-width:36px;'
          + (curMode === 'include' ? 'background:#2a6;color:#fff;' : 'background:#a62;color:#fff;');
        modeBtn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._maskMode = curMode === 'include' ? 'exclude' : 'include';
          this._rebuildLayerKnobs();
          this._pushHistory();
        });
        maskRow.appendChild(modeBtn);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'll-toggle';
        clearBtn.textContent = '✕';
        clearBtn.title = 'Clear mask';
        clearBtn.style.cssText = 'padding:4px 8px;font-size:10px;';
        clearBtn.addEventListener('click', () => {
          if (this._isLayerLocked(this.selectedLayerIndex)) return;
          layer._masks = [];
          this._rebuildLayerList();
          this._rebuildLayerKnobs();
          this._pushHistory();
        });
        maskRow.appendChild(clearBtn);
      }

      container.appendChild(maskRow);
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

    // Reset button — resets this layer's params to defaults; separate from Randomize
    const resetBtn = document.createElement('button');
    resetBtn.className = 'param-tool-btn ll-reset-btn';
    resetBtn.innerHTML = '↺ Reset';
    resetBtn.title = 'Reset all parameters for this layer to defaults';
    resetBtn.addEventListener('click', () => {
      if (this._isLayerLocked(this.selectedLayerIndex)) return;
      // Reset all selected layers
      for (const idx of this.selectedLayerIndices) {
        if (this._isLayerLocked(idx)) return;
        const tgt = this.layers[idx];
        if (!tgt) continue;
        // Reset standard params to LAYER_PARAMS defaults
        LAYER_PARAMS.forEach(p => { tgt.params[p.key] = p.default; });
        // Reset hue, colorMode, blendMode, audioSource
        tgt.hue = 0;
        tgt.colorMode = 'color';
        tgt.blendMode = 'screen';
        tgt.audioSource = 'full';
        // Reset layer-specific params
        if (tgt.type === 'image') {
          tgt._imgPanMode    = 'off';
          tgt._imgPanSpeed   = 0.3;
          tgt._imgMotionBlur = 0;
          tgt._panAccCanvas  = null;
        }
        if (tgt.type === 'stars') {
          tgt._starsRotSpeed      = 0;
          tgt._starsRotDir        = 'cw';
          tgt._starsRotAngle      = undefined;
          tgt._starsThickness     = 1.0;
          tgt._starsOriginRadius  = 0;
          tgt._starsFlowDir       = 'forward';
          tgt._starsParticleShape = 'streak';
          tgt._starsSize          = 1.0;
          tgt._starsTailLength    = 1.0;
          tgt._stars              = null;
          tgt._hyperspace         = false;
          tgt._hyperspaceSnapshot = null;
          tgt._hyperspaceGlobalSnapshot = null;
          // If multicolor was active, restore a normal hue
          if (tgt.hue > 360) tgt.hue = tgt._savedHue ?? 180;
        }
        if (tgt.type === 'lightning') {
          tgt._lightFreq      = 0.4;
          tgt._lightIntensity = 0.6;
          tgt._lightBranching = 0.5;
          tgt._lightDuration  = 0.4;
          tgt._strikes        = null;
        }
        if (tgt.type === 'pulse') {
          tgt._pulseMode  = 'constant';
          tgt._pulseRings = null;
        }
        if (tgt.type === 'lissajous') {
          tgt._lissajousShape = 2;
        }
        if (SPIN_LAYER_TYPES.has(tgt.type)) {
          tgt._spinSpeed = 0;
          tgt._spinDir   = 'cw';
          tgt._spinAngle = undefined;
        }
      }
      this._currentPresetId = null;
      if (this._presetSelect) this._presetSelect.value = '';
      this._rebuildLayerKnobs();
      this._pushHistory();
    });

    toolbar.appendChild(undoBtn);
    toolbar.appendChild(redoBtn);
    toolbar.appendChild(randomBtn);
    toolbar.appendChild(randomAllBtn);
    toolbar.appendChild(dynamicBtn);
    toolbar.appendChild(lockAllBtn);
    toolbar.appendChild(resetBtn);
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
      brightness: { center: 0.5,  spread: 0.35 },   // keep close to neutral (center of -1..1 range)
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
    if (newType === 'stars') {
      layer._stars = null;
      layer._starsRotAngle = undefined;
      layer._starsRotSpeed = Math.random() * 6;
      layer._starsRotDir = Math.random() < 0.5 ? 'cw' : 'ccw';
      layer._starsFlowDir = Math.random() < 0.5 ? 'forward' : 'backward';
      layer._starsThickness = 0.5 + Math.random() * 14.5;
      layer._starsOriginRadius = Math.random() * 1.35;
      const _pShapes = ['streak', 'star', 'triangle', 'diamond', 'circle'];
      layer._starsParticleShape = _pShapes[Math.floor(Math.random() * _pShapes.length)];
      layer._starsSize = 0.3 + Math.random() * 3.5;
      layer._starsTailLength = Math.random() * 4.0;
    }
    if (newType === 'lightning') {
      layer._strikes = null;
      layer._lightNextTime = undefined;
      layer._lightLastBeatTime = undefined;
      layer._lightFreq      = 0.2 + Math.random() * 0.7;
      layer._lightIntensity = 0.3 + Math.random() * 0.6;
      layer._lightBranching = Math.random();
      layer._lightDuration  = 0.15 + Math.random() * 0.7;
    }
    this._randomizeLayerParams(layer);
    // 30% chance of multicolor for stars (must run after _randomizeLayerParams sets hue)
    if (newType === 'stars' && Math.random() < 0.3) {
      layer._savedHue = layer.hue;
      layer.hue = 365;
    }
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
      if (newType === 'stars') {
        layer._stars = null;
        layer._starsRotAngle = undefined;
        layer._starsRotSpeed = Math.random() * 6;
        layer._starsRotDir = Math.random() < 0.5 ? 'cw' : 'ccw';
        layer._starsFlowDir = Math.random() < 0.5 ? 'forward' : 'backward';
        layer._starsThickness = 0.5 + Math.random() * 14.5;
        layer._starsOriginRadius = Math.random() * 1.35;
        const _pShapes = ['streak', 'star', 'triangle', 'diamond', 'circle'];
        layer._starsParticleShape = _pShapes[Math.floor(Math.random() * _pShapes.length)];
        layer._starsSize = 0.3 + Math.random() * 3.5;
        layer._starsTailLength = Math.random() * 4.0;
      }
      if (newType === 'lightning') {
        layer._strikes = null;
        layer._lightNextTime = undefined;
        layer._lightLastBeatTime = undefined;
        layer._lightFreq      = 0.2 + Math.random() * 0.7;
        layer._lightIntensity = 0.3 + Math.random() * 0.6;
        layer._lightBranching = Math.random();
        layer._lightDuration  = 0.15 + Math.random() * 0.7;
      }

      this._randomizeLayerParams(layer);
      // 30% chance of multicolor for stars (must run after _randomizeLayerParams sets hue)
      if (newType === 'stars' && Math.random() < 0.3) {
        layer._savedHue = layer.hue;
        layer.hue = 365;
      }
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
      if (newType === 'stars') {
        layer._stars = null;
        layer._starsRotAngle = undefined;
        layer._starsRotSpeed = Math.random() * 6;
        layer._starsRotDir = Math.random() < 0.5 ? 'cw' : 'ccw';
        layer._starsFlowDir = Math.random() < 0.5 ? 'forward' : 'backward';
        layer._starsThickness = 0.5 + Math.random() * 14.5;
        layer._starsOriginRadius = Math.random() * 1.35;
        const _pShapes = ['streak', 'star', 'triangle', 'diamond', 'circle'];
        layer._starsParticleShape = _pShapes[Math.floor(Math.random() * _pShapes.length)];
        layer._starsSize = 0.3 + Math.random() * 3.5;
        layer._starsTailLength = Math.random() * 4.0;
      }
      if (newType === 'lightning') {
        layer._strikes = null;
        layer._lightNextTime = undefined;
        layer._lightLastBeatTime = undefined;
        layer._lightFreq      = 0.2 + Math.random() * 0.7;
        layer._lightIntensity = 0.3 + Math.random() * 0.6;
        layer._lightBranching = Math.random();
        layer._lightDuration  = 0.15 + Math.random() * 0.7;
      }
      this._randomizeLayerParams(layer);
      // 30% chance of multicolor for stars (must run after _randomizeLayerParams sets hue)
      if (newType === 'stars' && Math.random() < 0.3) {
        layer._savedHue = layer.hue;
        layer.hue = 365;
      }
    });

    // Also randomize Environment globals — sensible ranges, nothing extreme
    this.globals.audioGain   = parseFloat((0.5  + Math.random() * 2.0).toFixed(1));  // 0.5–2.5
    this.globals.speed       = parseFloat((0.2  + Math.random() * 1.3).toFixed(1));  // 0.2–1.5
    this.globals.turbulence  = parseFloat((0.1  + Math.random() * 0.7).toFixed(2));  // 0.1–0.8
    this.globals.bloom       = parseFloat((      Math.random() * 0.4 ).toFixed(2));  // 0–0.4
    this.globals.softness    = parseFloat((      Math.random() * 0.5 ).toFixed(2));  // 0–0.5
    this.globals.contrast    = parseFloat((0.2  + Math.random() * 0.6).toFixed(2));  // 0.2–0.8
    this.globals.saturation  = parseFloat((0.2  + Math.random() * 0.7).toFixed(2));  // 0.2–0.9
    this.globals.interaction = parseFloat((      Math.random() * 0.8 ).toFixed(2));  // 0–0.8
    this.globals.journey     = parseFloat((      Math.random() * 0.6 ).toFixed(2));  // 0–0.6
    this.globals.grain       = parseFloat((      Math.random() * 0.3 ).toFixed(2));  // 0–0.3
    this.journeyBases = null;

    this._rebuildLayerList();
    this._rebuildLayerKnobs();
    this._buildGlobalControls();
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
