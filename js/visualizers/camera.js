/* ============================================
   Camera Mode — Mobile AR Visualizer
   Renders live camera feed as background with
   Liquid Lite effects composited on top.
   ============================================ */

import { LiquidShowVisualizer } from './liquid-show.js';
import { LL_PRESETS } from './ll-presets.js';
import { CameraWarpGPU, WARP_MODES, WARP_LABELS } from './camera-warp-gpu.js';

/**
 * Reusable camera feed manager.
 * Handles getUserMedia, front/rear toggle, and drawing to canvas.
 */
export class CameraFeed {
  constructor() {
    this._stream = null;
    this._video = document.createElement('video');
    this._video.setAttribute('playsinline', '');
    this._video.setAttribute('autoplay', '');
    this._video.muted = true;
    this._facingMode = 'environment'; // 'environment' = rear, 'user' = front
    this._active = false;
  }

  get active() { return this._active; }
  get facingMode() { return this._facingMode; }
  get video() { return this._video; }

  async start(facingMode) {
    if (facingMode) this._facingMode = facingMode;
    await this.stop();
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this._facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this._video.srcObject = this._stream;
      await this._video.play();
      this._active = true;
    } catch (err) {
      console.warn('[CameraFeed] Failed to start:', err.name, err.message);
      this._active = false;
      throw err;
    }
  }

  async toggle() {
    this._facingMode = this._facingMode === 'environment' ? 'user' : 'environment';
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

  /**
   * Get cover-fit crop parameters for the video → canvas mapping.
   */
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

  /**
   * Draw the camera feed to a canvas context, filling the canvas.
   * Uses cover-fit logic so there are no black bars.
   */
  drawToCanvas(ctx, canvasWidth, canvasHeight) {
    if (!this._active || this._video.readyState < 2) return;
    const fit = this.getCoverFitParams(canvasWidth, canvasHeight);
    if (!fit) return;

    // Mirror front camera
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
    this._recordDot = null;
    this._presetSelect = null;
    this._cameraStarted = false;
    this._cameraFailed = false;

    // Camera controls
    this._cameraBlend = 0.7;    // 0 = camera hidden, 1 = full strength
    this._warpMode = 'none';

    // Load a random preset
    const preset = LL_PRESETS[Math.floor(Math.random() * LL_PRESETS.length)];
    if (preset) {
      this._currentPresetId = preset.id;
      this.engine.setState(JSON.parse(JSON.stringify(preset.vizState)));
    }
  }

  draw(freq, time) {
    const ctx = this.canvas.getContext('2d');
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Clear canvas
    ctx.clearRect(0, 0, w, h);

    // 2. Draw camera feed as background (warped if applicable)
    if (this.camera.active && this._cameraBlend > 0.01) {
      ctx.globalAlpha = this._cameraBlend;

      const needsWarp = this._warpMode !== 'none';
      const isFront = this.camera.facingMode === 'user';
      const video = this.camera.video;

      if (video.readyState >= 2 && (needsWarp || isFront)) {
        // Use GPU warp pipeline: crop video to cover-fit canvas first via
        // an intermediate canvas, then warp via WebGL
        const warpResult = this.warpGPU.process(video, w, h, this._warpMode, isFront);
        if (warpResult) {
          // The warp output is already at canvas dimensions but processes the full
          // video frame. We need to handle cover-fit cropping.
          // For warped output, we draw from the warp canvas with cover-fit applied
          // The GPU processes the full video, so crop params need to map to UV space.
          // Simpler approach: draw cropped video to a temp canvas, then warp that.
          this._drawWarpedCamera(ctx, w, h);
        } else {
          // Warp failed, fallback to direct draw
          this.camera.drawToCanvas(ctx, w, h);
        }
      } else {
        // No warp needed, direct draw
        this.camera.drawToCanvas(ctx, w, h);
      }

      ctx.globalAlpha = 1;
    }

    // 3. Draw effects on top
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

  /**
   * Draw camera through GPU warp pipeline with cover-fit cropping.
   * Uses an intermediate canvas to crop video to cover-fit dimensions,
   * then passes that to the GPU warp.
   */
  _drawWarpedCamera(ctx, w, h) {
    const video = this.camera.video;
    if (video.readyState < 2) return;

    // Get cover-fit crop params
    const fit = this.camera.getCoverFitParams(w, h);
    if (!fit) return;

    // Use/create intermediate canvas for cropping
    if (!this._cropCanvas) {
      this._cropCanvas = document.createElement('canvas');
    }
    if (this._cropCanvas.width !== w || this._cropCanvas.height !== h) {
      this._cropCanvas.width = w;
      this._cropCanvas.height = h;
    }
    const cropCtx = this._cropCanvas.getContext('2d');
    cropCtx.clearRect(0, 0, w, h);
    cropCtx.drawImage(video, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, w, h);

    // Process cropped frame through GPU warp
    const isFront = this.camera.facingMode === 'user';
    const warpResult = this.warpGPU.process(this._cropCanvas, w, h, this._warpMode, isFront);
    if (warpResult) {
      ctx.drawImage(warpResult, 0, 0, w, h);
    } else {
      // Fallback
      this.camera.drawToCanvas(ctx, w, h);
    }
  }

  reset() { this.engine.reset(); }
  getState() { return this.engine.getState(); }
  setState(s) { this.engine.setState(s); }
  setParam(k, v) { this.engine.setParam?.(k, v); }

  // --- Panel UI ---

  buildPanel(controlPanelEl, app) {
    this.destroyPanel();
    this._app = app;
    controlPanelEl.classList.add('ll-active');
    this._controlPanelEl = controlPanelEl;

    // Start camera when entering this mode
    this._startCamera();

    const panel = document.createElement('div');
    panel.className = 'll-lite-panel camera-panel';

    // --- Camera controls row (blend slider + warp picker) ---
    const controlsRow = document.createElement('div');
    controlsRow.className = 'camera-controls-row';

    // Camera blend slider
    const blendGroup = document.createElement('div');
    blendGroup.className = 'camera-slider-group';
    const blendLabel = document.createElement('span');
    blendLabel.className = 'camera-slider-label';
    blendLabel.textContent = 'Camera';
    const blendSlider = document.createElement('input');
    blendSlider.type = 'range';
    blendSlider.className = 'camera-slider-input';
    blendSlider.min = '0';
    blendSlider.max = '1';
    blendSlider.step = '0.05';
    blendSlider.value = this._cameraBlend;
    blendSlider.addEventListener('input', () => {
      this._cameraBlend = parseFloat(blendSlider.value);
    });
    blendGroup.appendChild(blendLabel);
    blendGroup.appendChild(blendSlider);
    controlsRow.appendChild(blendGroup);

    // Warp mode picker
    const warpGroup = document.createElement('div');
    warpGroup.className = 'camera-warp-group';
    const warpLabel = document.createElement('span');
    warpLabel.className = 'camera-slider-label';
    warpLabel.textContent = 'Warp';
    const warpSelect = document.createElement('select');
    warpSelect.className = 'camera-warp-select';
    WARP_MODES.forEach(mode => {
      const opt = document.createElement('option');
      opt.value = mode;
      opt.textContent = WARP_LABELS[mode];
      if (mode === this._warpMode) opt.selected = true;
      warpSelect.appendChild(opt);
    });
    warpSelect.addEventListener('change', () => {
      this._warpMode = warpSelect.value;
    });
    warpGroup.appendChild(warpLabel);
    warpGroup.appendChild(warpSelect);
    controlsRow.appendChild(warpGroup);

    panel.appendChild(controlsRow);

    // --- Main button row ---
    const buttonRow = document.createElement('div');
    buttonRow.className = 'camera-button-row';

    // Camera toggle (front/rear)
    const camToggle = document.createElement('button');
    camToggle.className = 'll-lite-mic camera-toggle-btn';
    camToggle.innerHTML = '🔄';
    camToggle.title = 'Switch camera';
    camToggle.addEventListener('click', async () => {
      try { await this.camera.toggle(); } catch { /* silent */ }
    });
    buttonRow.appendChild(camToggle);

    // Preset selector
    const presetSelector = LiquidShowVisualizer.buildPresetSelector(state => {
      this.engine.setState(state);
    });
    this._presetSelect = presetSelector.querySelector('select');
    if (this._presetSelect && this._currentPresetId) this._presetSelect.value = this._currentPresetId;
    buttonRow.appendChild(presetSelector);

    // Randomize button
    const randomBtn = document.createElement('button');
    randomBtn.className = 'll-lite-randomize';
    randomBtn.textContent = '🎲';
    randomBtn.title = 'Randomize effects';
    randomBtn.addEventListener('click', () => {
      this.engine._randomizeAllLayersInternal();
      if (this._presetSelect) this._presetSelect.value = '';
    });
    buttonRow.appendChild(randomBtn);

    // Mic toggle
    const micBtn = document.createElement('button');
    micBtn.className = 'll-lite-mic';
    micBtn.innerHTML = '<span class="mic-icon">🎤</span>';
    this._micBtn = micBtn;
    if (app?.mic.active) {
      this._updateMicUI(true);
      this._startLevelMonitor();
    }
    micBtn.addEventListener('click', () => this._toggleMic());
    buttonRow.appendChild(micBtn);

    // Snapshot button
    const snapBtn = document.createElement('button');
    snapBtn.className = 'll-lite-mic camera-snap-btn';
    snapBtn.innerHTML = '📸';
    snapBtn.title = 'Capture snapshot';
    snapBtn.addEventListener('click', () => this._takeSnapshot());
    buttonRow.appendChild(snapBtn);

    // Record button
    const recordBtn = document.createElement('button');
    recordBtn.className = 'll-lite-mic camera-record-btn';
    recordBtn.innerHTML = '<span class="record-dot"></span>';
    recordBtn.title = 'Record video';
    this._recordBtn = recordBtn;
    this._recordDot = recordBtn.querySelector('.record-dot');
    recordBtn.addEventListener('click', () => this._toggleRecording());
    buttonRow.appendChild(recordBtn);

    panel.appendChild(buttonRow);
    controlPanelEl.appendChild(panel);
    this.panelEl = panel;

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
  }

  destroyPanel() {
    this._stopRecording();
    this._stopLevelMonitor();
    this.camera.stop();
    this._cameraStarted = false;
    this._cameraFailed = false;
    if (this._app) this._app.mic.onStateChange = null;
    if (this.panelEl) { this.panelEl.remove(); this.panelEl = null; }
    this._micBtn = null;
    this._recordBtn = null;
    this._recordDot = null;
    this._presetSelect = null;
    this._controlPanelEl?.classList.remove('ll-active', 'll-ui-hidden');
    // Don't destroy warpGPU — reuse across panel rebuilds
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

      // Try native share sheet (iOS Safari)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.warn('[Camera] Snapshot failed:', err);
      }
    }
  }

  // --- Video Recording ---

  _getSupportedMimeType() {
    const types = [
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  }

  _toggleRecording() {
    if (this._recording) {
      this._stopRecording();
    } else {
      this._startRecording();
    }
  }

  _startRecording() {
    if (this._recording) return;
    if (typeof MediaRecorder === 'undefined') {
      this._showError('Recording not supported');
      return;
    }

    const mimeType = this._getSupportedMimeType();
    if (!mimeType) {
      this._showError('No supported video codec');
      return;
    }

    try {
      const stream = this.canvas.captureStream(30);

      // Add audio track from mic if active
      if (this._app?.mic.active && this._app.mic.stream) {
        const audioTracks = this._app.mic.stream.getAudioTracks();
        audioTracks.forEach(t => stream.addTrack(t));
      }

      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._recordedChunks = [];

      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._recordedChunks.push(e.data);
      };

      this._mediaRecorder.onstop = () => this._saveRecording(mimeType);

      this._mediaRecorder.start(1000); // 1s chunks
      this._recording = true;
      this._updateRecordUI();
    } catch (err) {
      console.warn('[Camera] Recording failed to start:', err);
      this._showError('Recording failed');
    }
  }

  _stopRecording() {
    if (!this._recording || !this._mediaRecorder) return;
    try {
      if (this._mediaRecorder.state !== 'inactive') {
        this._mediaRecorder.stop();
      }
    } catch { /* silent */ }
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
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.warn('[Camera] Save recording failed:', err);
      }
    }
  }

  _updateRecordUI() {
    if (this._recordBtn) {
      this._recordBtn.classList.toggle('recording', this._recording);
    }
  }

  // --- Mic (delegates to app) ---

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

  // --- Error display ---

  _showError(text) {
    const msg = document.createElement('div');
    msg.className = 'll-mic-error';
    msg.textContent = text;
    this.panelEl?.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
  }
}
