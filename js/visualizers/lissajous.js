// Shape presets: each is an array of 3 oscillator layers
// { fX, fY, phase, amp } — frequencies, phase offset, amplitude weight
const SHAPES = [
  // 1: Dot — audio-reactive point (handled specially in draw)
  [
    { fX: 0, fY: 0, phase: 0, amp: 0 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
  ],
  // 2: Figure-8 — clean classic Lissajous
  [
    { fX: 1, fY: 2, phase: Math.PI / 4, amp: 0.9 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
  ],
  // 3: Bow — elegant pretzel
  [
    { fX: 2, fY: 3, phase: Math.PI / 3, amp: 0.9 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
  ],
  // 4: Trefoil — 3-lobed clover
  [
    { fX: 2, fY: 3, phase: Math.PI / 2, amp: 0.65 },
    { fX: 3, fY: 2, phase: 0, amp: 0.45 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
  ],
  // 5: Flower — petal pattern with orbital center
  [
    { fX: 3, fY: 4, phase: Math.PI / 6, amp: 0.6 },
    { fX: 1, fY: 1, phase: Math.PI / 2, amp: 0.45 },
    { fX: 0, fY: 0, phase: 0, amp: 0 },
  ],
  // 6: Spirograph — complex multi-harmonic loops
  [
    { fX: 3, fY: 5, phase: Math.PI / 4, amp: 0.5 },
    { fX: 5, fY: 3, phase: Math.PI / 3, amp: 0.35 },
    { fX: 1, fY: 2, phase: 0, amp: 0.25 },
  ],
  // 7: Orbit — precessing orbital rings
  [
    { fX: 1, fY: 1, phase: Math.PI / 2, amp: 0.55 },
    { fX: 6, fY: 7, phase: 0, amp: 0.3 },
    { fX: 3, fY: 4, phase: Math.PI / 5, amp: 0.2 },
  ],
  // 8: Star — angular star-like pattern
  [
    { fX: 2, fY: 5, phase: Math.PI / 4, amp: 0.5 },
    { fX: 5, fY: 2, phase: Math.PI / 3, amp: 0.4 },
    { fX: 3, fY: 7, phase: 0, amp: 0.2 },
  ],
  // 9: Knot — intricate high-harmonic knot
  [
    { fX: 3, fY: 7, phase: Math.PI / 5, amp: 0.45 },
    { fX: 5, fY: 8, phase: Math.PI / 3, amp: 0.35 },
    { fX: 7, fY: 11, phase: 0, amp: 0.25 },
  ],
];

export class LissajousVisualizer {
  static get label() {
    return 'Lissajous';
  }

  static get params() {
    return [
      { key: 'shape', label: 'Shape', min: 1, max: 9, default: 1, step: 1, type: 'stepper' },
      { key: 'speed', label: 'Speed', min: 0.1, max: 3, default: 1, step: 0.1 },
      { key: 'glow', label: 'Glow', min: 0.2, max: 3, default: 1.5, step: 0.1 },
      { key: 'decay', label: 'Decay', min: 0.01, max: 0.15, default: 0.04, step: 0.01 },
      {
        key: 'hue',
        label: 'Hue',
        min: 0,
        max: 365,
        default: 120,
        step: 5,
        formatValue: (v) => (v > 360 ? 'Multi' : String(Math.round(v))),
      },
    ];
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = {};
    LissajousVisualizer.params.forEach((p) => {
      this.values[p.key] = p.default;
    });
    this.startTime = performance.now() / 1000;

    // Smoothed audio
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothEnergy = 0;
    this.peakBass = 0;
  }

  setParam(key, value) {
    this.values[key] = value;
  }

  getPoint(t, time, shapeOscs, audio) {
    let x = 0;
    let y = 0;

    for (let i = 0; i < shapeOscs.length; i++) {
      const o = shapeOscs[i];
      if (o.amp < 0.01) continue;

      // Audio-driven frequency modulation — bass warps the shape
      const fmX = 1 + audio.bass * 1.5 * Math.sin(time * 0.7 + i * 2.1);
      const fmY = 1 + audio.bass * 1.5 * Math.cos(time * 0.5 + i * 1.7);

      // Mid drives rotation speed
      const rotSpeed = 0.08 + audio.mid * 0.6;

      // Treble adds harmonic shimmer
      const trebleDistort = audio.treble * 0.25 * Math.sin(t * (i + 4) * 2);

      // Time-based phase evolution (slow rotation of the shape)
      const phaseEvo = time * rotSpeed * (i + 1);

      x += Math.sin(t * o.fX * fmX + o.phase + phaseEvo) * (o.amp + trebleDistort);
      y += Math.cos(t * o.fY * fmY + phaseEvo * 1.3) * (o.amp + trebleDistort);
    }

    return { x, y };
  }

  getDotPoint(t, time, audio) {
    // Dot mode: audio drives position, silent = still dot at center
    const bassMove = audio.bass * 0.7;
    const midMove = audio.mid * 0.5;
    const trebleSpread = audio.treble * 0.12;

    const x =
      bassMove * Math.sin(time * 1.3) +
      midMove * Math.sin(time * 3.7 + 1.2) +
      trebleSpread * Math.sin(t * 3 + time * 7);
    const y =
      bassMove * Math.cos(time * 0.9 + 0.5) +
      midMove * Math.cos(time * 2.3) +
      trebleSpread * Math.cos(t * 2 + time * 5);

    return { x, y };
  }

  draw(frequencyData, timeDomainData) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const { shape, speed, glow, decay, hue } = this.values;
    const rawTime = performance.now() / 1000 - this.startTime;
    const time = rawTime * speed;

    // Raw audio levels
    let rawBass = 0,
      rawMid = 0,
      rawTreble = 0,
      rawEnergy = 0;
    if (frequencyData) {
      const bins = frequencyData.length;
      for (let i = 0; i < Math.min(15, bins); i++) rawBass += frequencyData[i];
      rawBass /= 15 * 255;
      for (let i = 15; i < Math.min(120, bins); i++) rawMid += frequencyData[i];
      rawMid /= 105 * 255;
      for (let i = 120; i < Math.min(500, bins); i++) rawTreble += frequencyData[i];
      rawTreble /= 380 * 255;
      for (let i = 0; i < bins; i++) rawEnergy += frequencyData[i];
      rawEnergy /= bins * 255;
    }

    // Smooth — fast attack, slow release
    const atk = 0.6,
      rel = 0.12;
    this.smoothBass += (rawBass - this.smoothBass) * (rawBass > this.smoothBass ? atk : rel);
    this.smoothMid += (rawMid - this.smoothMid) * (rawMid > this.smoothMid ? atk : rel);
    this.smoothTreble +=
      (rawTreble - this.smoothTreble) * (rawTreble > this.smoothTreble ? atk : rel);
    this.smoothEnergy +=
      (rawEnergy - this.smoothEnergy) * (rawEnergy > this.smoothEnergy ? atk : rel);
    this.peakBass *= 0.92;
    if (this.smoothBass > this.peakBass) this.peakBass = this.smoothBass;

    const audio = {
      bass: this.smoothBass,
      mid: this.smoothMid,
      treble: this.smoothTreble,
      energy: this.smoothEnergy,
      peak: this.peakBass,
    };

    // Get current shape
    const shapeIdx = Math.round(shape) - 1;
    const clampedIdx = Math.max(0, Math.min(SHAPES.length - 1, shapeIdx));
    const shapeOscs = SHAPES[clampedIdx];
    const isDot = clampedIdx === 0;

    // Phosphor persistence
    ctx.fillStyle = `rgba(0, 0, 0, ${decay})`;
    ctx.fillRect(0, 0, w, h);

    // Dynamic glow
    const dynGlow = glow * (1 + audio.energy * 2);
    const dynAlpha = 0.5 + audio.energy * 0.5;

    const isMultiColor = hue > 360;
    const effectiveHue = isMultiColor ? (time * 40) % 360 : hue;

    const cx = w / 2;
    const cy = h / 2;
    const baseScale = Math.min(w, h) * 0.38;
    const scale = baseScale * (1 + audio.bass * 0.8 + audio.peak * 0.3);

    const pointCount = 1000;

    // Waveform displacement from timeDomainData
    const getDisplacement = (i) => {
      if (!timeDomainData) return { dx: 0, dy: 0 };
      const idx = Math.floor((i / pointCount) * timeDomainData.length);
      const sample = timeDomainData[idx] / 128 - 1;
      const strength = sample * 0.04 * audio.energy * 3;
      return { dx: strength, dy: strength };
    };

    // Precompute raw points
    const rawPoints = [];
    for (let i = 0; i <= pointCount; i++) {
      const t = (i / pointCount) * Math.PI * 2;
      const p = isDot
        ? this.getDotPoint(t, time, audio)
        : this.getPoint(t, time, shapeOscs, audio);
      const d = getDisplacement(i);
      rawPoints.push({ px: p.x, py: p.y, dx: d.dx, dy: d.dy });
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (isMultiColor) {
      const baseHue = (time * 40) % 360;
      const segSize = 50;

      // Glow pass — segments with varying hue
      ctx.lineWidth = 3 + dynGlow * 2 + audio.bass * 4;
      for (let s = 0; s < pointCount; s += segSize) {
        const segHue = (baseHue + (s / pointCount) * 180) % 360;
        ctx.strokeStyle = `hsla(${segHue}, 100%, 50%, ${dynAlpha})`;
        ctx.shadowColor = `hsl(${segHue}, 100%, ${60 + audio.peak * 25}%)`;
        ctx.shadowBlur = dynGlow * 25;

        ctx.beginPath();
        const end = Math.min(s + segSize, pointCount);
        for (let i = s; i <= end; i++) {
          const rp = rawPoints[i];
          const jX = (Math.random() - 0.5) * 0.003 * (1 + audio.treble * 5);
          const jY = (Math.random() - 0.5) * 0.003 * (1 + audio.treble * 5);
          const px = cx + (rp.px + rp.dx + jX) * scale;
          const py = cy + (rp.py + rp.dy + jY) * scale;
          if (i === s) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Core pass — segments with varying hue
      ctx.lineWidth = 1.5 + audio.energy;
      for (let s = 0; s < pointCount; s += segSize) {
        const segHue = (baseHue + (s / pointCount) * 180) % 360;
        ctx.strokeStyle = `hsl(${segHue}, 100%, ${60 + audio.peak * 25}%)`;
        ctx.shadowColor = `hsl(${segHue}, 100%, ${60 + audio.peak * 25}%)`;
        ctx.shadowBlur = dynGlow * 8;

        ctx.beginPath();
        const end = Math.min(s + segSize, pointCount);
        for (let i = s; i <= end; i++) {
          const rp = rawPoints[i];
          const px = cx + (rp.px + rp.dx) * scale;
          const py = cy + (rp.py + rp.dy) * scale;
          if (i === s) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else {
      const coreColor = `hsl(${effectiveHue}, 100%, ${60 + audio.peak * 25}%)`;
      const glowColor = `hsla(${effectiveHue}, 100%, 50%, ${dynAlpha})`;

      // Pass 1: Outer glow
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 3 + dynGlow * 2 + audio.bass * 4;
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = dynGlow * 25;
      ctx.beginPath();

      for (let i = 0; i <= pointCount; i++) {
        const rp = rawPoints[i];
        const jX = (Math.random() - 0.5) * 0.003 * (1 + audio.treble * 5);
        const jY = (Math.random() - 0.5) * 0.003 * (1 + audio.treble * 5);
        const px = cx + (rp.px + rp.dx + jX) * scale;
        const py = cy + (rp.py + rp.dy + jY) * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Pass 2: Core line
      ctx.shadowBlur = dynGlow * 8;
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1.5 + audio.energy;
      ctx.beginPath();
      for (let i = 0; i <= pointCount; i++) {
        const rp = rawPoints[i];
        const px = cx + (rp.px + rp.dx) * scale;
        const py = cy + (rp.py + rp.dy) * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Pass 3: Hot white at high energy (same for both modes)
    if (audio.energy > 0.1) {
      const brightColor = isMultiColor
        ? `hsl(${(time * 40) % 360}, 60%, 92%)`
        : `hsl(${effectiveHue}, 60%, 92%)`;
      ctx.shadowBlur = dynGlow * 4;
      ctx.strokeStyle = brightColor;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = audio.energy * 0.6;
      ctx.beginPath();
      for (let i = 0; i <= pointCount; i++) {
        const rp = rawPoints[i];
        const px = cx + rp.px * scale;
        const py = cy + rp.py * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
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
    this.peakBass = 0;
  }
}
