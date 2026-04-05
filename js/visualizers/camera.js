/* ============================================
   Camera Mode — Mobile AR Visualizer
   Renders live camera feed as background with
   Liquid Lite effects composited on top.
   iPhone Camera app inspired UI.
   ============================================ */

import { LiquidShowVisualizer } from './liquid-show.js';
import { LL_PRESETS } from './ll-presets.js';
import { CameraWarpGPU, WARP_MODES, WARP_LABELS } from './camera-warp-gpu.js';

/**
 * Reusable camera feed manager.
 * Handles getUserMedia, front/rear toggle, lens switching.
 */
export class CameraFeed {
  constructor() {
    this._stream = null;
    this._video = document.createElement('video');
    this._video.setAttribute('playsinline', '');
    this._video.setAttribute('autoplay', '');
    this._video.muted = true;
    this._facingMode = 'environment';
    this._active = false;
    this._currentDeviceId = null;
    this._availableLenses = []; // { deviceId, label, shortLabel }
  }

  get active() { return this._active; }
  get facingMode() { return this._facingMode; }
  get video() { return this._video; }
  get availableLenses() { return this._availableLenses; }
  get currentDeviceId() { return this._currentDeviceId; }

  async start(facingMode, deviceId) {
    if (facingMode) this._facingMode = facingMode;
    await this.stop();
    try {
      const constraints = { audio: false, video: {} };
      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      } else {
        constraints.video.facingMode = this._facingMode;
      }
      constraints.video.width = { ideal: 1920 };
      constraints.video.height = { ideal: 1080 };

      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._video.srcObject = this._stream;
      await this._video.play();
      this._active = true;

      // Track which device we ended up on
      const track = this._stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        this._currentDeviceId = settings.deviceId || null;
      }

      // Enumerate available rear lenses after first successful start
      if (this._availableLenses.length === 0) {
        await this._enumerateLenses();
      }
    } catch (err) {
      console.warn('[CameraFeed] Failed to start:', err.name, err.message);
      this._active = false;
      throw err;
    }
  }

  async _enumerateLenses() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      // On iOS, rear cameras have labels like:
      // "Back Camera", "Back Ultra Wide Camera", "Back Telephoto Camera"
      const rearCams = videoInputs.filter(d => {
        const label = (d.label || '').toLowerCase();
        return label.includes('back') || label.includes('rear') || label.includes('environment');
      });

      if (rearCams.length > 1) {
        // Deduplicate by deviceId
        const seen = new Set();
        const unique = rearCams.filter(d => {
          if (seen.has(d.deviceId)) return false;
          seen.add(d.deviceId);
          return true;
        });

        // Classify each lens by label keywords
        const lenses = [];
        let hasUltraWide = false, hasMain = false, hasTelephoto = false;

        for (const d of unique) {
          const lower = (d.label || '').toLowerCase();
          let shortLabel = '1x';
          let sortOrder = 1;

          if (lower.includes('ultra wide') || lower.includes('ultrawide')) {
            shortLabel = '0.5x';
            sortOrder = 0;
            if (hasUltraWide) continue; // skip duplicate type
            hasUltraWide = true;
          } else if (lower.includes('telephoto')) {
            // iPhone 15 Pro/16 Pro have 5x telephoto, older models have 2x/3x
            // Check label for explicit multiplier, default to 5x for modern devices
            if (lower.includes('2x') || lower.includes('×2')) shortLabel = '2x';
            else if (lower.includes('3x') || lower.includes('×3')) shortLabel = '3x';
            else shortLabel = '5x'; // modern iPhones default
            sortOrder = 2;
            if (hasTelephoto) continue;
            hasTelephoto = true;
          } else {
            // Main camera
            shortLabel = '1x';
            sortOrder = 1;
            if (hasMain) continue;
            hasMain = true;
          }

          lenses.push({ deviceId: d.deviceId, label: d.label, shortLabel, sortOrder });
        }

        // Sort: ultrawide, main, telephoto
        lenses.sort((a, b) => a.sortOrder - b.sortOrder);
        this._availableLenses = lenses;
      }
    } catch { /* silent */ }
  }

  async switchLens(deviceId) {
    this._currentDeviceId = deviceId;
    if (this._active) {
      await this.start(this._facingMode, deviceId);
    }
  }

  async toggle() {
    this._facingMode = this._facingMode === 'environment' ? 'user' : 'environment';
    this._currentDeviceId = null; // reset lens selection on flip
    if (this._active) await this.start();
  }

  async stop() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video.srcObject = null;
    this._active = false;
  }

  getCoverFitParams(canvasWidth, canvasHeight) {
    const vw = this._video.videoWidth;
    const vh = this._video.videoHeight;
    if (!vw || !vh) return null;
    const canvasRatio = canvasWidth / canvasHeight;
    const videoRatio = vw / vh;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (videoRatio > canvasRatio) {
      sw = vh * canvasRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / canvasRatio;
      sy = (vh - sh) / 2;
    }
    return { sx, sy, sw, sh };
  }

  drawToCanvas(ctx, canvasWidth, canvasHeight) {
    if (!this._active || this._video.readyState < 2) return;
    const fit = this.getCoverFitParams(canvasWidth, canvasHeight);
    if (!fit) return;
    if (this._facingMode === 'user') {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(this._video, fit.sx, fit.sy, fit.sw, fit.sh, -canvasWidth, 0, canvasWidth, canvasHeight);
      ctx.restore();
    } else {
      ctx.drawImage(this._video, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, canvasWidth, canvasHeight);
    }
  }
}

