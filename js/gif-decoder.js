/**
 * gif-decoder.js — Lightweight client-side GIF frame decoder.
 *
 * decodeGif(arrayBuffer) → { frames: [{ canvas, delay }], width, height }
 *
 *  • frames   — Array of pre-composited HTMLCanvasElements + per-frame delay (ms).
 *               Each canvas is full GIF dimensions, disposal-method-correct.
 *  • delay    — Milliseconds to show the frame (minimum 20 ms to avoid 0-delay runaway).
 *
 * Supports: GIF87a / GIF89a, interlaced images, local colour tables,
 * transparent colour index, disposal methods 0–3, NETSCAPE loop extension.
 * Single-frame GIFs return frames.length === 1 (treat as static).
 */

export function decodeGif(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  let pos = 0;

  // ── Low-level readers ──────────────────────────────────────────────────────
  const u8  = ()  => data[pos++];
  const u16 = ()  => { const v = data[pos] | (data[pos + 1] << 8); pos += 2; return v; };
  const skip = (n) => { pos += n; };

  // Skip all sub-blocks (length-prefixed lists ending with 0x00)
  const skipSubBlocks = () => {
    let len;
    while ((len = u8()) !== 0) pos += len;
  };

  // Collect all sub-block bytes into a flat Uint8Array
  const readSubBlocks = () => {
    const chunks = [];
    let len;
    while ((len = u8()) !== 0) {
      chunks.push(data.subarray(pos, pos + len));
      pos += len;
    }
    let total = 0;
    chunks.forEach(c => { total += c.length; });
    const out = new Uint8Array(total);
    let off = 0;
    chunks.forEach(c => { out.set(c, off); off += c.length; });
    return out;
  };

  const readColorTable = (size) => {
    const len = 3 * (1 << (size + 1));
    const ct = data.subarray(pos, pos + len);
    pos += len;
    return ct;
  };

  // ── Header + Logical Screen Descriptor ───────────────────────────────────
  if (data[0] !== 0x47 || data[1] !== 0x49 || data[2] !== 0x46) {
    throw new Error('Not a GIF');
  }
  pos = 6; // skip "GIF87a" / "GIF89a"

  const width       = u16();
  const height      = u16();
  const lsdPacked   = u8();
  const bgIndex     = u8();
  skip(1); // pixel aspect ratio

  const gctFlag = (lsdPacked >> 7) & 1;
  const gctSize = lsdPacked & 0x7;
  const globalCT   = gctFlag ? readColorTable(gctSize) : null;

  // ── Compositing state ─────────────────────────────────────────────────────
  // Single compositing canvas — reused for all frames.
  // Snapshots are stored as ImageData (CPU heap) to avoid Chrome dropping
  // off-screen canvas GPU textures under memory pressure.
  const compCanvas = document.createElement('canvas');
  compCanvas.width  = width;
  compCanvas.height = height;
  const compCtx = compCanvas.getContext('2d');
  compCtx.clearRect(0, 0, width, height);

  // Saved ImageData for disposal method 3 (restore to previous)
  let prevImageData = null;

  // ── GCE defaults for each frame ───────────────────────────────────────────
  let gceDelay    = 100;   // ms
  let gceDisposal = 0;
  let gceTransp   = false;
  let gceTransIdx = 0;

  const resetGce = () => {
    gceDelay    = 100;
    gceDisposal = 0;
    gceTransp   = false;
    gceTransIdx = 0;
  };

  const frames = [];

  // ── Main parse loop ───────────────────────────────────────────────────────
  while (pos < data.length) {
    const sentinel = u8();

    if (sentinel === 0x3B) break; // Trailer

    // ── Extension ──────────────────────────────────────────────────────────
    if (sentinel === 0x21) {
      const label = u8();

      if (label === 0xF9) {
        // Graphic Control Extension
        skip(1); // block size always 4
        const flags    = u8();
        gceDisposal    = (flags >> 2) & 0x7;
        gceTransp      = (flags & 0x1) === 1;
        gceDelay       = Math.max(20, u16() * 10); // centiseconds → ms, min 20
        gceTransIdx    = u8();
        skip(1); // block terminator

      } else if (label === 0xFF) {
        // Application Extension (check for NETSCAPE loop count)
        skip(1); // block size = 11
        skip(11); // application identifier + auth code
        // We don't need the loop count — we always loop in our player
        skipSubBlocks();

      } else {
        skipSubBlocks(); // unknown extension
      }

      continue;
    }

    // ── Image Descriptor ───────────────────────────────────────────────────
    if (sentinel === 0x2C) {
      const imgLeft   = u16();
      const imgTop    = u16();
      const imgW      = u16();
      const imgH      = u16();
      const imgPacked = u8();

      const lctFlag   = (imgPacked >> 7) & 1;
      const interlace = (imgPacked >> 6) & 1;
      const lctSize   = imgPacked & 0x7;

      const ct = lctFlag ? readColorTable(lctSize) : globalCT;

      const minCodeSize = u8();
      const compressed  = readSubBlocks();

      const pixels = lzwDecode(minCodeSize, compressed, imgW * imgH);

      const indexed = interlace
        ? deinterlace(pixels, imgW, imgH)
        : pixels;

      // ── Save state before compositing (disposal 3) ──────────────────────
      if (gceDisposal === 3) {
        prevImageData = compCtx.getImageData(0, 0, width, height);
      }

      // ── Build this frame's pixels onto a temp canvas ─────────────────────
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width  = imgW;
      tmpCanvas.height = imgH;
      const tmpCtx = tmpCanvas.getContext('2d');
      const id = tmpCtx.createImageData(imgW, imgH);
      const d  = id.data;

      const pixCount = imgW * imgH;
      if (ct) {
        for (let i = 0; i < pixCount; i++) {
          const ci = indexed[i] ?? 0;
          if (gceTransp && ci === gceTransIdx) {
            // Transparent — alpha 0, leave composite underneath showing
            d[i * 4 + 3] = 0;
          } else {
            const p = ci * 3;
            d[i * 4]     = ct[p];
            d[i * 4 + 1] = ct[p + 1];
            d[i * 4 + 2] = ct[p + 2];
            d[i * 4 + 3] = 255;
          }
        }
      }
      tmpCtx.putImageData(id, 0, 0);

      // ── Blit onto composite ───────────────────────────────────────────────
      compCtx.drawImage(tmpCanvas, imgLeft, imgTop);

      // ── Snapshot the composited frame as ImageData (CPU heap) ────────────
      // Storing as ImageData rather than a canvas element avoids Chrome
      // silently dropping the GPU texture backing of off-screen canvases,
      // which would cause drawImage() to produce empty pixels.
      const snapData = compCtx.getImageData(0, 0, width, height);

      frames.push({ imageData: snapData, width, height, delay: gceDelay });

      // ── Apply disposal for next frame ────────────────────────────────────
      if (gceDisposal === 2) {
        // Restore to background
        compCtx.clearRect(imgLeft, imgTop, imgW, imgH);
        if (globalCT && bgIndex < globalCT.length / 3) {
          const p = bgIndex * 3;
          compCtx.fillStyle = `rgb(${globalCT[p]},${globalCT[p+1]},${globalCT[p+2]})`;
          compCtx.fillRect(imgLeft, imgTop, imgW, imgH);
        }
      } else if (gceDisposal === 3 && prevImageData) {
        // Restore to previous state
        compCtx.putImageData(prevImageData, 0, 0);
      }
      // disposal 0/1: leave composite as-is

      resetGce();
      continue;
    }

    // Unknown sentinel — stop parsing
    break;
  }

  return { frames, width, height };
}

