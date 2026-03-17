/* ============================================
   iTunes Visualizer — Classic Apple Music Visualizer
   ============================================ */

// --- Simplex 2D Noise (module-local copy) ---
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

// --- Mode & Palette Constants ---
const MODES = ['ribbons', 'smoke', 'tunnel', 'liquid', 'mirror', 'pulse'];
const MODE_LABELS = {
  ribbons: 'Ribbons', smoke: 'Smoke', tunnel: 'Tunnel',
  liquid: 'Liquid', mirror: 'Mirror', pulse: 'Pulse',
};
const PALETTE_NAMES = ['aqua', 'green', 'violet', 'ember', 'rainbow', 'mono'];
const PALETTE_LABELS = {
  aqua: 'Aqua', green: 'Green', violet: 'Violet',
  ember: 'Ember', rainbow: 'Rainbow', mono: 'Mono',
};

// --- Palette Definitions ---
const PALETTES = {
  aqua:    { base: 0.53, range: 0.08, sat: 0.85 },   // cyan-blue
  green:   { base: 0.33, range: 0.1,  sat: 0.8  },   // green
  violet:  { base: 0.78, range: 0.1,  sat: 0.85 },   // magenta-purple
  ember:   { base: 0.07, range: 0.06, sat: 0.9  },   // orange-amber
  rainbow: { base: 0,    range: 1.0,  sat: 0.85 },   // full spectrum
  mono:    { base: 0,    range: 0,    sat: 0    },    // white/gray
};

// --- Knob Parameter Definitions ---
const KNOB_PARAMS = [
  { key: 'glow',     label: 'Glow',     min: 0, max: 1,   default: 0.25, step: 0.05 },
  { key: 'trails',   label: 'Trails',   min: 0, max: 1,   default: 0.7,  step: 0.05 },
  { key: 'feedback', label: 'Feedback', min: 0, max: 1,   default: 0.4,  step: 0.05 },
  { key: 'symmetry', label: 'Symmetry', min: 0, max: 1,   default: 0,    step: 0.05 },
  { key: 'warp',     label: 'Warp',     min: 0, max: 1,   default: 0.5,  step: 0.05 },
  { key: 'pulse',    label: 'Pulse',    min: 0, max: 1,   default: 0.5,  step: 0.05 },
  { key: 'react',    label: 'React',    min: 0, max: 2,   default: 1.0,  step: 0.05 },
];


// ============================================
// Main Visualizer Class
// ============================================
export class ITunesVisualizer {
  static get label() { return 'iTunes'; }
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
    this.beatThreshold = 0.35;
    this.lastBeatTime = 0;
    this.beatDecay = 0;

    // Mode & palette state
    this.currentMode = 'ribbons';
    this.currentPalette = 'aqua';
    this.transitionMode = null;
    this.transitionProgress = 0;

    // Params
    this.params = {};
    KNOB_PARAMS.forEach(p => this.params[p.key] = p.default);
    this.journey = 0;

    // Feedback buffer
    this.feedbackCanvas = document.createElement('canvas');
    this.feedbackCtx = this.feedbackCanvas.getContext('2d');
    this.offCanvas = document.createElement('canvas');
    this.offCtx = this.offCanvas.getContext('2d');
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d');

    // Mode-specific state
    this.ribbons = [];
    this.pulseRings = [];
    this.smokeField = null;

    // Journey state
    this.lastJourneySwitch = 0;
    this.journeyInterval = 20;

    // Panel state
    this.panelEl = null;
    this._knobs = [];
    this._dynamicEnabled = false;
    this._dynamicBtn = null;
    this._progressFill = null;
    this._progressTimer = null;
    this._lcdTitle = null;
    this._lcdArtist = null;

