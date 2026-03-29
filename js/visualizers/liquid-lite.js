/* ============================================
   Liquid Lite — Mobile Preview Mode
   Wraps LiquidShowVisualizer with a simplified
   mobile-friendly control bar.
   ============================================ */

import { LiquidShowVisualizer } from './liquid-show.js';
import { LL_PRESETS } from './ll-presets.js';

export class LiquidLiteVisualizer {
  static get label() { return 'Liquid Lite'; }
  static get params() { return []; }
  static get mobileOnly() { return true; }

  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new LiquidShowVisualizer(canvas);
    // Load a random preset on start
    const preset = LL_PRESETS[Math.floor(Math.random() * LL_PRESETS.length)];
    if (preset) {
      this._currentPresetId = preset.id;
      this.engine.setState(JSON.parse(JSON.stringify(preset.vizState)));
    }
    this._app = null;
    this._micBtn = null;
    this._micLevelRAF = null;
  }

  draw(freq, time) { this.engine.draw(freq, time); }
  reset() { this.engine.reset(); }
  getState() { return this.engine.getState(); }
  setState(s) { this.engine.setState(s); }
  setParam(k, v) { this.engine.setParam?.(k, v); }

  buildPanel(controlPanelEl, app) {
    this.destroyPanel();
    this._app = app;
    controlPanelEl.classList.add('ll-active');
    this._controlPanelEl = controlPanelEl;

    const panel = document.createElement('div');
    panel.className = 'll-lite-panel';

    // --- Slider row (Gain, Intensity, Dynamic) ---
    const sliderRow = document.createElement('div');
    sliderRow.className = 'll-slider-row';

    const makeSlider = (label, min, max, step, value, onChange) => {
      const group = document.createElement('div');
      group.className = 'll-slider-group';
      const lbl = document.createElement('span');
      lbl.className = 'll-slider-label';
      lbl.textContent = label;
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'll-slider-input';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = value;
      input.addEventListener('input', () => onChange(parseFloat(input.value)));
      group.appendChild(lbl);
      group.appendChild(input);
      return { group, input };
    };

    const gainSlider = makeSlider('Gain', 0.5, 10, 0.5, app?.mic.gainValue ?? 2, (v) => {
      if (app) app.setMicGain(v);
    });
    sliderRow.appendChild(gainSlider.group);

    const intensitySlider = makeSlider('Intensity', 0, 1, 0.05, this.engine.globals.turbulence, (v) => {
      this.engine.globals.turbulence = v;
    });
    sliderRow.appendChild(intensitySlider.group);

    const dynamicSlider = makeSlider('Dynamic', 0, 1, 0.05, this.engine.globals.journey, (v) => {
      this.engine.globals.journey = v;
    });
    sliderRow.appendChild(dynamicSlider.group);

    panel.appendChild(sliderRow);

    // --- Main button row ---
    const buttonRow = document.createElement('div');
    buttonRow.className = 'll-button-row';

    // Preset selector
    const presetSelector = LiquidShowVisualizer.buildPresetSelector(state => {
      this.engine.setState(state);
    });
    const select = presetSelector.querySelector('select');
    if (select && this._currentPresetId) select.value = this._currentPresetId;
    buttonRow.appendChild(presetSelector);

    // Mic toggle button (simple tap only)
    const micBtn = document.createElement('button');
    micBtn.className = 'll-lite-mic';
    micBtn.innerHTML = '<span class="mic-icon">🎤</span>';
    this._micBtn = micBtn;

    // Restore mic UI state if mic is already active from a previous mode
    if (app?.mic.active) {
      this._updateMicUI(true);
      this._startLevelMonitor();
    }

    micBtn.addEventListener('click', () => this._toggleMic());
    buttonRow.appendChild(micBtn);

    // Randomize button
    const randomBtn = document.createElement('button');
    randomBtn.className = 'll-lite-randomize';
    randomBtn.textContent = '\uD83C\uDFB2 Randomize';
    randomBtn.addEventListener('click', () => {
      this.engine._randomizeAllLayersInternal();
    });
    buttonRow.appendChild(randomBtn);

    panel.appendChild(buttonRow);
    controlPanelEl.appendChild(panel);
    this.panelEl = panel;

    // Listen for mic state changes from app (e.g. if mic stops externally)
    this._micStateHandler = (state, err) => {
      if (state === 'error') {
        this._showMicError(err);
        this._updateMicUI(false);
        this._stopLevelMonitor();
      } else {
        this._updateMicUI(state);
        if (state) this._startLevelMonitor();
        else this._stopLevelMonitor();
      }
    };
    if (app) app.mic.onStateChange = this._micStateHandler;

    // UI toggle is handled by the app-level mobile tap handler
  }

  destroyPanel() {
    this._stopLevelMonitor();
    // Do NOT stop the mic — it persists across mode switches
    if (this._app) this._app.mic.onStateChange = null;
    if (this.panelEl) { this.panelEl.remove(); this.panelEl = null; }
    this._micBtn = null;
    this._controlPanelEl?.classList.remove('ll-active', 'll-ui-hidden');

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

  _showMicError(err) {
    const msg = document.createElement('div');
    msg.className = 'll-mic-error';
    if (err?.name === 'NotAllowedError') {
      msg.textContent = 'Mic access denied — enable in browser settings for audio reactivity';
    } else if (err?.name === 'NotFoundError') {
      msg.textContent = 'No microphone found';
    } else {
      msg.textContent = 'Mic unavailable — HTTPS required';
    }
    this.panelEl?.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
  }

}
