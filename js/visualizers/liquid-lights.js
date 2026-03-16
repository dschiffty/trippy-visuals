export class LiquidLightsVisualizer {
  static get label() {
    return 'Orbs';
  }

  static get params() {
    return [
      { key: 'reactivity', label: 'Reactivity', min: 0, max: 2.5, default: 1, step: 0.1 },
      { key: 'speed', label: 'Speed', min: 0.1, max: 3, default: 0.7, step: 0.1 },
      { key: 'colorSpeed', label: 'Color Spd', min: 0, max: 40, default: 8, step: 1 },
      { key: 'intensity', label: 'Intensity', min: 0.3, max: 1.5, default: 0.9, step: 0.05 },
    ];
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = {};
    LiquidLightsVisualizer.params.forEach((p) => {
      this.values[p.key] = p.default;
    });

    // Blob configurations with irrational-ish frequency ratios for organic motion
    this.blobs = [
      { baseHue: 0, freqX: 0.23, freqY: 0.31, phaseX: 0, phaseY: 0, size: 0.32 },
      { baseHue: 280, freqX: 0.17, freqY: 0.29, phaseX: 1.2, phaseY: 0.8, size: 0.28 },
      { baseHue: 200, freqX: 0.29, freqY: 0.19, phaseX: 2.1, phaseY: 1.5, size: 0.35 },
      { baseHue: 35, freqX: 0.31, freqY: 0.23, phaseX: 0.5, phaseY: 2.3, size: 0.26 },
      { baseHue: 320, freqX: 0.19, freqY: 0.37, phaseX: 1.8, phaseY: 0.3, size: 0.30 },
      { baseHue: 160, freqX: 0.37, freqY: 0.13, phaseX: 0.7, phaseY: 1.9, size: 0.29 },
    ];

    this.startTime = performance.now() / 1000;
  }

  setParam(key, value) {
    this.values[key] = value;
  }

  draw(frequencyData, timeDomainData) {
    const { ctx, canvas, blobs } = this;
    const w = canvas.width;
    const h = canvas.height;
    const { reactivity, speed, colorSpeed, intensity } = this.values;
    const time = (performance.now() / 1000 - this.startTime) * speed;

    // Compute audio energy in bands
    let bass = 0;
    let mid = 0;
    let treble = 0;
    if (frequencyData) {
      const bins = frequencyData.length;
      for (let i = 0; i < Math.min(12, bins); i++) bass += frequencyData[i];
      bass /= 12 * 255;
      for (let i = 12; i < Math.min(120, bins); i++) mid += frequencyData[i];
      mid /= 108 * 255;
      for (let i = 120; i < Math.min(500, bins); i++) treble += frequencyData[i];
      treble /= 380 * 255;
    }

    // Slow fade for trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, w, h);

    // Additive blending
    ctx.globalCompositeOperation = 'screen';

    const dim = Math.min(w, h);

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];

      // Organic movement via sine waves
      const x = w * 0.5 + Math.sin(time * blob.freqX + blob.phaseX) * w * 0.35;
      const y = h * 0.5 + Math.sin(time * blob.freqY + blob.phaseY) * h * 0.3;

      // Audio modulation — different bands for different blobs
      const band = i % 3 === 0 ? bass : i % 3 === 1 ? mid : treble;
      const radius = dim * blob.size * (1 + band * reactivity * 2.5) * intensity;

      // Hue shifts over time
      const hue = (blob.baseHue + time * colorSpeed) % 360;

      // Radial gradient blob
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `hsla(${hue}, 100%, 55%, 0.7)`);
      gradient.addColorStop(0.25, `hsla(${(hue + 15) % 360}, 95%, 48%, 0.55)`);
      gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 85%, 38%, 0.3)`);
      gradient.addColorStop(0.75, `hsla(${(hue + 50) % 360}, 75%, 25%, 0.12)`);
      gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  reset() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.startTime = performance.now() / 1000;
  }
}
