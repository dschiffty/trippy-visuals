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

    // Preset selector
    const presetSelector = LiquidShowVisualizer.buildPresetSelector(state => {
      this.engine.setState(state);
    });
    const select = presetSelector.querySelector('select');
    if (select && this._currentPresetId) select.value = this._currentPresetId;
    panel.appendChild(presetSelector);

    // Mic toggle button with long-press gain control
    const micBtn = document.createElement('button');
    micBtn.className = 'll-lite-mic';
    micBtn.innerHTML = '<span class="mic-icon">🎤</span>';
    this._micBtn = micBtn;

    // Restore mic UI state if mic is already active from a previous mode
    if (app?.mic.active) {
      this._updateMicUI(true);
      this._startLevelMonitor();
    }

    // Short tap = toggle mic, long press = open gain popover
    let longPressTimer = null;
    let didLongPress = false;
    const startPress = () => {
      didLongPress = false;
      longPressTimer = setTimeout(() => {
        didLongPress = true;
        this._showGainPopover(micBtn);
      }, 500);
    };
    const endPress = () => {
      clearTimeout(longPressTimer);
      if (!didLongPress) this._toggleMic();
    };
    const cancelPress = () => { clearTimeout(longPressTimer); };
    micBtn.addEventListener('touchstart', startPress, { passive: true });
    micBtn.addEventListener('touchend', (e) => { e.preventDefault(); endPress(); });
    micBtn.addEventListener('touchcancel', cancelPress);
    micBtn.addEventListener('mousedown', startPress);
    micBtn.addEventListener('mouseup', endPress);
    micBtn.addEventListener('mouseleave', cancelPress);
    panel.appendChild(micBtn);

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

    // Tap canvas to toggle UI visibility
    this._uiHidden = false;
    this._onCanvasTap = (e) => {
      if (e.target.closest('.ll-lite-panel, .ll-gain-popover, .control-panel button, .control-panel select')) return;
      this._uiHidden = !this._uiHidden;
      controlPanelEl.classList.toggle('ll-ui-hidden', this._uiHidden);
      panel.classList.toggle('ll-ui-hidden', this._uiHidden);
    };
    this.canvas.addEventListener('click', this._onCanvasTap);
  }

  destroyPanel() {
    this._dismissGainPopover();
    this._stopLevelMonitor();
    // Do NOT stop the mic — it persists across mode switches
    if (this._app) this._app.mic.onStateChange = null;
    if (this._onCanvasTap) {
      this.canvas.removeEventListener('click', this._onCanvasTap);
      this._onCanvasTap = null;
    }
    if (this.panelEl) { this.panelEl.remove(); this.panelEl = null; }
    this._micBtn = null;
    this._controlPanelEl?.classList.remove('ll-active', 'll-ui-hidden');
    this._uiHidden = false;
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

  // --- Gain Popover ---

  _showGainPopover(anchorEl) {
    this._dismissGainPopover();
    if (!this._app) return;

    const popover = document.createElement('div');
    popover.className = 'll-gain-popover';

    const label = document.createElement('div');
    label.className = 'll-gain-label';
    label.textContent = `Mic Gain: ${this._app.mic.gainValue.toFixed(1)}x`;
    popover.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'll-gain-slider';
    slider.min = '0.5';
    slider.max = '10';
    slider.step = '0.5';
    slider.value = this._app.mic.gainValue;
    slider.addEventListener('input', () => {
      this._app.setMicGain(parseFloat(slider.value));
      label.textContent = `Mic Gain: ${this._app.mic.gainValue.toFixed(1)}x`;
    });
    popover.appendChild(slider);

    this.panelEl.appendChild(popover);
    this._gainPopover = popover;

    setTimeout(() => {
      this._dismissGainHandler = (e) => {
        if (!popover.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
          this._dismissGainPopover();
        }
      };
      document.addEventListener('click', this._dismissGainHandler, true);
      document.addEventListener('touchstart', this._dismissGainHandler, true);
    }, 10);
  }

  _dismissGainPopover() {
    if (this._gainPopover) { this._gainPopover.remove(); this._gainPopover = null; }
    if (this._dismissGainHandler) {
      document.removeEventListener('click', this._dismissGainHandler, true);
      document.removeEventListener('touchstart', this._dismissGainHandler, true);
      this._dismissGainHandler = null;
    }
  }
}