// ── LZW Decompressor ─────────────────────────────────────────────────────────
// Standard stack-unwinding GIF LZW decoder.
// Returns Uint8Array of colour indices (length = pixelCount or close to it).

function lzwDecode(minCodeSize, compressed, pixelCount) {
  const CLEAR = 1 << minCodeSize;
  const EOI   = CLEAR + 1;
  const MAX   = 4096;

  // Parallel arrays for the code table (linked list of pixel chains)
  const pfx = new Int16Array(MAX);   // prefix (parent code), -1 for roots
  const sfx = new Uint8Array(MAX);   // suffix (terminal pixel)
  const stk = new Uint8Array(MAX);   // decode stack for chain unwinding

  // Initialise table: colour codes are their own single-pixel entries
  pfx.fill(-1);
  for (let i = 0; i < CLEAR; i++) sfx[i] = i;

  // Output buffer — pre-size to known pixel count or generous estimate
  const out    = new Uint8Array(pixelCount > 0 ? pixelCount + 16 : 1048576);
  let   outPos = 0;

  // ── Bit-stream reader ─────────────────────────────────────────────────────
  let buf = 0, bufLen = 0, bytePos = 0;
  let codeLen  = minCodeSize + 1;
  let codeMask = (1 << codeLen) - 1;
  let tableEnd = EOI + 1; // next free slot

  const readCode = () => {
    while (bufLen < codeLen) {
      buf |= (compressed[bytePos++] || 0) << bufLen;
      bufLen += 8;
    }
    const c = buf & codeMask;
    buf    >>>= codeLen;
    bufLen  -= codeLen;
    return c;
  };

  // ── Decode loop ───────────────────────────────────────────────────────────
  let prevCode = -1;
  let firstPx  = 0;

  // First real code (skip leading CLEAR if present)
  let code = readCode();
  if (code === CLEAR) {
    codeLen  = minCodeSize + 1;
    codeMask = (1 << codeLen) - 1;
    tableEnd = EOI + 1;
    prevCode = -1;
    code     = readCode();
  }
  if (code === EOI || bytePos > compressed.length + 4) return out.subarray(0, outPos);

  // Bootstrap: emit first code directly
  out[outPos++] = sfx[code];
  firstPx  = sfx[code];
  prevCode = code;

  while (true) {
    code = readCode();
    if (code === EOI) break;
    if (bytePos > compressed.length + 4) break; // safety

    if (code === CLEAR) {
      codeLen  = minCodeSize + 1;
      codeMask = (1 << codeLen) - 1;
      tableEnd = EOI + 1;
      prevCode = -1;

      code = readCode();
      if (code === EOI) break;
      out[outPos++] = sfx[code];
      firstPx  = sfx[code];
      prevCode = code;
      continue;
    }

    const inCode = code;
    let sp = 0;

    // KwKwK case: code not yet in table
    if (code >= tableEnd) {
      stk[sp++] = firstPx;
      code = prevCode;
    }

    // Unwind the chain into the decode stack
    while (code > EOI) {
      stk[sp++] = sfx[code];
      code = pfx[code];
    }
    stk[sp] = sfx[code];
    firstPx = sfx[code];

    // Emit stack in reverse (root pixel first)
    for (let i = sp; i >= 0; i--) {
      if (outPos < out.length) out[outPos++] = stk[i];
    }

    // Add new entry to code table
    if (tableEnd < MAX) {
      pfx[tableEnd] = prevCode;
      sfx[tableEnd] = firstPx;
      tableEnd++;
      // Grow code length when table fills the current bit width
      if (tableEnd > codeMask + 1 && codeLen < 12) {
        codeLen++;
        codeMask = (1 << codeLen) - 1;
      }
    }

    prevCode = inCode;
  }

  return out.subarray(0, outPos);
}

// ── GIF Deinterlacing ─────────────────────────────────────────────────────────
// GIF interlacing stores rows in four passes: 0,8,16…  4,12,20…  2,6,10…  1,3,5…
// Reorder them back into top-to-bottom scanline order.

function deinterlace(src, width, height) {
  const dst = new Uint8Array(width * height);
  const passes = [
    { start: 0, step: 8 },
    { start: 4, step: 8 },
    { start: 2, step: 4 },
    { start: 1, step: 2 },
  ];
  let srcRow = 0;
  for (const { start, step } of passes) {
    for (let row = start; row < height; row += step) {
      dst.set(src.subarray(srcRow * width, (srcRow + 1) * width), row * width);
      srcRow++;
    }
  }
  return dst;
}
