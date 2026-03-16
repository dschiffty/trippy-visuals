export class OscilloscopeVisualizer {
  static get label() {
    return 'Oscilloscope';
  }

  static get params() {
    return [
      { key: 'gain', label: 'Gain', min: 0.1, max: 5, default: 1.5, step: 0.1 },
      { key: 'sweep', label: 'Sweep', min: 0.2, max: 4, default: 1, step: 0.1 },
      { key: 'decay', label: 'Decay', min: 0, max: 0.95, default: 0.4, step: 0.05 },
      { key: 'glow', label: 'Glow', min: 0, max: 3, default: 1.5, step: 0.1 },
      { key: 'grid', label: 'Grid', min: 0, max: 1, default: 0.3, step: 0.05 },
      { key: 'crt', label: 'CRT', min: 0, max: 1, default: 0, step: 0.05 },
    ];
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = {};
    OscilloscopeVisualizer.params.forEach((p) => {
      this.values[p.key] = p.default;
    });
  }

  setParam(key, value) {
    this.values[key] = value;
  }

  draw(frequencyData, timeDomainData) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const { gain, sweep, decay, glow, grid, crt } = this.values;

    // Phosphor persistence — fade previous frame
    ctx.fillStyle = `rgba(5, 10, 5, ${1 - decay})`;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    if (grid > 0.01) {
      this.drawGrid(grid);
    }

    if (!timeDomainData) return;

    // Main waveform trace
    const color = '#00ff41';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow * 20;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    // Clamp sweep so we never have more samples than pixels (waveform always fills window)
    const effectiveSweep = Math.max(sweep, timeDomainData.length / w);
    const samples = Math.floor(timeDomainData.length / effectiveSweep);
    const step = w / samples;

    for (let i = 0; i < samples; i++) {
      const value = (timeDomainData[i] / 128 - 1) * gain;
      const x = i * step;
      const y = h / 2 - (value * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Brighter core pass
    ctx.shadowBlur = glow * 6;
    ctx.strokeStyle = 'rgba(150, 255, 180, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const value = (timeDomainData[i] / 128 - 1) * gain;
      const x = i * step;
      const y = h / 2 - (value * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.shadowBlur = 0;

    // CRT filter
    if (crt > 0.01) {
      this.drawCRT(crt);
    }
  }

  drawGrid(intensity) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Minor grid — opacity scales with intensity
    const minorAlpha = 0.06 * intensity;
    ctx.strokeStyle = `rgba(0, 255, 65, ${minorAlpha})`;
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 10, 0);
      ctx.lineTo((w * i) / 10, h);
      ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (h * i) / 8);
      ctx.lineTo(w, (h * i) / 8);
      ctx.stroke();
    }

    // Center crosshair (brighter)
    const crossAlpha = 0.14 * intensity;
    ctx.strokeStyle = `rgba(0, 255, 65, ${crossAlpha})`;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  drawCRT(intensity) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Scanlines
    const scanAlpha = 0.12 * intensity;
    ctx.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // Film grain noise
    const grainStrength = intensity * 25;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    // Sparse grain — only process every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const noise = (Math.random() - 0.5) * grainStrength;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // Vignette — darker edges
    const vignetteAlpha = 0.4 * intensity;
    const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.min(w, h) * 0.8);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${vignetteAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Subtle screen curvature highlight
    const shineAlpha = 0.03 * intensity;
    const shine = ctx.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.5, h * 0.5, Math.min(w, h) * 0.6);
    shine.addColorStop(0, `rgba(255, 255, 255, ${shineAlpha})`);
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, w, h);
  }

  reset() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#050a05';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
