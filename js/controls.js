export class ControlPanel {
  constructor(presetContainer, knobsContainer) {
    this.presetContainer = presetContainer;
    this.knobsContainer = knobsContainer;
    this.knobs = [];
    this.onPresetChange = null;
    this.onParamChange = null;
    this.dynamicEnabled = false;
    this._dynamicBtn = null;
  }

  setupPresets(presets, defaultPreset) {
    this.presetContainer.innerHTML = '';
    presets.forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.textContent = label;
      btn.dataset.preset = key;
      if (key === defaultPreset) btn.classList.add('active');

      btn.addEventListener('click', () => {
        this.presetContainer
          .querySelectorAll('.preset-btn')
          .forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.onPresetChange) this.onPresetChange(key);
      });

      this.presetContainer.appendChild(btn);
    });
  }

  setVisualizer(vizClass) {
    this.knobsContainer.innerHTML = '';
    this.knobs = [];
    this.dynamicEnabled = false;
    this._dynamicBtn = null;

    // Remove old toolbar
    const existingToolbar = this.knobsContainer.parentElement?.querySelector('.param-toolbar');
    if (existingToolbar) existingToolbar.remove();

    const params = vizClass.params;
    params.forEach((param) => {
      if (param.type === 'stepper') {
        this.createStepper(param);
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'knob-wrapper';

      const knob = document.createElement('div');
      knob.className = 'knob';

      const indicator = document.createElement('div');
      indicator.className = 'knob-indicator';
      knob.appendChild(indicator);

      const label = document.createElement('div');
      label.className = 'knob-label';
      label.textContent = param.label;

      const valueDisplay = document.createElement('div');
      valueDisplay.className = 'knob-value';

      // Dynamic mode indicator (hidden until dynamic is enabled)
      const dynIndicator = document.createElement('div');
      dynIndicator.className = 'knob-dynamic-dot';
      dynIndicator.title = 'Toggle dynamic';
      dynIndicator.style.display = 'none';

      wrapper.appendChild(knob);
      wrapper.appendChild(label);
      wrapper.appendChild(valueDisplay);
      wrapper.appendChild(dynIndicator);
      this.knobsContainer.appendChild(wrapper);

      const knobData = {
        element: knob,
        valueDisplay,
        dynIndicator,
        param,
        value: param.default,
        baseValue: param.default,
        dynamic: false,
        dynamicPhase: Math.random() * Math.PI * 2,
        dynamicFreq: 0.08 + Math.random() * 0.12,
      };
      this.knobs.push(knobData);

      dynIndicator.addEventListener('click', () => {
        knobData.dynamic = !knobData.dynamic;
        dynIndicator.classList.toggle('active', knobData.dynamic);
        if (!knobData.dynamic) {
          // Snap back to base value
          knobData.value = knobData.baseValue;
          this.updateKnobVisual(knobData);
          if (this.onParamChange) this.onParamChange(param.key, knobData.value);
        }
      });

      this.updateKnobVisual(knobData);
      this.attachKnobEvents(knobData);
    });

    // Add toolbar with Randomize + Dynamic buttons
    if (params.length > 0) {
      this._addToolbar();
    }
  }

  _addToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'param-toolbar';

    const randomBtn = document.createElement('button');
    randomBtn.className = 'param-tool-btn';
    randomBtn.innerHTML = '\u{1F3B2} Randomize';
    randomBtn.addEventListener('click', () => this.randomize());

    const dynamicBtn = document.createElement('button');
    dynamicBtn.className = 'param-tool-btn';
    dynamicBtn.textContent = '\u2726 Dynamic';
    dynamicBtn.addEventListener('click', () => this.toggleDynamic());
    this._dynamicBtn = dynamicBtn;

    toolbar.appendChild(randomBtn);
    toolbar.appendChild(dynamicBtn);
    this.knobsContainer.parentElement.appendChild(toolbar);
  }

  syncValues(values) {
    // Update control panel knobs to match visualizer's current values
    this.knobs.forEach((knobData) => {
      const val = values[knobData.param.key];
      if (val === undefined) return;
      knobData.value = val;
      if (knobData.type !== 'stepper') knobData.baseValue = val;
      if (knobData.type === 'stepper') {
        if (knobData.valueEl) {
          const fmt = knobData.param.formatValue;
          knobData.valueEl.textContent = fmt ? fmt(val) : val;
        }
      } else {
        this.updateKnobVisual(knobData);
      }
    });
  }

  randomize() {
    this.knobs.forEach((knobData) => {
      if (knobData.type === 'stepper') {
        const range = knobData.param.max - knobData.param.min;
        const steps = range / knobData.param.step;
        const randomStep = Math.floor(Math.random() * (steps + 1));
        knobData.value = knobData.param.min + randomStep * knobData.param.step;
        knobData.value = Math.min(knobData.param.max, knobData.value);
        knobData.valueEl.textContent = knobData.value;
        if (this.onParamChange) this.onParamChange(knobData.param.key, knobData.value);
        return;
      }

      const { param } = knobData;
      const range = param.max - param.min;
      let newValue = param.min + Math.random() * range;
      newValue = Math.round(newValue / param.step) * param.step;
      newValue = Math.max(param.min, Math.min(param.max, newValue));
      knobData.value = newValue;
      knobData.baseValue = newValue;
      this.updateKnobVisual(knobData);
      if (this.onParamChange) this.onParamChange(param.key, newValue);
    });
  }

  toggleDynamic() {
    this.dynamicEnabled = !this.dynamicEnabled;
    if (this._dynamicBtn) {
      this._dynamicBtn.classList.toggle('active', this.dynamicEnabled);
    }

    this.knobs.forEach((k) => {
      if (k.type === 'stepper') return;
      if (k.dynIndicator) {
        k.dynIndicator.style.display = this.dynamicEnabled ? '' : 'none';
        if (this.dynamicEnabled) {
          k.dynamic = true;
          k.baseValue = k.value;
          k.dynIndicator.classList.add('active');
        } else {
          k.dynamic = false;
          k.dynIndicator.classList.remove('active');
          k.value = k.baseValue;
          this.updateKnobVisual(k);
          if (this.onParamChange) this.onParamChange(k.param.key, k.value);
        }
      }
    });
  }

  updateDynamic(timestamp) {
    if (!this.dynamicEnabled) return;
    const time = timestamp / 1000;

    this.knobs.forEach((k) => {
      if (k.type === 'stepper' || !k.dynamic) return;
      const range = k.param.max - k.param.min;
      const amplitude = range * 0.2;
      const offset = Math.sin(time * k.dynamicFreq + k.dynamicPhase) * amplitude;
      let newValue = k.baseValue + offset;
      newValue = Math.max(k.param.min, Math.min(k.param.max, newValue));
      newValue = Math.round(newValue / k.param.step) * k.param.step;
      k.value = newValue;
      this.updateKnobVisual(k);
      if (this.onParamChange) this.onParamChange(k.param.key, newValue);
    });
  }

  createStepper(param) {
    const wrapper = document.createElement('div');
    wrapper.className = 'knob-wrapper';

    const stepper = document.createElement('div');
    stepper.className = 'stepper';

    const valueEl = document.createElement('div');
    valueEl.className = 'stepper-value';
    valueEl.textContent = param.default;

    const buttons = document.createElement('div');
    buttons.className = 'stepper-buttons';

    const upBtn = document.createElement('button');
    upBtn.className = 'stepper-btn stepper-up';
    upBtn.textContent = '\u25B2';

    const downBtn = document.createElement('button');
    downBtn.className = 'stepper-btn stepper-down';
    downBtn.textContent = '\u25BC';

    buttons.appendChild(upBtn);
    buttons.appendChild(downBtn);
    stepper.appendChild(valueEl);
    stepper.appendChild(buttons);

    const label = document.createElement('div');
    label.className = 'knob-label';
    label.textContent = param.label;

    wrapper.appendChild(stepper);
    wrapper.appendChild(label);
    this.knobsContainer.appendChild(wrapper);

    const data = { type: 'stepper', valueEl, param, value: param.default };
    this.knobs.push(data);

    upBtn.addEventListener('click', () => {
      if (data.value < param.max) {
        data.value += param.step;
        valueEl.textContent = data.value;
        if (this.onParamChange) this.onParamChange(param.key, data.value);
      }
    });

    downBtn.addEventListener('click', () => {
      if (data.value > param.min) {
        data.value -= param.step;
        valueEl.textContent = data.value;
        if (this.onParamChange) this.onParamChange(param.key, data.value);
      }
    });
  }

  updateKnobVisual(knobData) {
    const { element, valueDisplay, param, value } = knobData;
    const normalized = (value - param.min) / (param.max - param.min);
    const angle = -135 + normalized * 270;
    element.style.transform = `rotate(${angle}deg)`;

    // Format display value
    if (param.formatValue) {
      valueDisplay.textContent = param.formatValue(value);
    } else if (param.step >= 1) {
      valueDisplay.textContent = Math.round(value);
    } else if (param.step >= 0.1) {
      valueDisplay.textContent = value.toFixed(1);
    } else {
      valueDisplay.textContent = value.toFixed(2);
    }
  }

  attachKnobEvents(knobData) {
    const { element, param } = knobData;
    let startY = 0;
    let startValue = 0;

    const onStart = (e) => {
      e.preventDefault();
      startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      startValue = knobData.value;
      element.classList.add('active');

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    };

    const onMove = (e) => {
      e.preventDefault();
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const delta = (startY - clientY) / 150;
      const range = param.max - param.min;
      let newValue = startValue + delta * range;
      newValue = Math.max(param.min, Math.min(param.max, newValue));
      newValue = Math.round(newValue / param.step) * param.step;

      knobData.value = newValue;
      knobData.baseValue = newValue; // Update base for dynamic mode
      this.updateKnobVisual(knobData);
      if (this.onParamChange) {
        this.onParamChange(param.key, newValue);
      }
    };

    const onEnd = () => {
      element.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    element.addEventListener('mousedown', onStart);
    element.addEventListener('touchstart', onStart, { passive: false });

    // Double-click resets to default
    element.addEventListener('dblclick', () => {
      knobData.value = param.default;
      knobData.baseValue = param.default;
      this.updateKnobVisual(knobData);
      if (this.onParamChange) {
        this.onParamChange(param.key, param.default);
      }
    });
  }
}
