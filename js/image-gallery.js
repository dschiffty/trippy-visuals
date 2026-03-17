/* ============================================
   Image Gallery — Procedural texture library
   ============================================ */

// Generate procedural textures at runtime as gallery images
// Each generator creates a 256x256 canvas and returns an Image

function generateGradient(colors, angle = 0) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const rad = angle * Math.PI / 180;
  const x1 = size/2 - Math.cos(rad) * size/2;
  const y1 = size/2 - Math.sin(rad) * size/2;
  const x2 = size/2 + Math.cos(rad) * size/2;
  const y2 = size/2 + Math.sin(rad) * size/2;
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  colors.forEach((col, i) => grad.addColorStop(i / (colors.length - 1), col));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function generateRadial(innerColor, outerColor) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function generateCheckerboard(color1, color2, gridSize = 32) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  for (let y = 0; y < size; y += gridSize) {
    for (let x = 0; x < size; x += gridSize) {
      ctx.fillStyle = ((x + y) / gridSize) % 2 === 0 ? color1 : color2;
      ctx.fillRect(x, y, gridSize, gridSize);
    }
  }
  return c;
}

function generateStripes(colors, width = 16, angle = 0) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size/2, size/2);
  ctx.rotate(angle * Math.PI / 180);
  ctx.translate(-size, -size);
  for (let i = 0; i < size * 4; i += width * colors.length) {
    colors.forEach((col, ci) => {
      ctx.fillStyle = col;
      ctx.fillRect(i + ci * width, 0, width, size * 4);
    });
  }
  ctx.restore();
  return c;
}

function generateCircles(bgColor, circleColors) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 10 + Math.random() * 40;
    const col = circleColors[Math.floor(Math.random() * circleColors.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.3 + Math.random() * 0.5;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

function generateNoise(baseColor, noiseAmount = 80) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseAmount;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
  return c;
}

function generatePlasma() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const seed = Math.random() * 100;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v1 = Math.sin(x / 16 + seed);
      const v2 = Math.sin(y / 16 + seed * 1.3);
      const v3 = Math.sin((x + y) / 16 + seed * 0.7);
      const v4 = Math.sin(Math.sqrt(((x - 128) ** 2 + (y - 128) ** 2)) / 12 + seed * 0.5);
      const v = (v1 + v2 + v3 + v4) / 4;
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((Math.sin(v * Math.PI) * 0.5 + 0.5) * 255);
      data[idx+1] = Math.round((Math.cos(v * Math.PI * 1.5) * 0.5 + 0.5) * 255);
      data[idx+2] = Math.round((Math.sin(v * Math.PI * 2 + 2) * 0.5 + 0.5) * 255);
      data[idx+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return c;
}

function generateSpiral(colors) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  for (let a = 0; a < Math.PI * 12; a += 0.02) {
    const r = a * 4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (x < 0 || x > size || y < 0 || y > size) continue;
    const col = colors[Math.floor(a / Math.PI * 2) % colors.length];
    ctx.beginPath();
    ctx.arc(x, y, 2 + a * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.7;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

function generateDiamondPattern(color1, color2) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, size, size);
  const dSize = 32;
  ctx.fillStyle = color2;
  for (let y = -dSize; y < size + dSize; y += dSize) {
    for (let x = -dSize; x < size + dSize; x += dSize * 2) {
      const offsetX = ((y / dSize) % 2) * dSize;
      ctx.save();
      ctx.translate(x + offsetX + dSize/2, y + dSize/2);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-dSize/3, -dSize/3, dSize*2/3, dSize*2/3);
      ctx.restore();
    }
  }
  return c;
}

function generateWaves(colors, frequency = 8) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, size, size);
  const bandH = size / colors.length;
  for (let ci = 1; ci < colors.length; ci++) {
    ctx.beginPath();
    ctx.moveTo(0, size);
    for (let x = 0; x <= size; x++) {
      const y = ci * bandH + Math.sin(x / size * Math.PI * frequency + ci * 0.8) * (bandH * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(size, size);
    ctx.closePath();
    ctx.fillStyle = colors[ci];
    ctx.globalAlpha = 0.7;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

function generateMosaic(colors, tileSize = 16) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }
  return c;
}

function generateConcentricRings(colors) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  const maxR = size * 0.7;
  const rings = 12;
  for (let i = rings; i >= 0; i--) {
    const r = (i / rings) * maxR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
  }
  return c;
}

