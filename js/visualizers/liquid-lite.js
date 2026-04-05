/* ============================================
   Liquid Lite — Mobile Preview Mode
   Wraps LiquidShowVisualizer with a simplified
   mobile-friendly UI matching Camera mode layout.
   ============================================ */

import { LiquidShowVisualizer } from './liquid-show.js';
import { LL_PRESETS } from './ll-presets.js';
import { createVerticalSlider } from '../ui/vertical-slider.js';

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
    this._globalIntensity = 1.0;
    this._floatingEls = [];
    this._leftStack = null;
    this._rightStack = null;
    this._bottomBar = null;
    this._orientationHandler = null;
    this._orientationDebounce = null;
    this._gainSlider = null;
  }

  draw(freq, time) {
    // Apply global intensity multiplier to all layer turbulence values
    if (this._globalIntensity !== 1.0) {
      const saved = this.engine.layers.map(l => l.params.turbulence);
      this.engine.layers.forEach(l => {
        l.params.turbulence = Math.min(1, l.params.turbulence * this._globalIntensity);
      });
      this.engine.draw(freq, time);
      this.engine.layers.forEach((l, i) => l.params.turbulence = saved[i]);
    } else {
      this.engine.draw(freq, time);
    }
  }

  reset() { this.engine.reset(); }
  getState() { return this.engine.getState(); }
  setState(s) { this.engine.setState(s); }
  setParam(k, v) { this.engine.setParam?.(k, v); }

  // --- Panel UI (Camera mode inspired) ---

  buildPanel(controlPanelEl, app) {
    this.destroyPanel();
    this._app = app;
    controlPanelEl.classList.add('ll-active');
    this._controlPanelEl = controlPanelEl;

    // Fullscreen overlay container (same pattern as Camera mode)
    const panel = document.createElement('div');
    panel.className = 'cam-ui';
    this.panelEl = panel;
    document.body.appendChild(panel);

    // --- Left floating stack ---
    const leftStack = document.createElement('div');
    leftStack.className = 'cam-float cam-float-left';

    // Mic toggle
    const micBtn = this._makeFloatBtn('🎤', 'Mic');
    this._micBtn = micBtn;
    if (app?.mic.active) {
      this._updateMicUI(true);
      this._startLevelMonitor();
    }
    micBtn.addEventListener('click', () => this._toggleMic());
    leftStack.appendChild(micBtn);

    this._leftStack = leftStack;
    panel.appendChild(leftStack);

    // --- Right floating stack ---
    const rightStack = document.createElement('div');
    rightStack.className = 'cam-float cam-float-right';

    // Mic gain slider (only visible when mic is active)
    const gainSliderComp = createVerticalSlider({
      icon: '🎤',
      min: 0.5,
      max: 10,
      step: 0.5,
      value: app?.mic.gainValue ?? 3.0,
      className: 'cam-gain-slider-wrap',
      onChange: (val) => {
        if (this._app) this._app.setMicGain(val);
      },
    });
    this._gainSlider = gainSliderComp;
    gainSliderComp.setVisible(!!app?.mic.active);
    rightStack.appendChild(gainSliderComp.wrap);

    // Intensity slider (global turbulence)
    const intensitySliderComp = createVerticalSlider({
      icon: '✦',
      min: 0,
      max: 2,
      step: 0.05,
      value: this._globalIntensity,
      onChange: (val) => {
        this._globalIntensity = val;
      },
    });
    this._intensitySlider = intensitySliderComp;
    rightStack.appendChild(intensitySliderComp.wrap);

    this._rightStack = rightStack;
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

    // Randomize button (dice icon, matching cam-fbtn style)
    const randomBtn = this._makeFloatBtn('🎲', 'Randomize');
    randomBtn.addEventListener('click', () => {
      this.engine._randomizeAllLayersInternal();
      if (this._presetSelect) this._presetSelect.value = '';
    });
    bottomBar.appendChild(randomBtn);

    this._bottomBar = bottomBar;
    panel.appendChild(bottomBar);

    // Track all floating elements for hide/show
    this._floatingEls = [leftStack, rightStack, bottomBar];

    // Mic state callback
    this._micStateHandler = (state, err) => {
      if (state === 'error') {
        this._showError(err?.name === 'NotAllowedError' ? 'Mic access denied' : 'Mic unavailable');
        this._updateMicUI(false);
        this._stopLevelMonitor();
        this._gainSlider?.setVisible(false);
      } else {
        this._updateMicUI(state);
        this._gainSlider?.setVisible(!!state);
        if (state) this._startLevelMonitor();
        else this._stopLevelMonitor();
      }
    };
    if (app) app.mic.onStateChange = this._micStateHandler;

    // --- Orientation change handler ---
    this._applyOrientationLayout();
    this._orientationDebounce = null;
    this._orientationHandler = () => {
      clearTimeout(this._orientationDebounce);
      this._orientationDebounce = setTimeout(() => this._applyOrientationLayout(), 200);
    };
    window.addEventListener('resize', this._orientationHandler);
    window.addEventListener('orientationchange', this._orientationHandler);
  }

  _makeFloatBtn(icon, title) {
    const btn = document.createElement('button');
    btn.className = 'cam-fbtn';
    btn.innerHTML = icon;
    btn.title = title;
    return btn;
  }

  // --- Orientation layout (same pattern as Camera mode) ---

  _applyOrientationLayout() {
    if (!this.panelEl) return;

    const isLandscape = window.innerWidth > window.innerHeight;
    this.panelEl.classList.toggle('cam-landscape', isLandscape);

    const insets = this._getSafeAreaInsets();

    if (this._leftStack) {
      this._leftStack.style.left = `${Math.max(insets.left, 12) + 8}px`;
    }
    if (this._rightStack) {
      this._rightStack.style.right = `${Math.max(insets.right, 12) + 8}px`;
    }
    if (this._bottomBar) {
      this._bottomBar.style.paddingLeft = `${Math.max(insets.left, 12) + 16}px`;
      this._bottomBar.style.paddingRight = `${Math.max(insets.right, 12) + 16}px`;
      this._bottomBar.style.paddingBottom = `${Math.max(insets.bottom, 8) + 8}px`;
    }

    if (isLandscape && this._leftStack && this._rightStack) {
      this._leftStack.style.top = '45%';
      this._rightStack.style.top = '45%';
    } else if (this._leftStack && this._rightStack) {
      this._leftStack.style.top = '50%';
      this._rightStack.style.top = '50%';
    }
  }

  _getSafeAreaInsets() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);pointer-events:none;visibility:hidden;z-index:-1;';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const insets = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    probe.remove();
    return insets;
  }

  // --- UI visibility (tap to hide/show) ---

  setUIHidden(hidden) {
    this._floatingEls.forEach(el => {
      el.classList.toggle('cam-hidden', hidden);
    });
  }

  destroyPanel() {
    this._stopLevelMonitor();
    // Do NOT stop the mic — it persists across mode switches
    if (this._app) this._app.mic.onStateChange = null;
    if (this._orientationHandler) {
      window.removeEventListener('resize', this._orientationHandler);
      window.removeEventListener('orientationchange', this._orientationHandler);
      this._orientationHandler = null;
    }
    if (this.panelEl) { this.panelEl.remove(); this.panelEl = null; }
    this._floatingEls = [];
    this._leftStack = null;
    this._rightStack = null;
    this._bottomBar = null;
    this._micBtn = null;
    this._presetSelect = null;
    this._gainSlider = null;
    this._intensitySlider = null;
    this._controlPanelEl?.classList.remove('ll-active', 'll-ui-hidden');
  }

  // --- Mic ---

  async _toggleMic() {
    if (!this._app) return;
    await this._app.toggleMic();
  }

  _updateMicUI(active) {
    if (!this._micBtn) return;
    this._micBtn.classList.toggle('mic-active', !!active);
    if (!active) this._micBtn.style.removeProperty('--mic-level');
    // Update gain slider value when mic reconnects
    if (active && this._gainSlider && this._app) {
      this._gainSlider.slider.value = this._app.mic.gainValue;
    }
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

  _showError(msg) {
    if (!this.panelEl) return;
    const el = document.createElement('div');
    el.className = 'cam-error';
    el.textContent = msg;
    this.panelEl.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}
