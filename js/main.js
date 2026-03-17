import { AudioCapture } from './audio.js';
import { OscilloscopeVisualizer } from './visualizers/oscilloscope.js';
import { SpectrumVisualizer } from './visualizers/spectrum.js';
import { LiquidLightsVisualizer } from './visualizers/liquid-lights.js';
import { LissajousVisualizer } from './visualizers/lissajous.js';
import { LiquidMetalVisualizer } from './visualizers/liquid-metal.js';
import { LiquidShowVisualizer } from './visualizers/liquid-show.js';
import { ITunesVisualizer } from './visualizers/itunes.js';
import { ControlPanel } from './controls.js';

const VIZ_CLASSES = {
  oscilloscope: OscilloscopeVisualizer,
  lissajous: LissajousVisualizer,
  spectrum: SpectrumVisualizer,
  liquid: LiquidLightsVisualizer,
  liquidMetal: LiquidMetalVisualizer,
  liquidShow: LiquidShowVisualizer,
  itunes: ITunesVisualizer,
};

class App {
  constructor() {
    this.canvas = document.getElementById('visualizer');
    this.audio = new AudioCapture();
    this.animationId = null;
    this.lastFpsTime = 0;
    this.frameCount = 0;
    this.targetFps = 60;
    this.lastFrameTime = 0;

    // Create visualizer instances
    this.visualizers = {};
    for (const [key, Cls] of Object.entries(VIZ_CLASSES)) {
      this.visualizers[key] = new Cls(this.canvas);
    }
    this.activeKey = 'oscilloscope';
    this.previousKey = null;
    this.activeVisualizer = this.visualizers.oscilloscope;

    // Controls
    this.controls = new ControlPanel(
      document.getElementById('preset-buttons'),
      document.getElementById('knobs-container'),
    );

    this.statusText = document.getElementById('status-text');
    this.statusFps = document.getElementById('status-fps');
    this.fpsText = document.getElementById('fps-text');
    this.overlay = document.getElementById('start-overlay');
    this.windowEl = document.querySelector('.window');
    this.fsHideTimer = null;

    this.setupControls();
    this.setupUI();
    this.setupFullscreenBehavior();
    this.setupFpsDropdown();
    this.resizeCanvas();
    this.drawIdleScreen();

    // Responsive canvas
    const ro = new ResizeObserver(() => {
      this.resizeCanvas();
      if (!this.audio.isCapturing) this.drawIdleScreen();
    });
    ro.observe(this.canvas.parentElement);
  }

  /* ---- Controls ---- */

  setupControls() {
    const presets = Object.entries(VIZ_CLASSES).map(([key, Cls]) => ({
      key,
      label: Cls.label,
    }));

    this.controls.setupPresets(presets, this.activeKey);
    this.controls.setVisualizer(VIZ_CLASSES[this.activeKey]);

    this.controls.onPresetChange = (key) => {
      this.switchPreset(key);
    };

    this.controls.onParamChange = (paramKey, value) => {
      this.activeVisualizer.setParam(paramKey, value);
    };
  }

  switchPreset(key) {
    // Tear down previous custom panel if it existed
    if (this.activeVisualizer && this.activeVisualizer.destroyPanel) {
      this.activeVisualizer.destroyPanel();
      document.querySelector('.params-group').style.display = '';
    }

    this.previousKey = this.activeKey;
    this.activeKey = key;
    this.activeVisualizer = this.visualizers[key];

    if (this.activeVisualizer.buildPanel) {
      // Custom panel mode — hook up callbacks before building
      this.activeVisualizer.onBack = () => {
        const target = this.previousKey && this.previousKey !== key ? this.previousKey : 'oscilloscope';
        this.switchPreset(target);
        this.controls.setupPresets(
          Object.entries(VIZ_CLASSES).map(([k, C]) => ({ key: k, label: C.label })),
          target,
        );
      };
      this.activeVisualizer.onFullscreen = () => this.toggleFullscreen();
      document.querySelector('.params-group').style.display = 'none';
      this.activeVisualizer.buildPanel(document.querySelector('.control-panel'));
    } else {
      this.controls.setVisualizer(VIZ_CLASSES[key]);
    }

    this.activeVisualizer.reset();

    // Re-bind param changes to new visualizer
    this.controls.onParamChange = (paramKey, value) => {
      this.activeVisualizer.setParam(paramKey, value);
    };
  }