function generateFractalNoise(hue) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const seed = Math.random() * 1000;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let val = 0, amp = 1, freq = 0.02;
      for (let o = 0; o < 5; o++) {
        val += Math.sin(x * freq + seed + o * 3.7) * Math.cos(y * freq + seed * 1.3 + o * 2.1) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      val = (val + 1) * 0.5;
      const h = hue / 360;
      const s = 0.7 + val * 0.3;
      const l = 0.15 + val * 0.5;
      const [r, g, b] = hslToRgbGallery(h, s, l);
      const idx = (y * size + x) * 4;
      data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return c;
}

function generateStarburst(colors, rays = 16) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  const angleStep = (Math.PI * 2) / rays;
  for (let i = 0; i < rays; i++) {
    const a1 = i * angleStep;
    const a2 = (i + 0.5) * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a1) * size, cy + Math.sin(a1) * size);
    ctx.lineTo(cx + Math.cos(a2) * size, cy + Math.sin(a2) * size);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.8;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

function generateHexGrid(color1, color2, hexSize = 20) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = color2;
  ctx.lineWidth = 1.5;
  const h = hexSize * Math.sqrt(3);
  for (let row = -1; row < size / h + 1; row++) {
    for (let col = -1; col < size / (hexSize * 1.5) + 1; col++) {
      const cx2 = col * hexSize * 1.5;
      const cy2 = row * h + (col % 2 ? h / 2 : 0);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i + Math.PI / 6;
        const hx = cx2 + hexSize * Math.cos(angle);
        const hy = cy2 + hexSize * Math.sin(angle);
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  return c;
}

function generateTieDye(colors) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    for (let r = 0; r < size / 2; r += 3) {
      const wobble = Math.sin(a * 6 + r * 0.05) * 15;
      const x = cx + Math.cos(a) * (r + wobble);
      const y = cy + Math.sin(a) * (r + wobble);
      const cIdx = Math.floor((a / (Math.PI * 2) * colors.length + r * 0.02)) % colors.length;
      ctx.fillStyle = colors[cIdx];
      ctx.globalAlpha = 0.15;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
  return c;
}

function generateLightning(color, branches = 5) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0014';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  for (let b = 0; b < branches; b++) {
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * size, y = 0;
    ctx.moveTo(x, y);
    while (y < size) {
      x += (Math.random() - 0.5) * 30;
      y += 5 + Math.random() * 15;
      ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  return c;
}

function generateCrosshatch(bgColor, lineColor) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  const gap = 8;
  for (let i = -size; i < size * 2; i += gap) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + size, 0); ctx.lineTo(i, size); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}

