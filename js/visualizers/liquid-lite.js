/* ============================================
   Liquid Lite — Mobile Preview Mode
   Wraps LiquidShowVisualizer with a simplified
   mobile-friendly control bar.
   ============================================ */

import { LiquidShowVisualizer } from './liquid-show.js';

export class LiquidLiteVisualizer {
  static get label() { return 'Liquid Lite'; }
  static get params() { return []; }
  static get mobileOnly() { return true; }

  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new LiquidShowVisualizer(canvas);
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
  }

  destroyPanel() {
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
    this._controlPanelEl?.classList.remove('ll-active');
  }

  // --- Extensibility stubs for future features ---
  enableMicInput() { /* future: connect Web Audio mic source */ }
  enableTouchReactivity() { /* future: map touch events to reactive params */ }
  enableCameraFeed() { /* future: pipe camera as an image layer */ }
}
