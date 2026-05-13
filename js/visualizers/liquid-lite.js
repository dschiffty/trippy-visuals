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
    // Load Rainbow RPM as the default preset on start
    const londonTube = LL_PRESETS.find(p => p.id === 'rainbow-rpm');
    const defaultPreset = londonTube || LL_PRESETS[0];
    if (defaultPreset) {
      this._currentPresetId = defaultPreset.id;
      this.engine.setState(JSON.parse(JSON.stringify(defaultPreset.vizState)));
    }
    this._app = null;
    this._micBtn = null;
    this._micLevelRAF = null;
    this._globalIntensity = 1.0;
    this._liteSpeed = 1.0;
    this._floatingEls = [];
    this._leftStack = null;
    this._rightStack = null;
    this._bottomBar = null;
    this._orientationHandler = null;
    this._orientationDebounce = null;
    this._gainSlider = null;
    this._speedSlider = null;
    this._backBtn = null;
    this._fwdBtn = null;
    this._snapBtn = null;

    // History stack for Back/Forward (stores last 10 states)
    this._liteHistory = [{
      state: JSON.stringify(this.engine.getState()),
      presetId: this._currentPresetId,
    }];
    this._liteHistoryIdx = 0;
  }

  draw(freq, time) {
    // Temporarily apply master speed multiplier to global speed
    const savedGlobalSpeed = this.engine.globals.speed;
    if (this._liteSpeed !== 1.0) {
      this.engine.globals.speed = savedGlobalSpeed * this._liteSpeed;
    }

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

    // Restore global speed
    if (this._liteSpeed !== 1.0) {
      this.engine.globals.speed = savedGlobalSpeed;
    }
  }

  reset() { this.engine.reset(); }
  getState() { return this.engine.getState(); }
  setState(s) { this.engine.setState(s); }
  setParam(k, v) { this.engine.setParam?.(k, v); }

  // --- History ---

  _pushLiteHistory() {
    // Truncate any forward states
    this._liteHistory = this._liteHistory.slice(0, this._liteHistoryIdx + 1);
    this._liteHistory.push({
      state: JSON.stringify(this.engine.getState()),
      presetId: this._currentPresetId,
    });
    // Keep max 10
    if (this._liteHistory.length > 10) this._liteHistory.shift();
    this._liteHistoryIdx = this._liteHistory.length - 1;
    this._updateNavBtns();
  }

  _updateNavBtns() {
    if (this._backBtn) this._backBtn.disabled = this._liteHistoryIdx <= 0;
    if (this._fwdBtn)  this._fwdBtn.disabled  = this._liteHistoryIdx >= this._liteHistory.length - 1;
  }

  _liteBack() {
    if (this._liteHistoryIdx <= 0) return;
    this._liteHistoryIdx--;
    this._restoreFromHistory();
  }

  _liteFwd() {
    if (this._liteHistoryIdx >= this._liteHistory.length - 1) return;
    this._liteHistoryIdx++;
    this._restoreFromHistory();
  }

  _restoreFromHistory() {
    const entry = this._liteHistory[this._liteHistoryIdx];
    if (!entry) return;
    this.engine.setState(JSON.parse(entry.state));
    this._currentPresetId = entry.presetId;
    if (this._presetSelect) this._presetSelect.value = entry.presetId || '';
    this._updateNavBtns();
  }

  // --- Download / Share ---

  async _downloadJSON() {
    const vizState = this.engine.getState();
    const data = {
      name: `Liquid Lite — ${new Date().toLocaleString()}`,
      date: new Date().toISOString(),
      state: { preset: 'liquidShow', vizState },
      version: 1,
    };
    const json = JSON.stringify(data, null, 2);
    const filename = `visualizer-liquid-lite-${Date.now()}.json`;
    const blob = new Blob([json], { type: 'application/json' });

    // iOS: use native share sheet (lets user save to Files, Messages, etc.)
    if (navigator.canShare) {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return; // user cancelled — no fallback needed
        }
      }
    }

    // Fallback: standard download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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

    // Master speed slider (0.1× slow → 2× fast)
    const speedSliderComp = createVerticalSlider({
      icon: '⚡',
      min: 0.1,
      max: 2,
      step: 0.05,
      value: this._liteSpeed,
      onChange: (val) => {
        this._liteSpeed = val;
      },
    });
    this._speedSlider = speedSliderComp;
    rightStack.appendChild(speedSliderComp.wrap);

    this._rightStack = rightStack;
    panel.appendChild(rightStack);

    // --- Bottom bar ---
    const bottomBar = document.createElement('div');
    bottomBar.className = 'cam-bottom-bar';

    // Preset dropdown
    const presetSelector = LiquidShowVisualizer.buildPresetSelector(state => {
      this.engine.setState(state);
      this._pushLiteHistory();
    });
    this._presetSelect = presetSelector.querySelector('select');
    if (this._presetSelect) {
      if (this._currentPresetId) this._presetSelect.value = this._currentPresetId;
      // Track current preset ID for history
      this._presetSelect.addEventListener('change', () => {
        this._currentPresetId = this._presetSelect.value || null;
      });
    }
    presetSelector.className = 'cam-preset-wrap';
    bottomBar.appendChild(presetSelector);

    // Randomize button
    const randomBtn = this._makeFloatBtn('🎲', 'Randomize');
    randomBtn.addEventListener('click', () => {
      this.engine._randomizeAllLayersInternal();
      this._currentPresetId = null;
      if (this._presetSelect) this._presetSelect.value = '';
      this._pushLiteHistory();
    });
    bottomBar.appendChild(randomBtn);

    // Back button
    const backBtn = this._makeFloatBtn('←', 'Back');
    backBtn.classList.add('cam-nav-btn');
    this._backBtn = backBtn;
    backBtn.addEventListener('click', () => this._liteBack());
    bottomBar.appendChild(backBtn);

    // Forward button
    const fwdBtn = this._makeFloatBtn('→', 'Forward');
    fwdBtn.classList.add('cam-nav-btn');
    this._fwdBtn = fwdBtn;
    fwdBtn.addEventListener('click', () => this._liteFwd());
    bottomBar.appendChild(fwdBtn);

    // Download / share button
    const dlBtn = this._makeFloatBtn('⬇', 'Download');
    dlBtn.addEventListener('click', () => this._downloadJSON());
    bottomBar.appendChild(dlBtn);

    // Snapshot button — captures full-resolution PNG via native share sheet (iOS) or download
    const snapBtn = this._makeFloatBtn('📷', 'Snapshot');
    this._snapBtn = snapBtn;
    snapBtn.addEventListener('click', async () => {
      if (!this._app) return;
      snapBtn.innerHTML = '⏳';
      snapBtn.disabled = true;
      try {
        const label = this._currentPresetId
          ? (LL_PRESETS.find(p => p.id === this._currentPresetId)?.name ?? 'liquid-lite')
          : 'liquid-lite';
        await this._app.takeSnapshot(label.replace(/\s+/g, '-').toLowerCase());
      } finally {
        snapBtn.innerHTML = '📷';
        snapBtn.disabled = false;
      }
    });
    bottomBar.appendChild(snapBtn);

    // Sync button enabled states
    this._updateNavBtns();

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
      // Keep horizontal padding tight so all 5 buttons + preset selector fit
      // on narrow iPhones (375px) without squeezing. Safe-area insets still
      // respected (notch/home indicator); we just reduce the extra aesthetic gap.
      this._bottomBar.style.paddingLeft = `${Math.max(insets.left, 8) + 8}px`;
      this._bottomBar.style.paddingRight = `${Math.max(insets.right, 8) + 8}px`;
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
    this._speedSlider = null;
    this._backBtn = null;
    this._fwdBtn = null;
    this._snapBtn = null;
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
