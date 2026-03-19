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
  }

  // --- Delegate core methods to engine ---
  draw(freq, time) { this.engine.draw(freq, time); }
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
    if (this._onCanvasTap) {
      this.canvas.removeEventListener('click', this._onCanvasTap);
      this._onCanvasTap = null;
    }
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
    this._controlPanelEl?.classList.remove('ll-active', 'll-ui-hidden');
    this._uiHidden = false;
  }

  // --- Extensibility stubs for future features ---
  enableMicInput() { /* future: connect Web Audio mic source */ }
  enableTouchReactivity() { /* future: map touch events to reactive params */ }
  enableCameraFeed() { /* future: pipe camera as an image layer */ }
}