  /* ---- UI Events ---- */

  setupUI() {
    // Mobile detection
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    if (isMobile) {
      document.getElementById('mobile-warning')?.classList.remove('hidden');
      document.getElementById('desktop-content')?.style.setProperty('display', 'none');
    }

    // Start button
    document.getElementById('start-btn').addEventListener('click', () => this.startCapture());

    // Demo audio player
    const demoBtn = document.getElementById('demo-btn');
    const demoAudio = document.getElementById('demo-audio');
    if (demoBtn && demoAudio) {
      demoBtn.addEventListener('click', () => {
        if (demoAudio.paused) {
          demoAudio.play();
          demoBtn.textContent = '⏸ Pause Demo';
          demoBtn.classList.add('playing');
        } else {
          demoAudio.pause();
          demoBtn.textContent = '🎵 Play Demo Track';
          demoBtn.classList.remove('playing');
        }
      });
      demoAudio.addEventListener('ended', () => {
        demoBtn.textContent = '🎵 Play Demo Track';
        demoBtn.classList.remove('playing');
      });
    }

    // Help modal
    const helpModal = document.getElementById('help-modal');
    document.getElementById('help-link')?.addEventListener('click', () => {
      helpModal.classList.remove('hidden');
    });
    document.getElementById('help-modal-close')?.addEventListener('click', () => {
      helpModal.classList.add('hidden');
    });
    helpModal?.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.classList.add('hidden');
    });

    // Menu actions
    document.getElementById('start-capture')?.addEventListener('click', () => this.startCapture());
    document.getElementById('stop-capture')?.addEventListener('click', () => this.stopCapture());
    document.getElementById('fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('maximize-btn')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('about')?.addEventListener('click', () => this.showAbout());
    document.getElementById('save-config')?.addEventListener('click', () => this.saveConfig());
    document.getElementById('load-config')?.addEventListener('click', () => this.showLoadDialog());
    document.getElementById('manage-configs')?.addEventListener('click', () => this.showManageDialog());

    // Preset menu items
    document.querySelectorAll('.preset-menu').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.dataset.preset;
        this.switchPreset(key);
        // Sync the preset buttons
        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
        const match = document.querySelector(`.preset-btn[data-preset="${key}"]`);
        if (match) match.classList.add('active');
      });
    });

    // Menu bar open/close
    this.setupMenuBar();

    // Audio stop callback
    this.audio.onStop = () => {
      this.overlay.classList.remove('hidden');
      this.statusText.textContent = 'Capture ended';
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    };
  }

  setupMenuBar() {
    const menuItems = document.querySelectorAll('.menu-item');
    let activeMenu = null;

    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeMenu === item) {
          item.classList.remove('open');
          activeMenu = null;
        } else {
          menuItems.forEach((m) => m.classList.remove('open'));
          item.classList.add('open');
          activeMenu = item;
        }
      });

      // Hover-switch while a menu is open
      item.addEventListener('mouseenter', () => {
        if (activeMenu && activeMenu !== item) {
          menuItems.forEach((m) => m.classList.remove('open'));
          item.classList.add('open');
          activeMenu = item;
        }
      });
    });

    document.addEventListener('click', () => {
      menuItems.forEach((m) => m.classList.remove('open'));
      activeMenu = null;
    });

    // Close menu on option click
    document.querySelectorAll('.menu-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        menuItems.forEach((m) => m.classList.remove('open'));
        activeMenu = null;
      });
    });
  }

  /* ---- Capture ---- */

  async startCapture() {
    try {
      this.statusText.textContent = 'Starting capture...';
      await this.audio.start();
      this.overlay.classList.add('hidden');
      this.statusText.textContent = 'Capturing audio';
      this.activeVisualizer.reset();
      this.startAnimation();
    } catch (err) {
      this.statusText.textContent = err.message || 'Capture failed';
    }
  }

  stopCapture() {
    this.audio.stop();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.overlay.classList.remove('hidden');
    this.statusText.textContent = 'Stopped';
    this.drawIdleScreen();
  }

  /* ---- Animation ---- */

  startAnimation() {
    const animate = (timestamp) => {
      this.animationId = requestAnimationFrame(animate);

      // Throttle to target FPS
      const frameInterval = 1000 / this.targetFps;
      if (timestamp - this.lastFrameTime < frameInterval) return;
      this.lastFrameTime = timestamp - ((timestamp - this.lastFrameTime) % frameInterval);

      // FPS counter
      this.frameCount++;
      if (timestamp - this.lastFpsTime >= 1000) {
        this.fpsText.textContent = `${this.frameCount} fps`;
        this.frameCount = 0;
        this.lastFpsTime = timestamp;
      }

      // Dynamic knob animation
      this.controls.updateDynamic(timestamp);
      if (this.activeVisualizer.updateDynamic) {
        this.activeVisualizer.updateDynamic(timestamp);
      }

      if (!this.audio.isCapturing) return;

      const frequencyData = this.audio.getFrequencyData();
      const timeDomainData = this.audio.getTimeDomainData();
      this.activeVisualizer.draw(frequencyData, timeDomainData);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /* ---- Canvas ---- */

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  drawIdleScreen() {
    const ctx = this.canvas.getContext('2d');
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#050a05';
    ctx.fillRect(0, 0, w, h);

    // Dim grid
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 10, 0);
      ctx.lineTo((w * i) / 10, h);
      ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (h * i) / 8);
      ctx.lineTo(w, (h * i) / 8);
      ctx.stroke();
    }

    // Center text
    ctx.fillStyle = 'rgba(0, 255, 65, 0.25)';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NO SIGNAL', w / 2, h / 2);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  setupFullscreenBehavior() {
    // Show UI on mouse move, hide after 2s idle
    document.addEventListener('mousemove', () => {
      if (!document.fullscreenElement) return;
      this.windowEl.classList.add('show-ui');
      clearTimeout(this.fsHideTimer);
      this.fsHideTimer = setTimeout(() => {
        this.windowEl.classList.remove('show-ui');
      }, 2000);
    });

    // Toggle class on fullscreen change
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        this.windowEl.classList.add('fullscreen-mode');
        // Briefly show UI then hide
        this.windowEl.classList.add('show-ui');
        this.fsHideTimer = setTimeout(() => {
          this.windowEl.classList.remove('show-ui');
        }, 2000);
      } else {
        this.windowEl.classList.remove('fullscreen-mode', 'show-ui');
        clearTimeout(this.fsHideTimer);
      }
      // Re-fit canvas after layout change
      setTimeout(() => this.resizeCanvas(), 50);
    });
  }

  setupFpsDropdown() {
    const fpsEl = document.getElementById('status-fps');
    const dropdown = document.getElementById('fps-dropdown');

    fpsEl.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    dropdown.querySelectorAll('.fps-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        this.targetFps = parseInt(opt.dataset.fps);
        dropdown.querySelectorAll('.fps-option').forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');
        dropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
    });
  }

  showAbout() {
    alert(
      'Audio Visualizer v1.0\n\n' +
        'A retro-styled audio visualization tool.\n' +
        'Captures system audio via screen sharing.\n\n' +
        'Tip: Double-click a knob to reset it.',
    );
  }

  /* ---- Save / Load Configurations ---- */

  _getConfigs() {
    try {
      return JSON.parse(localStorage.getItem('viz-configs') || '[]');
    } catch { return []; }
  }

  _setConfigs(configs) {
    localStorage.setItem('viz-configs', JSON.stringify(configs));
  }

  _captureState() {
    const viz = this.activeVisualizer;
    const state = { preset: this.activeKey };

    // Capture standard knob values
    if (this.controls.knobs.length > 0 && !viz.buildPanel) {
      state.knobs = {};
      this.controls.knobs.forEach(k => {
        if (k.type === 'stepper') {
          state.knobs[k.param.key] = k.value;
        } else {
          state.knobs[k.param.key] = k.value;
        }
      });
    }

    // Capture custom state for visualizers that support it
    if (viz.getState) {
      state.vizState = viz.getState();
    }

    return state;
  }

  _applyState(state) {
    // Switch preset
    if (state.preset && state.preset !== this.activeKey) {
      this.switchPreset(state.preset);
      // Sync preset buttons
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      const match = document.querySelector(`.preset-btn[data-preset="${state.preset}"]`);
      if (match) match.classList.add('active');
    }

    const viz = this.activeVisualizer;

    // Apply standard knob values
    if (state.knobs && !viz.buildPanel) {
      this.controls.knobs.forEach(k => {
        const key = k.type === 'stepper' ? k.param.key : k.param.key;
        if (state.knobs[key] !== undefined) {
          k.value = state.knobs[key];
          k.baseValue = state.knobs[key];
          if (k.type === 'stepper') {
            k.valueEl.textContent = k.value;
          } else {
            this.controls.updateKnobVisual(k);
          }
          if (this.controls.onParamChange) {
            this.controls.onParamChange(key, k.value);
          }
        }
      });
    }

    // Apply custom state
    if (state.vizState && viz.setState) {
      viz.setState(state.vizState);
    }
  }

  saveConfig() {
    const name = prompt('Save configuration as:', `${VIZ_CLASSES[this.activeKey].label} — ${new Date().toLocaleString()}`);
    if (!name) return;

    const configs = this._getConfigs();
    configs.push({
      name,
      date: new Date().toISOString(),
      state: this._captureState(),
    });
    this._setConfigs(configs);
    this.statusText.textContent = `Saved: ${name}`;
  }

  showLoadDialog() {
    const configs = this._getConfigs();
    if (configs.length === 0) {
      alert('No saved configurations found.\n\nUse File → Save Configuration to save one.');
      return;
    }

    const dialog = this._createDialog('Load Configuration');
    const list = document.createElement('div');
    list.style.cssText = 'max-height:300px;overflow-y:auto;';

    configs.forEach((cfg, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:4px 8px;cursor:pointer;border-bottom:1px solid #555;display:flex;justify-content:space-between;align-items:center;';
      row.addEventListener('mouseenter', () => row.style.background = '#004080');
      row.addEventListener('mouseleave', () => row.style.background = '');

      const info = document.createElement('div');
      info.innerHTML = `<strong style="color:#fff">${cfg.name}</strong><br><span style="font-size:10px;color:#888">${cfg.state.preset} — ${new Date(cfg.date).toLocaleDateString()}</span>`;

      row.appendChild(info);
      row.addEventListener('click', () => {
        this._applyState(cfg.state);
        dialog.remove();
        this.statusText.textContent = `Loaded: ${cfg.name}`;
      });

      list.appendChild(row);
    });

    dialog.querySelector('.dialog-body').appendChild(list);
    document.body.appendChild(dialog);
  }

  showManageDialog() {
    const configs = this._getConfigs();
    if (configs.length === 0) {
      alert('No saved configurations to manage.');
      return;
    }

    const dialog = this._createDialog('Manage Configurations');
    const list = document.createElement('div');
    list.style.cssText = 'max-height:300px;overflow-y:auto;';

    const rebuild = () => {
      list.innerHTML = '';
      const current = this._getConfigs();
      if (current.length === 0) {
        list.innerHTML = '<div style="padding:12px;color:#888;text-align:center">No saved configurations</div>';
        return;
      }
      current.forEach((cfg, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:4px 8px;border-bottom:1px solid #555;display:flex;justify-content:space-between;align-items:center;';

        const info = document.createElement('span');
        info.innerHTML = `<strong style="color:#fff">${cfg.name}</strong> <span style="font-size:10px;color:#888">(${cfg.state.preset})</span>`;

        const delBtn = document.createElement('button');
        delBtn.textContent = '\u2715';
        delBtn.style.cssText = 'background:#800;color:#fff;border:1px solid #a00;padding:2px 6px;cursor:pointer;border-radius:2px;font-size:11px;';
        delBtn.addEventListener('click', () => {
          const c = this._getConfigs();
          c.splice(i, 1);
          this._setConfigs(c);
          rebuild();
        });

        row.appendChild(info);
        row.appendChild(delBtn);
        list.appendChild(row);
      });
    };
    rebuild();

    dialog.querySelector('.dialog-body').appendChild(list);
    document.body.appendChild(dialog);
  }

  _createDialog(title) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const box = document.createElement('div');
    box.style.cssText = 'background:#2a2a2a;border:2px outset #555;min-width:320px;max-width:480px;font-family:inherit;box-shadow:4px 4px 0 rgba(0,0,0,0.5);';

    const header = document.createElement('div');
    header.style.cssText = 'background:linear-gradient(90deg,#000080,#1084d0);color:#fff;padding:3px 6px;font-size:12px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;';
    header.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'background:#c0c0c0;border:1px outset #fff;padding:0 4px;cursor:pointer;font-size:11px;line-height:1.2;';
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.style.cssText = 'padding:0;color:#ccc;font-size:12px;';

    box.appendChild(header);
    box.appendChild(body);
    overlay.appendChild(box);

    return overlay;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
