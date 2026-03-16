export class SpectrumVisualizer {
  static get label() {
    return 'Spectrum';
  }

  static get params() {
    return [
      { key: 'sensitivity', label: 'Sensitivity', min: 0.2, max: 3, default: 1.2, step: 0.1 },
      { key: 'barCount', label: 'Bars', min: 16, max: 128, default: 48, step: 4 },
      { key: 'peakDecay', label: 'Peak Hold', min: 0.002, max: 0.06, default: 0.01, step: 0.002 },
      { key: 'colorShift', label: 'Color', min: 0, max: 360, default: 0, step: 5 },
    ];
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.peaks = [];
    this.smoothBars = [];
    this.values = {};
    SpectrumVisualizer.params.forEach((p) => {
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
    const { sensitivity, barCount, peakDecay, colorShift } = this.values;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    if (!frequencyData) return;

    const bc = Math.round(barCount);
    const gap = 2;
    const barWidth = (w - gap * (bc + 1)) / bc;
    const nyquist = frequencyData.length;

    for (let i = 0; i < bc; i++) {
      // Logarithmic frequency mapping
      const startFreq = Math.floor(Math.pow(nyquist, i / bc));
      const endFreq = Math.floor(Math.pow(nyquist, (i + 1) / bc));

      let sum = 0;
      let count = 0;
      for (let j = startFreq; j < endFreq && j < nyquist; j++) {
        sum += frequencyData[j];
        count++;
      }
      const rawValue = count > 0 ? (sum / count / 255) * sensitivity : 0;

      // Smooth animation
      if (!this.smoothBars[i]) this.smoothBars[i] = 0;
      this.smoothBars[i] += (rawValue - this.smoothBars[i]) * 0.3;
      const value = this.smoothBars[i];

      const barHeight = value * h * 0.9;
      const x = gap + i * (barWidth + gap);

      // Peak indicators
      if (!this.peaks[i] || value > this.peaks[i]) {
        this.peaks[i] = value;
      } else {
        this.peaks[i] = Math.max(0, this.peaks[i] - peakDecay);
      }

      // Color gradient per bar
      const hue = (((i / bc) * 120) + colorShift) % 360;
      const gradient = ctx.createLinearGradient(0, h, 0, h - barHeight);
      gradient.addColorStop(0, `hsl(${hue}, 100%, 35%)`);
      gradient.addColorStop(0.5, `hsl(${(hue + 20) % 360}, 100%, 50%)`);
      gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 100%, 60%)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, h - barHeight, barWidth, barHeight);

      // Subtle reflection
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x, h, barWidth, barHeight * 0.25);
      ctx.restore();

      // Peak dot
      const peakY = h - this.peaks[i] * h * 0.9;
      ctx.fillStyle = `hsl(${hue}, 100%, 80%)`;
      ctx.shadowColor = `hsl(${hue}, 100%, 80%)`;
      ctx.shadowBlur = 8;
      ctx.fillRect(x, peakY - 3, barWidth, 3);
      ctx.shadowBlur = 0;
    }
  }

  reset() {
    this.peaks = [];
    this.smoothBars = [];
    const { ctx, canvas } = this;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