/**
 * CameraVisualizer — Mobile-only mode.
 * Camera feed background + Liquid Show effects on top.
 * iPhone Camera app inspired UI layout.
 */
export class CameraVisualizer {
  static get label() { return 'Camera'; }
  static get params() { return []; }
  static get mobileOnly() { return true; }

  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new LiquidShowVisualizer(canvas);
    this.camera = new CameraFeed();
    this.warpGPU = new CameraWarpGPU();
    this._app = null;
    this._micBtn = null;
    this._micLevelRAF = null;
    this._recording = false;
    this._mediaRecorder = null;
    this._recordedChunks = [];
    this._recordBtn = null;
    this._presetSelect = null;
    this._cameraStarted = false;
    this._cameraFailed = false;
    this._cameraBlend = 0.7;
    this._warpMode = 'none';
    this._floatingEls = []; // track floating UI elements for hide/show

    const preset = LL_PRESETS[Math.floor(Math.random() * LL_PRESETS.length)];
    if (preset) {
      this._currentPresetId = preset.id;
      this.engine.setState(JSON.parse(JSON.stringify(preset.vizState)));
    }
  }

  // --- Drawing ---

  draw(freq, time) {
    const ctx = this.canvas.getContext('2d');
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.camera.active && this._cameraBlend > 0.01) {
      ctx.globalAlpha = this._cameraBlend;
      const needsWarp = this._warpMode !== 'none';
      const isFront = this.camera.facingMode === 'user';
      const video = this.camera.video;

      if (video.readyState >= 2 && (needsWarp || isFront)) {
        this._drawWarpedCamera(ctx, w, h);
      } else {
        this.camera.drawToCanvas(ctx, w, h);
      }
      ctx.globalAlpha = 1;
    }

    if (this.camera.active) {
      const prevOp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'source-over';
      this.engine._cameraMode = true;
      this.engine.draw(freq, time);
      ctx.globalCompositeOperation = prevOp;
    } else {
      this.engine._cameraMode = false;
      this.engine.draw(freq, time);
    }
  }

  _drawWarpedCamera(ctx, w, h) {
    const video = this.camera.video;
    if (video.readyState < 2) return;
    const fit = this.camera.getCoverFitParams(w, h);
    if (!fit) return;
    if (!this._cropCanvas) this._cropCanvas = document.createElement('canvas');
    if (this._cropCanvas.width !== w || this._cropCanvas.height !== h) {
      this._cropCanvas.width = w;
      this._cropCanvas.height = h;
    }
    const cropCtx = this._cropCanvas.getContext('2d');
    cropCtx.clearRect(0, 0, w, h);
    cropCtx.drawImage(video, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, w, h);
    const isFront = this.camera.facingMode === 'user';
    const warpResult = this.warpGPU.process(this._cropCanvas, w, h, this._warpMode, isFront);
    if (warpResult) {
      ctx.drawImage(warpResult, 0, 0, w, h);
    } else {
      this.camera.drawToCanvas(ctx, w, h);
    }
  }

  reset() { this.engine.reset(); }
  getState() { return this.engine.getState(); }
  setState(s) { this.engine.setState(s); }
  setParam(k, v) { this.engine.setParam?.(k, v); }

  // --- Panel UI (iPhone Camera inspired) ---

  buildPanel(controlPanelEl, app) {
    this.destroyPanel();
    this._app = app;
    controlPanelEl.classList.add('ll-active');
    this._controlPanelEl = controlPanelEl;
    this._startCamera();

    // Container for all camera UI (not the mode selector bar)
    const panel = document.createElement('div');
    panel.className = 'cam-ui';
    this.panelEl = panel;
    document.body.appendChild(panel);

    // --- Left floating stack ---
    const leftStack = document.createElement('div');
    leftStack.className = 'cam-float cam-float-left';

    // Flip camera
    const flipBtn = this._makeFloatBtn('⟲', 'Flip camera');
    flipBtn.addEventListener('click', async () => {
      try {
        await this.camera.toggle();
        this._updateLensPicker();
      } catch { /* silent */ }
    });
    leftStack.appendChild(flipBtn);

    // Lens picker (populated after camera starts)
    this._lensContainer = document.createElement('div');
    this._lensContainer.className = 'cam-lens-container';
    leftStack.appendChild(this._lensContainer);

    // Warp picker
    const warpBtn = this._makeFloatBtn('FX', 'Effects');
    warpBtn.classList.add('cam-fx-btn');
    this._warpBtn = warpBtn;
    this._warpMenuOpen = false;
    warpBtn.addEventListener('click', () => {
      this._warpMenuOpen = !this._warpMenuOpen;
      this._warpMenu.classList.toggle('open', this._warpMenuOpen);
    });
    leftStack.appendChild(warpBtn);

    // Warp submenu
    const warpMenu = document.createElement('div');
    warpMenu.className = 'cam-warp-menu';
    WARP_MODES.forEach(mode => {
      const item = document.createElement('button');
      item.className = 'cam-warp-item' + (mode === this._warpMode ? ' active' : '');
      item.textContent = WARP_LABELS[mode];
      item.addEventListener('click', () => {
        this._warpMode = mode;
        warpMenu.querySelectorAll('.cam-warp-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this._warpMenuOpen = false;
        warpMenu.classList.remove('open');
      });
      warpMenu.appendChild(item);
    });
    this._warpMenu = warpMenu;
    leftStack.appendChild(warpMenu);

    // Mic toggle
    const micBtn = this._makeFloatBtn('🎤', 'Mic');
    this._micBtn = micBtn;
    if (app?.mic.active) {
      this._updateMicUI(true);
      this._startLevelMonitor();
    }
    micBtn.addEventListener('click', () => this._toggleMic());
    leftStack.appendChild(micBtn);

    panel.appendChild(leftStack);

    // --- Right floating stack ---
    const rightStack = document.createElement('div');
    rightStack.className = 'cam-float cam-float-right';

    // Randomize
    const randomBtn = this._makeFloatBtn('🎲', 'Randomize');
    randomBtn.addEventListener('click', () => {
      this.engine._randomizeAllLayersInternal();
      if (this._presetSelect) this._presetSelect.value = '';
    });
    rightStack.appendChild(randomBtn);

    // Blend slider (vertical)
    const blendWrap = document.createElement('div');
    blendWrap.className = 'cam-blend-wrap';
    const blendSlider = document.createElement('input');
    blendSlider.type = 'range';
    blendSlider.className = 'cam-blend-slider';
    blendSlider.min = '0';
    blendSlider.max = '1';
    blendSlider.step = '0.05';
    blendSlider.value = this._cameraBlend;
    blendSlider.orient = 'vertical';
    blendSlider.addEventListener('input', () => {
      this._cameraBlend = parseFloat(blendSlider.value);
    });
    const blendIcon = document.createElement('span');
    blendIcon.className = 'cam-blend-icon';
    blendIcon.textContent = '📷';
    blendWrap.appendChild(blendSlider);
    blendWrap.appendChild(blendIcon);
    rightStack.appendChild(blendWrap);

    panel.appendChild(rightStack);

    // --- Bottom bar ---
    const bottomBar = document.createElement('div');
    bottomBar.className = 'cam-bottom-bar';

    // Preset dropdown
    const presetSelector = LiquidShowVisualizer.buildPresetSelector(state => {
      this.engine.setState(state);
    });
    this._presetSelect = presetSelector.querySelector('select');
    if (this._presetSelect && this._currentPresetId) this._presetSelect.value = this._currentPresetId;
    presetSelector.className = 'cam-preset-wrap';
    bottomBar.appendChild(presetSelector);

    // Shutter button (snapshot)
    const shutterBtn = document.createElement('button');
    shutterBtn.className = 'cam-shutter';
    shutterBtn.innerHTML = '<span class="cam-shutter-ring"></span>';
    shutterBtn.addEventListener('click', () => this._takeSnapshot());
    bottomBar.appendChild(shutterBtn);

    // Record button
    const recordBtn = document.createElement('button');
    recordBtn.className = 'cam-record';
    recordBtn.innerHTML = '<span class="cam-record-dot"></span>';
    this._recordBtn = recordBtn;
    recordBtn.addEventListener('click', () => this._toggleRecording());
    bottomBar.appendChild(recordBtn);

    panel.appendChild(bottomBar);

    // Track all floating elements for hide/show
    this._floatingEls = [leftStack, rightStack, bottomBar];

    // Mic state callback
    this._micStateHandler = (state, err) => {
      if (state === 'error') {
        this._showError(err?.name === 'NotAllowedError' ? 'Mic access denied' : 'Mic unavailable');
        this._updateMicUI(false);
        this._stopLevelMonitor();
      } else {
        this._updateMicUI(state);
        if (state) this._startLevelMonitor();
        else this._stopLevelMonitor();
      }
    };
    if (app) app.mic.onStateChange = this._micStateHandler;

    // Populate lens picker once camera is ready
    this._waitForLenses();
  }

  _makeFloatBtn(icon, title) {
    const btn = document.createElement('button');
    btn.className = 'cam-fbtn';
    btn.innerHTML = icon;
    btn.title = title;
    return btn;
  }

  async _waitForLenses() {
    // Poll briefly for lens data (camera enumerates after first stream)
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (this.camera.availableLenses.length > 0) {
        this._updateLensPicker();
        return;
      }
    }
  }

  _updateLensPicker() {
    if (!this._lensContainer) return;
    this._lensContainer.innerHTML = '';
    const lenses = this.camera.availableLenses;
    if (lenses.length === 0 || this.camera.facingMode === 'user') return;

    lenses.forEach(lens => {
      const btn = document.createElement('button');
      btn.className = 'cam-fbtn cam-lens-btn' +
        (lens.deviceId === this.camera.currentDeviceId ? ' active' : '');
      btn.textContent = lens.shortLabel;
      btn.addEventListener('click', async () => {
        try {
          await this.camera.switchLens(lens.deviceId);
          this._lensContainer.querySelectorAll('.cam-lens-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        } catch { /* silent */ }
      });
      this._lensContainer.appendChild(btn);
    });
  }

  /**
   * Toggle camera UI visibility (called by app's mobile tap handler).
   */
  setUIHidden(hidden) {
    this._floatingEls.forEach(el => {
      el.classList.toggle('cam-hidden', hidden);
    });
  }

  destroyPanel() {
    this._stopRecording();
    this._stopLevelMonitor();
    this.camera.stop();
    this._cameraStarted = false;
    this._cameraFailed = false;
    if (this._app) this._app.mic.onStateChange = null;
    if (this.panelEl) { this.panelEl.remove(); this.panelEl = null; }
    this._floatingEls = [];
    this._micBtn = null;
    this._recordBtn = null;
    this._presetSelect = null;
    this._lensContainer = null;
    this._warpMenu = null;
    this._warpBtn = null;
    this._controlPanelEl?.classList.remove('ll-active', 'll-ui-hidden');
  }

  // --- Camera ---

  async _startCamera() {
    if (this._cameraStarted || this._cameraFailed) return;
    try {
      await this.camera.start('environment');
      this._cameraStarted = true;
    } catch (err) {
      this._cameraFailed = true;
      if (err?.name === 'NotAllowedError') {
        this._showError('Camera access denied — enable in browser settings');
      } else if (err?.name === 'NotFoundError') {
        this._showError('No camera found');
      } else {
        this._showError('Camera unavailable');
      }
    }
  }

  // --- Snapshot ---

  async _takeSnapshot() {
    try {
      const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `trippy-${Date.now()}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.warn('[Camera] Snapshot failed:', err);
    }
  }

  // --- Video Recording ---

  _getSupportedMimeType() {
    const types = [
      'video/mp4;codecs=h264', 'video/mp4',
      'video/webm;codecs=h264', 'video/webm;codecs=vp9',
      'video/webm;codecs=vp8', 'video/webm',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
    }
    return null;
  }

  _toggleRecording() {
    if (this._recording) this._stopRecording();
    else this._startRecording();
  }

  _startRecording() {
    if (this._recording || typeof MediaRecorder === 'undefined') return;
    const mimeType = this._getSupportedMimeType();
    if (!mimeType) { this._showError('No supported video codec'); return; }
    try {
      const stream = this.canvas.captureStream(30);
      if (this._app?.mic.active && this._app.mic.stream) {
        this._app.mic.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      }
      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._recordedChunks = [];
      this._mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this._recordedChunks.push(e.data); };
      this._mediaRecorder.onstop = () => this._saveRecording(mimeType);
      this._mediaRecorder.start(1000);
      this._recording = true;
      this._updateRecordUI();
    } catch (err) {
      console.warn('[Camera] Recording failed:', err);
      this._showError('Recording failed');
    }
  }

  _stopRecording() {
    if (!this._recording || !this._mediaRecorder) return;
    try { if (this._mediaRecorder.state !== 'inactive') this._mediaRecorder.stop(); } catch {}
    this._recording = false;
    this._mediaRecorder = null;
    this._updateRecordUI();
  }

  async _saveRecording(mimeType) {
    if (this._recordedChunks.length === 0) return;
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const blob = new Blob(this._recordedChunks, { type: mimeType });
    this._recordedChunks = [];
    const file = new File([blob], `trippy-${Date.now()}.${ext}`, { type: mimeType });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.warn('[Camera] Save failed:', err);
    }
  }

  _updateRecordUI() {
    if (this._recordBtn) this._recordBtn.classList.toggle('recording', this._recording);
  }

  // --- Mic ---

  async _toggleMic() {
    if (!this._app) return;
    await this._app.toggleMic();
  }

  _updateMicUI(active) {
    if (!this._micBtn) return;
    this._micBtn.classList.toggle('mic-active', active);
    if (!active) this._micBtn.style.removeProperty('--mic-level');
  }

  _startLevelMonitor() {
    this._stopLevelMonitor();
    const update = () => {
      if (!this._app?.mic.active || !this._app.mic.analyser) return;
      this._app.mic.analyser.getByteFrequencyData(this._app.mic.freqData);
      let sum = 0;
      const bins = Math.min(32, this._app.mic.freqData.length);
      for (let i = 0; i < bins; i++) sum += this._app.mic.freqData[i];
      const level = sum / (bins * 255);
      if (this._micBtn) this._micBtn.style.setProperty('--mic-level', level.toFixed(2));
      this._micLevelRAF = requestAnimationFrame(update);
    };
    this._micLevelRAF = requestAnimationFrame(update);
  }

  _stopLevelMonitor() {
    if (this._micLevelRAF) { cancelAnimationFrame(this._micLevelRAF); this._micLevelRAF = null; }
  }

  _showError(text) {
    const msg = document.createElement('div');
    msg.className = 'cam-error';
    msg.textContent = text;
    this.panelEl?.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
  }
}
