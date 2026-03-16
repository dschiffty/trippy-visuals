function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const BLOB_COUNT = 7;

export class LiquidMetalVisualizer {
  static get label() {
    return 'Lava Lamp';
  }

  static get params() {
    return [
      { key: 'speed', label: 'Speed', min: 0.1, max: 3, default: 0.5, step: 0.1 },
      { key: 'reactivity', label: 'React', min: 0, max: 2.5, default: 1, step: 0.1 },
      { key: 'hue', label: 'Hue', min: 0, max: 360, default: 15, step: 5 },
    ];
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = {};
    LiquidMetalVisualizer.params.forEach((p) => {
      this.values[p.key] = p.default;
    });
    this.startTime = performance.now() / 1000;

    this.bufferCanvas = document.createElement('canvas');
    this.bufferCtx = this.bufferCanvas.getContext('2d');

    this.blobs = this.createBlobs();

    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothEnergy = 0;
  }

  createBlobs() {
    const blobs = [];
    for (let i = 0; i < BLOB_COUNT; i++) {
      // Random initial direction
      const angle = Math.random() * Math.PI * 2;
      const v = 0.0003 + Math.random() * 0.0003;
      blobs.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        baseRadius: 0.07 + Math.random() * 0.04,
        band: i % 3,
      });
    }
    return blobs;
  }

  setParam(key, value) {
    this.values[key] = value;
  }

  computeAudio(frequencyData) {
    let bass = 0,
      mid = 0,
      treble = 0;
    if (frequencyData) {
      const bins = frequencyData.length;
      for (let i = 0; i < Math.min(12, bins); i++) bass += frequencyData[i];
      bass /= 12 * 255;
      for (let i = 12; i < Math.min(120, bins); i++) mid += frequencyData[i];
      mid /= 108 * 255;
      for (let i = 120; i < Math.min(500, bins); i++) treble += frequencyData[i];
      treble /= 380 * 255;
    }

    const atk = 0.5,
      rel = 0.1;
    this.smoothBass += (bass - this.smoothBass) * (bass > this.smoothBass ? atk : rel);
    this.smoothMid += (mid - this.smoothMid) * (mid > this.smoothMid ? atk : rel);
    this.smoothTreble +=
      (treble - this.smoothTreble) * (treble > this.smoothTreble ? atk : rel);
    this.smoothEnergy = (this.smoothBass + this.smoothMid + this.smoothTreble) / 3;

    return {
      bass: this.smoothBass,
      mid: this.smoothMid,
      treble: this.smoothTreble,
      energy: this.smoothEnergy,
    };
  }

  updateBlobs(time, speed, reactivity, audio) {
    const bands = [audio.bass, audio.mid, audio.treble];
    const count = this.blobs.length;

    for (let i = 0; i < count; i++) {
      const blob = this.blobs[i];
      const bandEnergy = bands[blob.band];

      // Audio nudges — gentle pushes from music
      const audioKickX =
        Math.sin(time * 2.1 + i * 3.7) * bandEnergy * reactivity * 0.00008;
      const audioKickY =
        Math.cos(time * 1.7 + i * 2.3) * bandEnergy * reactivity * 0.00008;

      blob.vx += audioKickX;
      blob.vy += audioKickY;

      // Very slight gravity
      blob.vy += 0.000008 * speed;

      // Damping — thick viscous fluid
      blob.vx *= 0.995;
      blob.vy *= 0.995;

      // Speed limit
      const maxV = 0.002 * speed;
      const v = Math.sqrt(blob.vx * blob.vx + blob.vy * blob.vy);
      if (v > maxV) {
        blob.vx = (blob.vx / v) * maxV;
        blob.vy = (blob.vy / v) * maxV;
      }

      // Update position
      blob.x += blob.vx * speed;
      blob.y += blob.vy * speed;

      // Bounce off edges
      const margin = 0.08;
      if (blob.x < margin) {
        blob.x = margin;
        blob.vx = Math.abs(blob.vx) * 0.7;
      } else if (blob.x > 1 - margin) {
        blob.x = 1 - margin;
        blob.vx = -Math.abs(blob.vx) * 0.7;
      }
      if (blob.y < margin) {
        blob.y = margin;
        blob.vy = Math.abs(blob.vy) * 0.7;
      } else if (blob.y > 1 - margin) {
        blob.y = 1 - margin;
        blob.vy = -Math.abs(blob.vy) * 0.7;
      }
    }
  }

  renderMetaballs(bw, bh, canvasW, canvasH, scale, baseHue, audio) {
    const imageData = this.bufferCtx.createImageData(bw, bh);
    const data = imageData.data;
    const bands = [audio.bass, audio.mid, audio.treble];
    const dim = Math.min(canvasW, canvasH);
    const { reactivity } = this.values;
    const count = this.blobs.length;

    // Precompute blob positions and radii in buffer space
    const blobs = [];
    for (let i = 0; i < count; i++) {
      const b = this.blobs[i];
      const bandEnergy = bands[b.band];
      const radius = dim * b.baseRadius * (1 + bandEnergy * reactivity * 1.5);
      blobs.push({
        bx: (b.x * canvasW) / scale,
        by: (b.y * canvasH) / scale,
        r2: (radius / scale) ** 2,
      });
    }

    const threshold = 1.0;
    const blobCount = blobs.length;
    const hNorm = baseHue / 360;

    // Background color
    const [bgR, bgG, bgB] = hslToRgb(hNorm, 0.2, 0.04);

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        let field = 0;

        for (let i = 0; i < blobCount; i++) {
          const b = blobs[i];
          const dx = px - b.bx;
          const dy = py - b.by;
          const dist2 = dx * dx + dy * dy + 1;
          field += b.r2 / dist2;
        }

        const idx = (py * bw + px) * 4;

        if (field > threshold) {
          const depth = Math.min((field - threshold) / 2.0, 1.0);

          const lightness = 0.18 + depth * 0.52;
          const saturation = 0.85 - depth * 0.25;

          const hShift = depth * 0.04;
          const h = (hNorm + hShift) % 1;

          const [r, g, b] = hslToRgb(h, saturation, lightness);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else if (field > threshold * 0.65) {
          const glowStrength = (field - threshold * 0.65) / (threshold * 0.35);
          const glow = glowStrength * glowStrength * 0.08;
          const [r, g, b] = hslToRgb(hNorm, 0.7, glow + 0.04);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else {
          data[idx] = bgR;
          data[idx + 1] = bgG;
          data[idx + 2] = bgB;
          data[idx + 3] = 255;
        }
      }
    }

    this.bufferCtx.putImageData(imageData, 0, 0);
  }

  postProcess(ctx, w, h, audio) {
    // Warm bloom glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12 + audio.energy * 0.15;
    ctx.filter = 'blur(16px)';
    ctx.drawImage(this.canvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Second softer bloom pass
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.06 + audio.energy * 0.06;
    ctx.filter = 'blur(32px)';
    ctx.drawImage(this.canvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Vignette
    const gradient = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.3,
      w / 2,
      h / 2,
      Math.min(w, h) * 0.75,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  draw(frequencyData, timeDomainData) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const { speed, hue } = this.values;
    const time = performance.now() / 1000 - this.startTime;
    const audio = this.computeAudio(frequencyData);

    // Update blob physics
    this.updateBlobs(time, speed, this.values.reactivity, audio);

    // 1/3 resolution buffer
    const scale = 3;
    const bw = Math.ceil(w / scale);
    const bh = Math.ceil(h / scale);
    this.bufferCanvas.width = bw;
    this.bufferCanvas.height = bh;

    this.renderMetaballs(bw, bh, w, h, scale, hue, audio);

    // Smooth upscale
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.bufferCanvas, 0, 0, w, h);

    this.postProcess(ctx, w, h, audio);
  }

  reset() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.startTime = performance.now() / 1000;
    this.blobs = this.createBlobs();
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothEnergy = 0;
  }
}
