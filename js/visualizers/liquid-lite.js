/* ============================================
   Liquid Lite — Mobile Preview Mode
   Wraps LiquidShowVisualizer with a simplified
   mobile-friendly control bar.
   ============================================ */

import { LiquidShowVisualizer } from './liquid-show.js';
import { LL_PRESETS } from './ll-presets.js';

const DEFAULT_PRESET_ID = 'gallery-glow';

export class LiquidLiteVisualizer {
  static get label() { return 'Liquid Lite'; }
  static get params() { return []; }
  static get mobileOnly() { return true; }

  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new LiquidShowVisualizer(canvas);
    // Load default preset
    const preset = LL_PRESETS.find(p => p.id === DEFAULT_PRESET_ID);
    if (preset) this.engine.setState(JSON.parse(JSON.stringify(preset.vizState)));

    // Mic state
    this._micActive = false;
    this._micStream = null;
    this._micContext = null;
    this._micAnalyser = null;
    this._micSource = null;
    this._micFreqData = null;
    this._micTimeData = null;
    this._micBtn = null;
    this._micLevel = 0;
    this._micLevelRAF = null;

    // Clean up mic on page unload
    this._onBeforeUnload = () => this._stopMic();
    window.addEventListener('beforeunload', this._onBeforeUnload);
  }

  // --- Core draw — substitute mic data when active ---
  draw(freq, time) {
    if (this._micActive && this._micAnalyser) {
      this._micAnalyser.getByteFrequencyData(this._micFreqData);
      this._micAnalyser.getByteTimeDomainData(this._micTimeData);
      this.engine.draw(this._micFreqData, this._micTimeData);
    } else {
      this.engine.draw(freq, time);
    }
  }

  reset() { this.engine.reset(); }
  getState() { return this.engine.getState(); }
  setState(s) { this.engine.setState(s); }
  setParam(k, v) { this.engine.setParam?.(k, v); }

  buildPanel(controlPanelEl) {
    this.destroyPanel();
    controlPanelEl.classList.add('ll-active');
    this._controlPanelEl = controlPanelEl;

    const panel = document.createElement('div');
    panel.className = 'll-lite-panel';

    // Reuse the preset selector from LiquidShowVisualizer
    const presetSelector = LiquidShowVisualizer.buildPresetSelector(state => {
      this.engine.setState(state);
    });
    // Set dropdown to show the default preset
    const select = presetSelector.querySelector('select');
    if (select) select.value = DEFAULT_PRESET_ID;
    panel.appendChild(presetSelector);

    // Mic toggle button
    const micBtn = document.createElement('button');
    micBtn.className = 'll-lite-mic';
    micBtn.innerHTML = '<span class="mic-icon">🎤</span>';
    micBtn.addEventListener('click', () => this._toggleMic());
    panel.appendChild(micBtn);
    this._micBtn = micBtn;

    // Randomize button
    const randomBtn = document.createElement('button');
    randomBtn.className = 'll-lite-randomize';
    randomBtn.textContent = '\uD83C\uDFB2 Randomize';
    randomBtn.addEventListener('click', () => {
      this.engine._randomizeAllLayersInternal();
    });
    panel.appendChild(randomBtn);

    controlPanelEl.appendChild(panel);
    this.panelEl = panel;

    // Tap canvas to toggle UI visibility
    this._uiHidden = false;
    this._onCanvasTap = (e) => {
      // Ignore if the tap is on a UI element (button, select, etc.)
      if (e.target.closest('.ll-lite-panel, .control-panel button, .control-panel select')) return;
      this._uiHidden = !this._uiHidden;
      controlPanelEl.classList.toggle('ll-ui-hidden', this._uiHidden);
      panel.classList.toggle('ll-ui-hidden', this._uiHidden);
    };
    this.canvas.addEventListener('click', this._onCanvasTap);
  }

  destroyPanel() {
    this._stopMic();
    if (this._onCanvasTap) {
      this.canvas.removeEventListener('click', this._onCanvasTap);
      this._onCanvasTap = null;
    }
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
    this._micBtn = null;
    this._controlPanelEl?.classList.remove('ll-active', 'll-ui-hidden');
    this._uiHidden = false;
  }

  // --- Mic Input ---

  async _toggleMic() {
    if (this._micActive) {
      this._stopMic();
    } else {
      await this._startMic();
    }
  }

  async _startMic() {
    try {
      this._micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this._micContext = new (window.AudioContext || window.webkitAudioContext)();
      this._micSource = this._micContext.createMediaStreamSource(this._micStream);

      // Boost mic signal for better sensitivity
      this._micGain = this._micContext.createGain();
      this._micGain.gain.value = 3.0;

      this._micAnalyser = this._micContext.createAnalyser();
      this._micAnalyser.fftSize = 2048;
      this._micAnalyser.smoothingTimeConstant = 0.75;
      this._micAnalyser.minDecibels = -70;
      this._micAnalyser.maxDecibels = -10;

      this._micSource.connect(this._micGain);
      this._micGain.connect(this._micAnalyser);

      this._micFreqData = new Uint8Array(this._micAnalyser.frequencyBinCount);
      this._micTimeData = new Uint8Array(this._micAnalyser.fftSize);

      this._micActive = true;
      this._updateMicUI(true);
      this._startLevelMonitor();

      // Handle track ending unexpectedly
      this._micStream.getAudioTracks()[0].addEventListener('ended', () => {
        this._stopMic();
      });

    } catch (err) {
      // Permission denied or not available
      this._showMicError(err);
    }
  }

  _stopMic() {
    this._micActive = false;
    if (this._micLevelRAF) {
      cancelAnimationFrame(this._micLevelRAF);
      this._micLevelRAF = null;
    }
    if (this._micStream) {
      this._micStream.getTracks().forEach(t => t.stop());
      this._micStream = null;
    }
    if (this._micSource) {
      this._micSource.disconnect();
      this._micSource = null;
    }
    if (this._micGain) {
      this._micGain.disconnect();
      this._micGain = null;
    }
    if (this._micContext && this._micContext.state !== 'closed') {
      this._micContext.close();
      this._micContext = null;
    }
    this._micAnalyser = null;
    this._micFreqData = null;
    this._micTimeData = null;
    this._updateMicUI(false);
  }

  _updateMicUI(active) {
    if (!this._micBtn) return;
    this._micBtn.classList.toggle('mic-active', active);
    if (!active) {
      this._micBtn.style.removeProperty('--mic-level');
    }
  }

  _startLevelMonitor() {
    const update = () => {
      if (!this._micActive || !this._micAnalyser) return;
      this._micAnalyser.getByteFrequencyData(this._micFreqData);
      // Average the low-frequency bins for a level indicator
      let sum = 0;
      const bins = Math.min(32, this._micFreqData.length);
      for (let i = 0; i < bins; i++) sum += this._micFreqData[i];
      const level = sum / (bins * 255); // 0..1
      this._micLevel = level;
      if (this._micBtn) {
        this._micBtn.style.setProperty('--mic-level', level.toFixed(2));
      }
      this._micLevelRAF = requestAnimationFrame(update);
    };
    this._micLevelRAF = requestAnimationFrame(update);
  }

  _showMicError(err) {
    const msg = document.createElement('div');
    msg.className = 'll-mic-error';
    if (err.name === 'NotAllowedError') {
      msg.textContent = 'Mic access denied — enable in browser settings for audio reactivity';
    } else if (err.name === 'NotFoundError') {
      msg.textContent = 'No microphone found';
    } else {
      msg.textContent = 'Mic unavailable — HTTPS required';
    }
    this.panelEl?.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
  }

  // --- Extensibility stubs for future features ---
  enableTouchReactivity() { /* future: map touch events to reactive params */ }
  enableCameraFeed() { /* future: pipe camera as an image layer */ }
}