// HSL to RGB helper for gallery generators
function hslToRgbGallery(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// --- Gallery Definition ---
export const GALLERY_IMAGES = [
  { name: 'Sunset',       generate: () => generateGradient(['#ff6b35', '#f7c948', '#ff2e63', '#8b1a4a'], 135) },
  { name: 'Ocean',        generate: () => generateGradient(['#0077b6', '#00b4d8', '#90e0ef', '#023e8a'], 180) },
  { name: 'Aurora',       generate: () => generateGradient(['#0d1b2a', '#1b4332', '#40916c', '#95d5b2', '#d8f3dc'], 90) },
  { name: 'Neon',         generate: () => generateGradient(['#ff00ff', '#00ffff', '#ff00ff'], 45) },
  { name: 'Fire',         generate: () => generateGradient(['#1a0000', '#cc3300', '#ff6600', '#ffcc00', '#ffffff'], 90) },
  { name: 'Forest',       generate: () => generateRadial('#2d6a4f', '#081c15') },
  { name: 'Vortex',       generate: () => generateRadial('#ffffff', '#1a1a2e') },
  { name: 'Nebula',       generate: () => generateRadial('#e040fb', '#0d0221') },
  { name: 'Checkers',     generate: () => generateCheckerboard('#ffffff', '#000000', 32) },
  { name: 'Retro Grid',   generate: () => generateCheckerboard('#ff6ec7', '#7b2d8e', 16) },
  { name: 'Candy',        generate: () => generateStripes(['#ff69b4', '#ffffff', '#87ceeb'], 20, 45) },
  { name: 'Barber',       generate: () => generateStripes(['#cc0000', '#ffffff', '#0044aa'], 12, -30) },
  { name: 'Zebra',        generate: () => generateStripes(['#111', '#eee'], 16, 0) },
  { name: 'Bubbles',      generate: () => generateCircles('#0a0a2e', ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff']) },
  { name: 'Cells',        generate: () => generateCircles('#1a1a1a', ['#00ff41', '#00cc33', '#009926']) },
  { name: 'Static',       generate: () => generateNoise('#808080', 120) },
  { name: 'Warm Noise',   generate: () => generateNoise('#cc6633', 60) },
  { name: 'Plasma',       generate: () => generatePlasma() },
  { name: 'Spiral',       generate: () => generateSpiral(['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff']) },
  { name: 'Diamonds',     generate: () => generateDiamondPattern('#1a1a2e', '#e94560') },
  { name: 'Waves',        generate: () => generateWaves(['#0a0033', '#3a0ca3', '#7209b7', '#f72585', '#ff8fa3'], 6) },
  { name: 'Tide',         generate: () => generateWaves(['#023e8a', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'], 4) },
  { name: 'Mosaic',       generate: () => generateMosaic(['#ff006e', '#fb5607', '#ffbe0b', '#3a86ff', '#8338ec'], 12) },
  { name: 'Pixel',        generate: () => generateMosaic(['#222', '#444', '#666', '#888', '#aaa'], 8) },
  { name: 'Rings',        generate: () => generateConcentricRings(['#ff0055', '#ff8800', '#ffee00', '#00ff88', '#0088ff', '#8800ff']) },
  { name: 'Target',       generate: () => generateConcentricRings(['#ffffff', '#cc0000']) },
  { name: 'Fractal Blue', generate: () => generateFractalNoise(220) },
  { name: 'Fractal Rose', generate: () => generateFractalNoise(330) },
  { name: 'Fractal Jade', generate: () => generateFractalNoise(160) },
  { name: 'Starburst',    generate: () => generateStarburst(['#ff0044', '#ff8800', '#ffcc00', '#00ff66', '#0088ff', '#cc00ff'], 12) },
  { name: 'Pinwheel',     generate: () => generateStarburst(['#000', '#fff'], 24) },
  { name: 'Hex Grid',     generate: () => generateHexGrid('#0a0a2e', '#00ff41', 18) },
  { name: 'Honeycomb',    generate: () => generateHexGrid('#1a1200', '#ffaa00', 14) },
  { name: 'Tie Dye',      generate: () => generateTieDye(['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff']) },
  { name: 'Lightning',    generate: () => generateLightning('#88ccff', 6) },
  { name: 'Violet Storm', generate: () => generateLightning('#cc66ff', 4) },
  { name: 'Crosshatch',   generate: () => generateCrosshatch('#1a1a2e', '#4cc9f0') },
  { name: 'Sketch',       generate: () => generateCrosshatch('#f5f0e8', '#2a2a2a') },
  { name: 'Deep Space',   generate: () => generateRadial('#000022', '#000000') },
  { name: 'Lava',         generate: () => generateGradient(['#000000', '#330000', '#cc3300', '#ff6600', '#ffcc00'], 90) },
  { name: 'Ice',          generate: () => generateGradient(['#e0f7fa', '#80deea', '#00bcd4', '#006064', '#001a1a'], 135) },
  { name: 'Infrared',     generate: () => generateGradient(['#000', '#220033', '#880044', '#ff0066', '#ff6699', '#ffffff'], 45) },
  { name: 'Pastel',       generate: () => generateMosaic(['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff'], 20) },
];

// Cache generated images
const _imageCache = new Map();

export function getGalleryImage(index) {
  if (_imageCache.has(index)) return _imageCache.get(index);
  const entry = GALLERY_IMAGES[index];
  if (!entry) return null;
  const canvas = entry.generate();
  const img = new Image();
  img.src = canvas.toDataURL();
  _imageCache.set(index, img);
  return img;
}

export function getGalleryThumbnail(index) {
  const entry = GALLERY_IMAGES[index];
  if (!entry) return null;
  const canvas = entry.generate();
  // Scale down to 48x48 thumbnail
  const thumb = document.createElement('canvas');
  thumb.width = 48; thumb.height = 48;
  const ctx = thumb.getContext('2d');
  ctx.drawImage(canvas, 0, 0, 48, 48);
  return thumb.toDataURL();
}
