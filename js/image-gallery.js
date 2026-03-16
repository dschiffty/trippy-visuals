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