    // Init ribbons
    this._initRibbons();
  }

  setParam() {} // No-op — custom panel manages state

  // ============================================
  // Audio Processing
  // ============================================

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
    const atk = 0.5, rel = 0.08;
    this.smoothBass += (bass - this.smoothBass) * (bass > this.smoothBass ? atk : rel);
    this.smoothMid += (mid - this.smoothMid) * (mid > this.smoothMid ? atk : rel);
    this.smoothTreble += (treble - this.smoothTreble) * (treble > this.smoothTreble ? atk : rel);
    this.smoothEnergy = (this.smoothBass + this.smoothMid + this.smoothTreble) / 3;

    // Beat detection
    const now = performance.now() / 1000;
    this.beatDecay *= 0.92;
    if (this.smoothBass > this.beatThreshold && now - this.lastBeatTime > 0.2) {
      this.beatDecay = 1;
      this.lastBeatTime = now;
    }

    return {
      bass: this.smoothBass,
      mid: this.smoothMid,
      treble: this.smoothTreble,
      energy: this.smoothEnergy,
      beat: this.beatDecay,
    };
  }

  // ============================================
  // Color Palette System
  // ============================================

  _paletteColor(position, brightness, palette) {
    const pal = PALETTES[palette || this.currentPalette];
    if (pal.sat === 0) {
      // Mono
      const l = Math.max(0, Math.min(1, brightness));
      return hslToRgb(0, 0, l);
    }
    const h = (pal.base + position * pal.range) % 1;
    const s = pal.sat;
    const l = Math.max(0.05, Math.min(0.9, brightness));
    return hslToRgb(h < 0 ? h + 1 : h, s, l);
  }

  _paletteHSL(position, brightness, palette) {
    const pal = PALETTES[palette || this.currentPalette];
    const h = pal.sat === 0 ? 0 : (pal.base + position * pal.range) % 1;
    const s = pal.sat;
    const l = Math.max(0.05, Math.min(0.9, brightness));
    return `hsl(${Math.round((h < 0 ? h + 1 : h) * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  _paletteGlow(position, palette) {
    const pal = PALETTES[palette || this.currentPalette];
    if (pal.sat === 0) return 'rgba(255,255,255,0.6)';
    const h = (pal.base + position * pal.range) % 1;
    const [r, g, b] = hslToRgb(h < 0 ? h + 1 : h, pal.sat, 0.6);
    return `rgba(${r},${g},${b},0.6)`;
  }

  // ============================================
  // Mode Renderers
  // ============================================

  _initRibbons() {
    this.ribbons = [];
    for (let i = 0; i < 8; i++) {
      this.ribbons.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        amplitude: 0.2 + Math.random() * 0.3,
        freq: 1 + Math.random() * 2,
        offset: Math.random() * 100,
        width: 2 + Math.random() * 4,
        colorPos: i / 8,
      });
    }
  }

  _renderRibbons(ctx, w, h, time, audio) {
    const react = this.params.react;
    const warpAmt = this.params.warp;

    for (let r = 0; r < this.ribbons.length; r++) {
      const ribbon = this.ribbons[r];
      const segments = 80;
      const bassInfluence = audio.bass * react * 2;
      const midInfluence = audio.mid * react * 1.5;

      ctx.beginPath();
      ctx.strokeStyle = this._paletteHSL(ribbon.colorPos + time * 0.02, 0.45 + audio.energy * react * 0.3);
      ctx.lineWidth = ribbon.width * (1 + bassInfluence * 0.5);
      ctx.shadowBlur = 4 + this.params.glow * 12 + audio.energy * react * 8;
      ctx.shadowColor = this._paletteGlow(ribbon.colorPos + time * 0.02);
      ctx.globalAlpha = 0.6 + audio.energy * react * 0.3;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const noiseVal = noise2D(t * ribbon.freq + time * ribbon.speed + ribbon.offset, ribbon.phase + time * 0.1);
        const warpNoise = warpAmt > 0.01 ? fbm(t * 2 + time * 0.3, ribbon.phase + time * 0.05, 2) * warpAmt : 0;

        const x = t * w;
        const baseY = h / 2;
        const wave = Math.sin(t * Math.PI * ribbon.freq + time * ribbon.speed + ribbon.phase) * ribbon.amplitude * h;
        const noise = noiseVal * h * 0.15 * (1 + midInfluence);
        const warp = warpNoise * h * 0.2;
        const y = baseY + wave + noise + warp;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  _renderSmoke(ctx, w, h, time, audio) {
    const scale = 4;
    const sw = Math.ceil(w / scale);
    const sh = Math.ceil(h / scale);

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    const react = this.params.react;
    const warpAmt = this.params.warp;
    const bassBoost = audio.bass * react;
    const midBoost = audio.mid * react;

    for (let py = 0; py < sh; py++) {
      for (let px = 0; px < sw; px++) {
        const nx = px / sw * 3;
        const ny = py / sh * 3;

        // Domain warping for smoke flow
        const warp1 = fbm(nx + time * 0.15, ny + time * 0.1, 2) * (0.8 + warpAmt * 2 + bassBoost * 2);
        const warp2 = fbm(nx + 5.2 + time * 0.12, ny + 1.3 + time * 0.08, 2) * (0.8 + warpAmt * 2 + bassBoost * 2);

        const val = fbm(nx + warp1, ny + warp2 + time * 0.05, 3);
        const edge = noise2D((nx + warp1) * 2, (ny + warp2) * 2) * (0.3 + audio.treble * react);

        const density = Math.max(0, val * 0.7 + edge * 0.3 + bassBoost * 0.4);
        const brightness = density * (0.4 + midBoost * 0.3);

        const [r, g, b] = this._paletteColor(val * 0.5 + time * 0.01, brightness);

        // Paint at full resolution by filling scale x scale block
        for (let sy = 0; sy < scale && py * scale + sy < h; sy++) {
          for (let sx = 0; sx < scale && px * scale + sx < w; sx++) {
            const idx = ((py * scale + sy) * w + (px * scale + sx)) * 4;
            data[idx] = r;
            data[idx+1] = g;
            data[idx+2] = b;
            data[idx+3] = Math.round(Math.min(1, density) * 255);
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderTunnel(ctx, w, h, time, audio) {
    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    const rings = 40 + Math.round(audio.energy * this.params.react * 20);
    const react = this.params.react;
    const warpAmt = this.params.warp;
    const speed = 1 + audio.bass * react * 3;

    for (let i = rings; i >= 0; i--) {
      const progress = i / rings;
      const baseR = progress * maxR;
      const r = baseR + (time * speed * 50) % maxR;
      const actualR = r % maxR;
      if (actualR < 2) continue;

      const noiseR = noise2D(progress * 3 + time * 0.3, time * 0.1) * warpAmt * 30;
      const distortedR = actualR + noiseR;

      const brightness = 0.3 + (1 - progress) * 0.4 + audio.energy * react * 0.2;
      const colorPos = progress + time * 0.05;

      ctx.beginPath();
      ctx.strokeStyle = this._paletteHSL(colorPos, brightness);
      ctx.lineWidth = 1.5 + (1 - progress) * 2 + audio.beat * react * 3;
      ctx.shadowBlur = this.params.glow * 8 + audio.beat * react * 6;
      ctx.shadowColor = this._paletteGlow(colorPos);
      ctx.globalAlpha = 0.3 + (1 - progress) * 0.5;

      // Draw distorted ring
      const segs = 60;
      for (let s = 0; s <= segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        const localR = distortedR + noise2D(angle * 2 + time * 0.2, progress * 5) * warpAmt * 20;
        const x = cx + Math.cos(angle) * localR;
        const y = cy + Math.sin(angle) * localR;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  _renderLiquid(ctx, w, h, time, audio) {
    const scale = 5;
    const lw = Math.ceil(w / scale);
    const lh = Math.ceil(h / scale);
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    const react = this.params.react;
    const warpAmt = this.params.warp;
    const bassWarp = audio.bass * react * 2;

    for (let py = 0; py < lh; py++) {
      for (let px = 0; px < lw; px++) {
        let nx = (px / lw - 0.5) * 4;
        let ny = (py / lh - 0.5) * 4;

        // Multi-layer domain warping
        const w1x = fbm(nx + time * 0.08, ny + time * 0.06, 2);
        const w1y = fbm(nx + 5.2 + time * 0.07, ny + 1.3 + time * 0.05, 2);
        const warpStrength = (1.5 + warpAmt * 3 + bassWarp);
        nx += w1x * warpStrength;
        ny += w1y * warpStrength;

        // Second warp pass
        const w2 = fbm(nx + time * 0.03, ny + time * 0.02, 2) * (0.5 + audio.mid * react);
        nx += w2;

        const val = fbm(nx, ny, 3);
        const specular = Math.pow(Math.max(0, noise2D(nx * 2, ny * 2 + time * 0.1)), 3) * audio.treble * react * 2;

        const brightness = 0.2 + val * 0.35 + audio.energy * react * 0.2 + specular * 0.3;
        const [r, g, b] = this._paletteColor(val * 0.5 + w2 * 0.3 + time * 0.01, brightness);

        // Fill block
        for (let sy = 0; sy < scale && py * scale + sy < h; sy++) {
          for (let sx = 0; sx < scale && px * scale + sx < w; sx++) {
            const idx = ((py * scale + sy) * w + (px * scale + sx)) * 4;
            data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderMirror(ctx, w, h, time, audio) {
    // Render to left half then mirror
    const hw = Math.ceil(w / 2);
    const react = this.params.react;

    // Audio influence — when silent, lines are straight; when loud, they wave
    const audioInfluence = Math.min(1, audio.energy * react * 3);

    // Draw lines on left half — straight baseline that reacts to music
    const curves = 12 + Math.round(audio.energy * react * 8);
    for (let c = 0; c < curves; c++) {
      const progress = c / curves;
      const phase = progress * Math.PI * 4 + time * 0.5;

      ctx.beginPath();
      const brightness = 0.3 + audioInfluence * 0.3;
      ctx.strokeStyle = this._paletteHSL(progress + time * 0.02, brightness);
      ctx.lineWidth = 1 + audio.bass * react * 3;
      ctx.shadowBlur = this.params.glow * 6 + audioInfluence * 8;
      ctx.shadowColor = this._paletteGlow(progress + time * 0.02);
      ctx.globalAlpha = 0.3 + audioInfluence * 0.4;

      const segs = 40;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const x = t * hw;
        // Base position: evenly spaced straight horizontal lines
        const baseY = h * 0.15 + progress * h * 0.7;
        // Wave displacement — scales with audio energy (0 when silent = straight lines)
        const waveAmp = h * 0.15 * audioInfluence;
        const wave = Math.sin(t * phase) * waveAmp * (0.3 + audio.bass * react);
        const nz = noise2D(t * 3 + time * 0.2, progress * 5 + time * 0.1) * h * 0.08 * this.params.warp * audioInfluence;
        const y = baseY + wave + nz;

        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Mirror: flip left half to right
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(ctx.canvas, 0, 0, hw, h, 0, 0, hw, h);
    ctx.restore();
  }

  _renderPulse(ctx, w, h, time, audio) {
    const cx = w / 2, cy = h / 2;
    const react = this.params.react;
    const maxR = Math.sqrt(cx * cx + cy * cy) * 1.2;

    // Always emit persistent rings at a steady rate
    const ringInterval = 0.15; // new ring every 150ms
    if (!this._lastPulseRingTime) this._lastPulseRingTime = time;
    while (time - this._lastPulseRingTime >= ringInterval) {
      this._lastPulseRingTime += ringInterval;
      if (this.pulseRings.length < 60) {
        const isBeat = audio.beat > 0.5;
        this.pulseRings.push({
          born: this._lastPulseRingTime,
          speed: 80 + audio.energy * react * 150 + (isBeat ? 80 : 0),
          width: 1.5 + (isBeat ? audio.bass * react * 4 : 0.5),
          colorPos: (this._lastPulseRingTime * 0.3) % 1,
          brightness: 0.3 + audio.energy * react * 0.3 + (isBeat ? 0.2 : 0),
          isBeat,
        });
      }
    }

    // Update & draw rings
    this.pulseRings = this.pulseRings.filter(ring => {
      const age = time - ring.born;
      const r = age * ring.speed;
      if (r > maxR) return false;

      const fade = Math.max(0, 1 - r / maxR);
      ctx.beginPath();
      ctx.strokeStyle = this._paletteHSL(ring.colorPos + age * 0.1, ring.brightness * fade);
      ctx.lineWidth = ring.width * (1 + fade * 0.5);
      if (ring.isBeat) {
        ctx.shadowBlur = this.params.glow * 10 * fade + audio.energy * react * 5;
        ctx.shadowColor = this._paletteGlow(ring.colorPos + age * 0.1);
      } else {
        ctx.shadowBlur = this.params.glow * 3 * fade;
        ctx.shadowColor = this._paletteGlow(ring.colorPos);
      }
      ctx.globalAlpha = fade * (ring.isBeat ? 0.7 : 0.35);

      // Distorted circle
      const segs = 60;
      for (let s = 0; s <= segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        const distort = noise2D(angle * 2 + time * 0.3, r * 0.01) * this.params.warp * 30;
        const x = cx + Math.cos(angle) * (r + distort);
        const y = cy + Math.sin(angle) * (r + distort);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      return true;
    });

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Central pulse glow
    const pulseR = 20 + audio.beat * react * 60;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
    const [pr, pg, pb] = this._paletteColor(time * 0.05, 0.6);
    grad.addColorStop(0, `rgba(${pr},${pg},${pb},${0.3 + audio.beat * 0.4})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - pulseR, cy - pulseR, pulseR * 2, pulseR * 2);
  }

  // ============================================
  // Feedback Buffer & Post-Processing
  // ============================================

  _applyFeedback(ctx, w, h, time, audio) {
    const trails = this.params.trails;
    const feedback = this.params.feedback;
    if (trails < 0.01 && feedback < 0.01) return;

    // Draw feedback buffer with slight zoom + rotation + fade
    const zoom = 1 + feedback * 0.02 + audio.beat * feedback * 0.01;
    const rot = feedback * 0.003 * Math.sin(time * 0.2);

    ctx.save();
    ctx.globalAlpha = trails * 0.85 + 0.1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rot);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(this.feedbackCanvas, 0, 0, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _applySymmetry(ctx, w, h) {
    const sym = this.params.symmetry;
    if (sym < 0.01) return;

    if (sym < 0.5) {
      // Bilateral symmetry (horizontal flip)
      const blend = sym * 2;
      ctx.save();
      ctx.globalAlpha = blend * 0.5;
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      // Radial symmetry (4-fold)
      const blend = (sym - 0.5) * 2;
      ctx.save();
      ctx.globalAlpha = blend * 0.4;
      // Flip horizontal
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
      // Flip vertical
      ctx.save();
      ctx.globalAlpha = blend * 0.4;
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  _applyBloom(ctx, w, h, audio) {
    const glow = this.params.glow;
    if (glow < 0.01) return;

    this.bloomCanvas.width = w;
    this.bloomCanvas.height = h;
    this.bloomCtx.drawImage(ctx.canvas, 0, 0);

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow * 0.15 + audio.energy * glow * 0.1;
    ctx.filter = `blur(${Math.round(6 + glow * 14)}px)`;
    ctx.drawImage(this.bloomCanvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ============================================
  // Main Draw Loop
  // ============================================

  draw(frequencyData, timeDomainData) {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;

    const time = performance.now() / 1000 - this.startTime;
    const audio = this._computeAudio(frequencyData);

    // Ensure offscreen canvases match
    if (this.feedbackCanvas.width !== w || this.feedbackCanvas.height !== h) {
      this.feedbackCanvas.width = w;
      this.feedbackCanvas.height = h;
    }
    if (this.offCanvas.width !== w || this.offCanvas.height !== h) {
      this.offCanvas.width = w;
      this.offCanvas.height = h;
    }

    // Journey auto-transitions
    this._updateJourney(time);

    // Step 1: Clear and apply feedback from previous frame
    ctx.fillStyle = 'rgba(0,0,0,' + (1 - this.params.trails * 0.85) + ')';
    ctx.fillRect(0, 0, w, h);

    this._applyFeedback(ctx, w, h, time, audio);

    // Step 2: Render current mode to offscreen canvas
    this.offCtx.clearRect(0, 0, w, h);
    const renderMode = this.transitionMode || this.currentMode;
    this._renderMode(this.offCtx, w, h, time, audio, renderMode);

    // Step 3: Composite new content with additive blending
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(this.offCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Step 4: Apply symmetry
    this._applySymmetry(ctx, w, h);

    // Step 5: Apply bloom
    this._applyBloom(ctx, w, h, audio);

    // Step 6: Save to feedback buffer
    this.feedbackCtx.clearRect(0, 0, w, h);
    this.feedbackCtx.drawImage(canvas, 0, 0);

    // Update LCD display
    this._updateLCD(audio, time);
  }

  _renderMode(ctx, w, h, time, audio, mode) {
    switch (mode) {
      case 'ribbons': this._renderRibbons(ctx, w, h, time, audio); break;
      case 'smoke':   this._renderSmoke(ctx, w, h, time, audio); break;
      case 'tunnel':  this._renderTunnel(ctx, w, h, time, audio); break;
      case 'liquid':  this._renderLiquid(ctx, w, h, time, audio); break;
      case 'mirror':  this._renderMirror(ctx, w, h, time, audio); break;
      case 'pulse':   this._renderPulse(ctx, w, h, time, audio); break;
    }
  }

  // ============================================
  // Journey System
  // ============================================

  _updateJourney(time) {
    if (this.journey < 0.01) return;

    const interval = 30 - this.journey * 20; // 30s at low, 10s at max
    if (time - this.lastJourneySwitch > interval) {
      this.lastJourneySwitch = time;

      // Pick random new mode different from current
      const available = MODES.filter(m => m !== this.currentMode);
      const newMode = available[Math.floor(Math.random() * available.length)];
      this.currentMode = newMode;

      // Optionally shift palette
      if (Math.random() < this.journey * 0.5) {
        const palettes = PALETTE_NAMES.filter(p => p !== this.currentPalette);
        this.currentPalette = palettes[Math.floor(Math.random() * palettes.length)];
        // Update palette dropdown if panel exists
        if (this._paletteSelect) {
          this._paletteSelect.value = this.currentPalette;
        }
      }

      // Update mode dropdown if panel exists
      if (this._modeSelect) {
        this._modeSelect.value = this.currentMode;
      }

      // Re-init mode-specific state
      if (this.currentMode === 'ribbons') this._initRibbons();
      if (this.currentMode === 'pulse') this.pulseRings = [];
    }

    // Subtly modulate params around user-set values
    const modAmount = this.journey * 0.15;
    // (modulation is handled in updateDynamic if dynamic is enabled)
  }

  // ============================================
  // LCD Display Update
  // ============================================

  _updateLCD(audio, time) {
    if (!this._lcdTitle) return;

    // Try to read song info from MediaSession API
    let songTitle = null;
    let songArtist = null;
    if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
      const meta = navigator.mediaSession.metadata;
      songTitle = meta.title;
      songArtist = meta.artist;
    }

    if (songTitle) {
      this._lcdTitle.textContent = songTitle;
      this._lcdArtist.textContent = songArtist || '';
    } else {
      // Fallback: show mode + palette
      this._lcdTitle.textContent = `${MODE_LABELS[this.currentMode]} \u2014 ${PALETTE_LABELS[this.currentPalette]}`;
      this._lcdArtist.textContent = 'Audio Visualizer';
    }

    // Audio level bar
    const barWidth = Math.round(audio.energy * 100);
    if (this._progressFill) {
      this._progressFill.style.width = barWidth + '%';
    }
  }

  // ============================================
  // Panel: buildPanel / destroyPanel
  // ============================================

  buildPanel(controlPanelEl) {
    this.destroyPanel();

    const windowEl = document.querySelector('.window');
    windowEl.classList.add('itunes-active');

    // Hide standard UI elements (keep menu bar for preset switching)
    const titleBar = document.querySelector('.title-bar');
    const statusBar = document.querySelector('.status-bar');
    const controlPanel = document.querySelector('.control-panel');
    if (titleBar) titleBar.style.display = 'none';
    if (statusBar) statusBar.style.display = 'none';
    if (controlPanel) controlPanel.style.display = 'none';

    // Create iTunes chrome overlay
    const overlay = document.createElement('div');
    overlay.className = 'itunes-overlay';
    this.panelEl = overlay;

    // === TOP BAR ===
    const topBar = document.createElement('div');
    topBar.className = 'itunes-top-bar';

    // Back button (navigate to previous preset)
    const backBtn = document.createElement('button');
    backBtn.className = 'itunes-btn transport';
    backBtn.textContent = '\u25C0';
    backBtn.title = 'Back to Previous Preset';
    backBtn.style.marginRight = '6px';
    backBtn.addEventListener('click', () => {
      if (this.onBack) {
        this.onBack();
      } else {
        const presetMenu = document.querySelector('.preset-menu[data-preset="oscilloscope"]');
        if (presetMenu) presetMenu.click();
      }
    });

    // Transport buttons (media controls)
    const transport = document.createElement('div');
    transport.className = 'itunes-transport';

    const prevBtn = this._makeTransportBtn('\u23EE', 'Previous');
    const playBtn = this._makeTransportBtn('\u25B6', 'Play/Pause', true);
    const nextBtn = this._makeTransportBtn('\u23ED', 'Next');

    // Wire transport buttons to MediaSession (for controlling system media)
    playBtn.addEventListener('click', () => {
      navigator.mediaSession?.playbackState === 'playing'
        ? document.querySelector('video,audio')?.pause()
        : document.querySelector('video,audio')?.play();
    });
    prevBtn.addEventListener('click', () => {
      if ('mediaSession' in navigator) {
        // Trigger previous track action
        const handlers = navigator.mediaSession;
        try { handlers.setActionHandler('previoustrack', null); } catch {}
      }
    });
    nextBtn.addEventListener('click', () => {
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.setActionHandler('nexttrack', null); } catch {}
      }
    });

    transport.appendChild(prevBtn);
    transport.appendChild(playBtn);
    transport.appendChild(nextBtn);

    // LCD Display
    const display = document.createElement('div');
    display.className = 'itunes-display';

    const songInfo = document.createElement('div');
    songInfo.className = 'itunes-song-info';

    const title = document.createElement('div');
    title.className = 'itunes-song-title';
    title.textContent = 'iTunes Visualizer';
    this._lcdTitle = title;

    const artist = document.createElement('div');
    artist.className = 'itunes-song-artist';
    artist.textContent = 'Audio Visualizer';
    this._lcdArtist = artist;

    songInfo.appendChild(title);
    songInfo.appendChild(artist);

    const progressWrap = document.createElement('div');
    progressWrap.className = 'itunes-progress-wrap';

    const timeLeft = document.createElement('span');
    timeLeft.className = 'itunes-time';
    timeLeft.textContent = '0:00';

    const progressBar = document.createElement('div');
    progressBar.className = 'itunes-progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'itunes-progress-fill';
    this._progressFill = progressFill;
    progressBar.appendChild(progressFill);

    const timeRight = document.createElement('span');
    timeRight.className = 'itunes-time right';
    timeRight.textContent = '-:--';

    progressWrap.appendChild(timeLeft);
    progressWrap.appendChild(progressBar);
    progressWrap.appendChild(timeRight);

    display.appendChild(songInfo);
    display.appendChild(progressWrap);

    // Fullscreen button (old Mac style)
    const fsBtn = document.createElement('button');
    fsBtn.className = 'itunes-fs-btn';
    fsBtn.title = 'Fullscreen';
    fsBtn.innerHTML = '<span class="mac-fs-icon"></span>';
    fsBtn.addEventListener('click', () => {
      if (this.onFullscreen) {
        this.onFullscreen();
      } else {
        const el = document.documentElement;
        if (!document.fullscreenElement) {
          el.requestFullscreen?.() || el.webkitRequestFullscreen?.();
        } else {
          document.exitFullscreen?.() || document.webkitExitFullscreen?.();
        }
      }
    });

    topBar.appendChild(backBtn);
    topBar.appendChild(transport);
    topBar.appendChild(display);
    topBar.appendChild(fsBtn);

    // === BOTTOM BAR ===
    const bottomBar = document.createElement('div');
    bottomBar.className = 'itunes-bottom-bar';

    // Left: Mode + Palette selects
    const bottomLeft = document.createElement('div');
    bottomLeft.className = 'itunes-bottom-left';

    // Mode select
    const modeWrap = document.createElement('div');
    modeWrap.className = 'itunes-select-wrap';
    const modeLabel = document.createElement('span');
    modeLabel.className = 'itunes-select-label';
    modeLabel.textContent = 'STYLE';
    const modeSelect = document.createElement('select');
    modeSelect.className = 'itunes-select';
    this._modeSelect = modeSelect;

    // Add "Auto" option
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = 'Auto';
    modeSelect.appendChild(autoOpt);

    MODES.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = MODE_LABELS[m];
      if (m === this.currentMode) opt.selected = true;
      modeSelect.appendChild(opt);
    });
    modeSelect.addEventListener('change', () => {
      if (modeSelect.value === 'auto') {
        // Enable auto mode via journey
        this.journey = Math.max(this.journey, 0.5);
        if (this._journeySlider) this._journeySlider.value = this.journey;
      } else {
        this.currentMode = modeSelect.value;
        if (this.currentMode === 'ribbons') this._initRibbons();
        if (this.currentMode === 'pulse') this.pulseRings = [];
      }
    });
    modeWrap.appendChild(modeLabel);
    modeWrap.appendChild(modeSelect);

    // Palette select
    const palWrap = document.createElement('div');
    palWrap.className = 'itunes-select-wrap';
    const palLabel = document.createElement('span');
    palLabel.className = 'itunes-select-label';
    palLabel.textContent = 'PALETTE';
    const palSelect = document.createElement('select');
    palSelect.className = 'itunes-select';
    this._paletteSelect = palSelect;
    PALETTE_NAMES.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = PALETTE_LABELS[p];
      if (p === this.currentPalette) opt.selected = true;
      palSelect.appendChild(opt);
    });
    palSelect.addEventListener('change', () => {
      this.currentPalette = palSelect.value;
    });
    palWrap.appendChild(palLabel);
    palWrap.appendChild(palSelect);

    bottomLeft.appendChild(modeWrap);
    bottomLeft.appendChild(palWrap);

    // Center: Knobs
    const bottomCenter = document.createElement('div');
    bottomCenter.className = 'itunes-bottom-center';

    const knobsRow = document.createElement('div');
    knobsRow.className = 'itunes-knobs-row';
    this._knobs = [];

    KNOB_PARAMS.forEach(param => {
      const knobData = this._createKnob(knobsRow, param, this.params[param.key], (val) => {
        this.params[param.key] = val;
      });
      this._knobs.push(knobData);
    });
    bottomCenter.appendChild(knobsRow);

    // Right: Journey slider + Randomize/Dynamic
    const bottomRight = document.createElement('div');
    bottomRight.className = 'itunes-bottom-right';

    // Journey slider
    const journeyWrap = document.createElement('div');
    journeyWrap.className = 'itunes-journey-wrap';
    const journeyLabel = document.createElement('span');
    journeyLabel.className = 'itunes-journey-label';
    journeyLabel.textContent = 'JOURNEY';
    const journeySlider = document.createElement('input');
    journeySlider.type = 'range';
    journeySlider.className = 'itunes-journey-slider';
    journeySlider.min = '0';
    journeySlider.max = '1';
    journeySlider.step = '0.05';
    journeySlider.value = this.journey;
    this._journeySlider = journeySlider;
    journeySlider.addEventListener('input', () => {
      this.journey = parseFloat(journeySlider.value);
    });
    journeyWrap.appendChild(journeyLabel);
    journeyWrap.appendChild(journeySlider);

    // Randomize params button (shuffle current style)
    const randomBtn = document.createElement('button');
    randomBtn.className = 'itunes-btn itunes-options-btn';
    randomBtn.textContent = '🎲';
    randomBtn.title = 'Randomize Settings';
    randomBtn.addEventListener('click', () => this._randomizeParams());

    // Randomize all button (random style + params)
    const randomAllBtn = document.createElement('button');
    randomAllBtn.className = 'itunes-btn itunes-options-btn';
    randomAllBtn.textContent = '🔀';
    randomAllBtn.title = 'Randomize Style + Settings';
    randomAllBtn.addEventListener('click', () => this._randomizeAll());

    // Dynamic button
    const dynamicBtn = document.createElement('button');
    dynamicBtn.className = 'itunes-btn itunes-options-btn' + (this._dynamicEnabled ? ' active' : '');
    dynamicBtn.textContent = '\u2726';
    dynamicBtn.title = 'Dynamic';
    this._dynamicBtn = dynamicBtn;
    dynamicBtn.addEventListener('click', () => this._toggleDynamic());

    bottomRight.appendChild(journeyWrap);
    bottomRight.appendChild(randomBtn);
    bottomRight.appendChild(randomAllBtn);
    bottomRight.appendChild(dynamicBtn);

    bottomBar.appendChild(bottomLeft);
    bottomBar.appendChild(bottomCenter);
    bottomBar.appendChild(bottomRight);

    // Assemble overlay
    overlay.appendChild(topBar);
    // Canvas stays in its original position (between top and bottom bars)
    overlay.appendChild(bottomBar);

    // Insert overlay into the window, before and after main-content
    const mainContent = document.querySelector('.main-content');
    mainContent.parentNode.insertBefore(topBar, mainContent);
    mainContent.parentNode.appendChild(bottomBar);

    // Store for cleanup (we moved elements, not appended overlay as single element)
    this._topBar = topBar;
    this._bottomBar = bottomBar;
    // Don't need the overlay wrapper itself
    this.panelEl = { topBar, bottomBar };
  }

  destroyPanel() {
    const windowEl = document.querySelector('.window');
    if (windowEl) windowEl.classList.remove('itunes-active');

    // Remove iTunes bars
    if (this._topBar) { this._topBar.remove(); this._topBar = null; }
    if (this._bottomBar) { this._bottomBar.remove(); this._bottomBar = null; }

    // Restore standard UI elements
    const titleBar = document.querySelector('.title-bar');
    const statusBar = document.querySelector('.status-bar');
    const controlPanel = document.querySelector('.control-panel');
    if (titleBar) titleBar.style.display = '';
    if (statusBar) statusBar.style.display = '';
    if (controlPanel) controlPanel.style.display = '';

    this.panelEl = null;
    this._knobs = [];
    this._modeSelect = null;
    this._paletteSelect = null;
    this._journeySlider = null;
    this._progressFill = null;
    this._lcdTitle = null;
    this._lcdArtist = null;
    this._dynamicBtn = null;
  }

  // ============================================
  // UI Helpers
  // ============================================

  _makeTransportBtn(text, title, isPlay) {
    const btn = document.createElement('button');
    btn.className = 'itunes-btn transport' + (isPlay ? ' play' : '');
    btn.textContent = text;
    btn.title = title;
    return btn;
  }

  _createKnob(container, param, initialValue, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'itunes-knob-wrapper';

    const knob = document.createElement('div');
    knob.className = 'knob itunes-knob';
    const indicator = document.createElement('div');
    indicator.className = 'knob-indicator';
    knob.appendChild(indicator);

    const label = document.createElement('div');
    label.className = 'knob-label';
    label.textContent = param.label;

    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'knob-value';

    // Dynamic indicator dot (click to toggle lock/unlock)
    const dynIndicator = document.createElement('div');
    dynIndicator.className = 'knob-dynamic-dot itunes-dyn-dot';
    dynIndicator.title = 'Toggle dynamic';
    dynIndicator.style.display = 'none';

    wrapper.appendChild(knob);
    wrapper.appendChild(label);
    wrapper.appendChild(valueDisplay);
    wrapper.appendChild(dynIndicator);
    container.appendChild(wrapper);

    const knobData = {
      element: knob, valueDisplay, dynIndicator, param, value: initialValue,
      baseValue: initialValue, dynamic: false,
      dynamicPhase: Math.random() * Math.PI * 2,
      dynamicFreq: 0.08 + Math.random() * 0.12,
      onChange,
      updateVisual: null,
    };

    dynIndicator.addEventListener('click', () => {
      knobData.dynamic = !knobData.dynamic;
      dynIndicator.classList.toggle('active', knobData.dynamic);
      if (!knobData.dynamic) {
        knobData.value = knobData.baseValue;
        knobData.updateVisual();
        knobData.onChange(knobData.value);
      }
    });

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

    // Drag behavior
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

  // ============================================
  // Randomize & Dynamic
  // ============================================

  _randomizeParams() {
    KNOB_PARAMS.forEach((param, i) => {
      const range = param.max - param.min;
      let newValue = param.min + Math.random() * range;
      newValue = Math.round(newValue / param.step) * param.step;
      newValue = Math.max(param.min, Math.min(param.max, newValue));
      this.params[param.key] = newValue;
      if (this._knobs[i]) {
        this._knobs[i].value = newValue;
        this._knobs[i].baseValue = newValue;
        this._knobs[i].updateVisual();
      }
    });

    // Random palette only
    this.currentPalette = PALETTE_NAMES[Math.floor(Math.random() * PALETTE_NAMES.length)];
    if (this._paletteSelect) this._paletteSelect.value = this.currentPalette;
  }

  _randomizeAll() {
    this._randomizeParams();

    // Also random mode
    this.currentMode = MODES[Math.floor(Math.random() * MODES.length)];
    if (this._modeSelect) this._modeSelect.value = this.currentMode;
    if (this.currentMode === 'ribbons') this._initRibbons();
    if (this.currentMode === 'pulse') this.pulseRings = [];
  }

  _toggleDynamic() {
    this._dynamicEnabled = !this._dynamicEnabled;
    if (this._dynamicBtn) {
      this._dynamicBtn.classList.toggle('active', this._dynamicEnabled);
      this._dynamicBtn.style.background = this._dynamicEnabled
        ? 'linear-gradient(180deg, #b8d8f0 0%, #7ab0d8 100%)'
        : '';
    }

    this._knobs.forEach(k => {
      // Show/hide dynamic dot
      if (k.dynIndicator) {
        k.dynIndicator.style.display = this._dynamicEnabled ? '' : 'none';
      }
      if (this._dynamicEnabled) {
        k.dynamic = true;
        k.baseValue = k.value;
        k.dynamicPhase = Math.random() * Math.PI * 2;
        k.dynamicFreq = 0.08 + Math.random() * 0.12;
        if (k.dynIndicator) k.dynIndicator.classList.add('active');
      } else {
        k.dynamic = false;
        if (k.dynIndicator) k.dynIndicator.classList.remove('active');
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

    this._knobs.forEach(k => {
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

  // ============================================
  // Reset
  // ============================================

  reset() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.startTime = performance.now() / 1000;
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothEnergy = 0;
    this.beatDecay = 0;
    this.pulseRings = [];
    this._initRibbons();

    // Clear feedback buffer
    if (this.feedbackCanvas.width > 0) {
      this.feedbackCtx.clearRect(0, 0, this.feedbackCanvas.width, this.feedbackCanvas.height);
    }
  }

  // ============================================
  // Save / Load State
  // ============================================

  getState() {
    return {
      mode: this.currentMode,
      palette: this.currentPalette,
      params: { ...this.params },
      journey: this.journey,
    };
  }

  setState(state) {
    if (state.mode) {
      this.currentMode = state.mode;
      if (this._modeSelect) this._modeSelect.value = state.mode;
      if (state.mode === 'ribbons') this._initRibbons();
      if (state.mode === 'pulse') this.pulseRings = [];
    }
    if (state.palette) {
      this.currentPalette = state.palette;
      if (this._paletteSelect) this._paletteSelect.value = state.palette;
    }
    if (state.params) {
      Object.assign(this.params, state.params);
      this._knobs.forEach((k, i) => {
        if (state.params[k.param.key] !== undefined) {
          k.value = state.params[k.param.key];
          k.baseValue = k.value;
          k.updateVisual();
        }
      });
    }
    if (state.journey !== undefined) {
      this.journey = state.journey;
      if (this._journeySlider) this._journeySlider.value = state.journey;
    }
  }
}
