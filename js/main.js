import { AudioCapture } from './audio.js';
import { OscilloscopeVisualizer } from './visualizers/oscilloscope.js';
import { SpectrumVisualizer } from './visualizers/spectrum.js';
import { LiquidLightsVisualizer } from './visualizers/liquid-lights.js';
import { LissajousVisualizer } from './visualizers/lissajous.js';
import { LiquidMetalVisualizer } from './visualizers/liquid-metal.js';
import { LiquidShowVisualizer } from './visualizers/liquid-show.js';
import { ITunesVisualizer } from './visualizers/itunes.js';
import { LiquidLiteVisualizer } from './visualizers/liquid-lite.js';
import { ControlPanel } from './controls.js';

const VIZ_CLASSES = {
  liquidLite: LiquidLiteVisualizer,
  oscilloscope: OscilloscopeVisualizer,
  lissajous: LissajousVisualizer,
  spectrum: SpectrumVisualizer,
  liquid: LiquidLightsVisualizer,
  liquidMetal: LiquidMetalVisualizer,
  liquidShow: LiquidShowVisualizer,
  itunes: ITunesVisualizer,
};

// Modes hidden on mobile (only Liquid Lite, Oscilloscope, Lissajous shown)
const DESKTOP_ONLY_MODES = new Set(['spectrum', 'liquid', 'liquidMetal', 'liquidShow', 'itunes']);

class App {
  constructor() {
    this.canvas = document.getElementById('visualizer');
    this.audio = new AudioCapture();
    this.animationId = null;
    this.lastFpsTime = 0;
    this.frameCount = 0;
    this.targetFps = 60;
    this.lastFrameTime = 0;

    // Adaptive quality system
    this._qualityScale = 1.0;       // 1.0 = full CSS resolution, 0.5 = half
    this._qualityFpsHistory = [];    // rolling FPS samples for adaptive decisions
    this._qualityLowSince = 0;      // timestamp when FPS first dropped below threshold
    this._qualityHighSince = 0;     // timestamp when FPS first exceeded high threshold

    // Shared mic input state (persists across mode switches)
    this.mic = {
      active: false,
      stream: null,
      context: null,
      source: null,
      gainNode: null,
      analyser: null,
      freqData: null,
      timeData: null,
      gainValue: 3.0,
      levelRAF: null,
      level: 0,
      onStateChange: null, // callback for panel UI updates (set by Liquid Lite)
    };
    window.addEventListener('beforeunload', () => this.stopMic());

    // Create visualizer instances
    this.visualizers = {};
    for (const [key, Cls] of Object.entries(VIZ_CLASSES)) {
      this.visualizers[key] = new Cls(this.canvas);
    }
    // Default to Liquid Lite on mobile, Liquid Lights on desktop
    const isMobileDevice = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    const defaultKey = isMobileDevice ? 'liquidLite' : 'liquidShow';
    this.activeKey = defaultKey;
    this.previousKey = null;
    this.activeVisualizer = this.visualizers[defaultKey];

    // Set Lissajous demo defaults: random shape 3-9, multi-color hue
    const lissajous = this.visualizers.lissajous;
    if (lissajous) {
      lissajous.setParam('shape', 3 + Math.floor(Math.random() * 7)); // 3-9
      lissajous.setParam('hue', 365); // >360 = multi-color mode
    }

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

    // Pre-warm all renderers to avoid JIT compilation stalls
    this._preWarmRenderers();

    // Start visual demo immediately so the app feels alive on load
    this.startAnimation();

    // Responsive canvas
    const ro = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    ro.observe(this.canvas.parentElement);

    // Handle orientation changes on mobile (Safari doesn't always fire ResizeObserver)
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resizeCanvas(), 100);
      setTimeout(() => this.resizeCanvas(), 300);
    });
    window.addEventListener('resize', () => this.resizeCanvas());

    // Debug HUD (activated via ?debug=true)
    if (new URLSearchParams(window.location.search).get('debug') === 'true') {
      this._setupDebugHUD();
    }
  }

  /* ---- Controls ---- */

  setupControls() {
    const presets = Object.entries(VIZ_CLASSES).map(([key, Cls]) => ({
      key,
      label: Cls.label,
      mobileOnly: !!Cls.mobileOnly,
      desktopOnly: DESKTOP_ONLY_MODES.has(key),
    }));

    this.controls.setupPresets(presets, this.activeKey);

    this.controls.onPresetChange = (key) => {
      this.switchPreset(key);
    };

    this.controls.onParamChange = (paramKey, value) => {
      this.activeVisualizer.setParam(paramKey, value);
    };

    // Build the initial visualizer panel (supports custom panels like Liquid Lights)
    this.switchPreset(this.activeKey);
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
          Object.entries(VIZ_CLASSES).map(([k, C]) => ({ key: k, label: C.label, mobileOnly: !!C.mobileOnly, desktopOnly: DESKTOP_ONLY_MODES.has(k) })),
          target,
        );
      };
      this.activeVisualizer.onFullscreen = () => this.toggleFullscreen();
      document.querySelector('.params-group').style.display = 'none';
      this.activeVisualizer.buildPanel(document.querySelector('.control-panel'), this);
    } else {
      this.controls.setVisualizer(VIZ_CLASSES[key]);
      // Sync control panel knobs to the visualizer's current values
      // (which may differ from class defaults, e.g. demo mode presets)
      if (this.activeVisualizer.values) {
        this.controls.syncValues(this.activeVisualizer.values);
      }
    }

    this.activeVisualizer.reset();

    // Re-bind param changes to new visualizer
    this.controls.onParamChange = (paramKey, value) => {
      this.activeVisualizer.setParam(paramKey, value);
    };

    // Show/hide floating mic button on mobile
    this._updateFloatingMicVisibility();
    // Reset UI visibility on mode switch
    if (this.isMobile) {
      this._mobileUIHidden = false;
      document.querySelector('.control-panel')?.classList.remove('mobile-ui-hidden', 'll-ui-hidden');
      document.querySelector('.ll-lite-panel')?.classList.remove('ll-ui-hidden');
      this._floatingMicBtn?.classList.remove('mobile-ui-hidden');
    }
  }

  /* ---- UI Events ---- */

  setupUI() {
    // Mobile detection
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    this.isMobile = isMobile;
    if (isMobile) {
      // Skip overlay — go straight to Liquid Lite
      this.overlay.classList.add('hidden');
      // Create floating mic button for modes without a built-in mic toggle
      this._createFloatingMic();
      // Tap canvas to toggle UI on all mobile modes
      this._mobileUIHidden = false;
      this.canvas.addEventListener('click', (e) => {
        if (e.target.closest('.ll-lite-panel, .ll-gain-popover, .floating-mic, .control-panel button, .control-panel select, .floating-gain-popover')) return;
        this._mobileUIHidden = !this._mobileUIHidden;
        this._updateMobileUIVisibility();
      });

      // Screen Wake Lock — keep display on while visualizer is active
      this._setupWakeLock();
    }

    // Start button
    document.getElementById('start-btn').addEventListener('click', () => this.startCapture());

    // Demo audio player
    const demoBtn = document.getElementById('demo-btn');
    const demoAudio = document.getElementById('demo-audio');
    const demoMini = document.getElementById('demo-mini');
    const demoMiniBtn = document.getElementById('demo-mini-btn');

    const updateDemoUI = () => {
      const playing = !demoAudio.paused;
      demoBtn.textContent = playing ? '⏸ Pause Demo' : '🎵 Play Demo Track';
      demoBtn.classList.toggle('playing', playing);
      if (demoMiniBtn) demoMiniBtn.textContent = playing ? '⏸' : '▶';
    };

    if (demoBtn && demoAudio) {
      demoBtn.addEventListener('click', () => {
        demoAudio.paused ? demoAudio.play() : demoAudio.pause();
      });
      demoAudio.addEventListener('play', updateDemoUI);
      demoAudio.addEventListener('pause', updateDemoUI);

      // Prevent hardware media keys from controlling the demo track
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        demoAudio.addEventListener('play', () => {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
        });
      }
    }

    if (demoMiniBtn && demoAudio) {
      demoMiniBtn.addEventListener('click', () => {
        demoAudio.paused ? demoAudio.play() : demoAudio.pause();
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
    document.getElementById('export-config')?.addEventListener('click', () => this.exportConfig());
    document.getElementById('import-config')?.addEventListener('click', () => this.importConfig());

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
      // Animation loop is already running from startup; no need to restart
      if (!this.animationId) this.startAnimation();
    } catch (err) {
      this.statusText.textContent = err.message || 'Capture failed';
    }
  }

  stopCapture() {
    this.audio.stop();
    this.overlay.classList.remove('hidden');
    this.statusText.textContent = 'Stopped';
    // Keep animation loop running so the visual demo plays behind the overlay
    if (!this.animationId) {
      this.startAnimation();
    }
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
        const currentFps = this.frameCount;
        this.fpsText.textContent = `${currentFps} fps`;
        this._adaptiveQualityUpdate(currentFps, timestamp);
        this.frameCount = 0;
        this.lastFpsTime = timestamp;
      }

      // Debug HUD
      if (this._debugHUD) this._updateDebugHUD(timestamp);

      // Dynamic knob animation
      this.controls.updateDynamic(timestamp);
      if (this.activeVisualizer.updateDynamic) {
        this.activeVisualizer.updateDynamic(timestamp);
      }

      let frequencyData, timeDomainData;
      if (this.mic.active && this.mic.analyser) {
        // Mic input takes priority — apply secondary smoothing for stable visuals
        this.mic.analyser.getByteFrequencyData(this.mic.freqData);
        this.mic.analyser.getByteTimeDomainData(this.mic.timeData);
        const sf = this.mic.smoothedFreq;
        const st = this.mic.smoothedTime;
        const alpha = 0.15; // blend factor: lower = smoother
        for (let i = 0; i < this.mic.freqData.length; i++) {
          sf[i] += (this.mic.freqData[i] - sf[i]) * alpha;
          this.mic.freqData[i] = sf[i];
        }
        for (let i = 0; i < this.mic.timeData.length; i++) {
          st[i] += (this.mic.timeData[i] - st[i]) * 0.3;
          this.mic.timeData[i] = st[i];
        }
        frequencyData = this.mic.freqData;
        timeDomainData = this.mic.timeData;
      } else if (this.audio.isCapturing) {
        frequencyData = this.audio.getFrequencyData();
        timeDomainData = this.audio.getTimeDomainData();
      } else {
        // Generate synthetic "music" data for demo mode
        const synth = this._generateSyntheticAudio(timestamp);
        frequencyData = synth.frequency;
        timeDomainData = synth.timeDomain;
      }
      this.activeVisualizer.draw(frequencyData, timeDomainData);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /* ---- Synthetic Audio for Demo Mode ---- */

  _generateSyntheticAudio(timestamp) {
    const t = timestamp / 1000;
    const bins = 1024;

    // Reuse typed arrays
    if (!this._synthFreq) {
      this._synthFreq = new Uint8Array(bins);
      this._synthTime = new Uint8Array(bins);
    }
    const freq = this._synthFreq;
    const time = this._synthTime;

    // Simulate music-like frequency spectrum with evolving rhythmic pulses
    // Slow "beat" envelopes at different rates
    const beat1 = Math.pow(Math.max(0, Math.sin(t * 2.2)), 4);       // ~132 bpm kick
    const beat2 = Math.pow(Math.max(0, Math.sin(t * 3.3 + 1)), 3);   // syncopated
    const beat3 = Math.pow(Math.max(0, Math.sin(t * 1.1)), 2);       // slow swell
    const shimmer = 0.3 + 0.2 * Math.sin(t * 0.7);                   // ambient drift

    for (let i = 0; i < bins; i++) {
      const norm = i / bins; // 0..1
      // Bass: strong low-frequency content pulsing with beat
      const bass = Math.exp(-norm * 12) * (140 + 100 * beat1);
      // Mids: broader hump with syncopation
      const midCenter = 0.08 + 0.03 * Math.sin(t * 0.5);
      const mids = Math.exp(-Math.pow((norm - midCenter) / 0.06, 2)) * (80 + 90 * beat2);
      // Highs: sparkly high-frequency content
      const highs = Math.exp(-Math.pow((norm - 0.3) / 0.15, 2)) * (30 + 50 * shimmer)
                   + Math.random() * 8 * shimmer;
      // Ambient noise floor
      const noise = Math.random() * 3;
      // Slow overall swell
      const swell = 0.6 + 0.4 * beat3;

      freq[i] = Math.min(255, Math.max(0, (bass + mids + highs + noise) * swell));
    }

    // Generate time-domain waveform (simulated audio signal)
    const amp = 0.3 + 0.25 * beat1 + 0.15 * beat2;
    for (let i = 0; i < bins; i++) {
      const phase = (i / bins) * Math.PI * 2;
      // Mix of sine waves at different frequencies for a rich waveform
      const wave = Math.sin(phase * 3 + t * 5) * 0.5
                 + Math.sin(phase * 7 + t * 3.7) * 0.25
                 + Math.sin(phase * 13 + t * 8.3) * 0.15
                 + Math.sin(phase * 23 + t * 1.1) * 0.1;
      time[i] = 128 + Math.round(wave * amp * 127);
    }

    return { frequency: freq, timeDomain: time };
  }

  /* ---- Screen Wake Lock ---- */

  _setupWakeLock() {
    if (!('wakeLock' in navigator)) {
      console.warn('[WakeLock] API not supported in this browser');
      this._wakeLockStatus = 'Unsupported';
      this._wakeLockLastEvent = '--';
      return;
    }
    this._wakeLock = null;
    this._wakeLockStatus = 'Pending';
    this._wakeLockLastEvent = '--';

    const timeStr = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const updateHUD = () => {
      if (this._debugHUD) {
        this._debugHUD.wakeLock.textContent = this._wakeLockStatus;
        this._debugHUD.wakeLock.style.color = this._wakeLockStatus === 'Held' ? '#4caf50' : this._wakeLockStatus === 'Failed' ? '#f44336' : '#ffc107';
        this._debugHUD.wlEvent.textContent = this._wakeLockLastEvent;
      }
    };

    let hasUserGesture = false;

    this._acquireWakeLock = async () => {
      if (!hasUserGesture) {
        console.log('[WakeLock] No user gesture yet, skipping');
        return;
      }
      try {
        if (this._wakeLock) {
          console.log('[WakeLock] Already held, skipping');
          return;
        }
        this._wakeLock = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] Acquired successfully');
        this._wakeLockStatus = 'Held';
        this._wakeLockLastEvent = `Acquired ${timeStr()}`;
        updateHUD();
        this._wakeLock.addEventListener('release', () => {
          console.log('[WakeLock] Released');
          this._wakeLock = null;
          this._wakeLockStatus = 'Released';
          this._wakeLockLastEvent = `Released ${timeStr()}`;
          updateHUD();
        });
      } catch (err) {
        console.warn('[WakeLock] Failed to acquire:', err.name, err.message);
        this._wakeLockStatus = 'Failed';
        this._wakeLockLastEvent = `Failed ${timeStr()}`;
        updateHUD();
      }
    };

    // Do NOT attempt on load — wait for first user gesture
    this._wakeLockStatus = 'Waiting for gesture';
    updateHUD();

    // Re-acquire every time page becomes visible, but only after
    // a user gesture has occurred
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && hasUserGesture) {
        console.log('[WakeLock] Page visible — re-acquiring');
        this._acquireWakeLock();
      }
    });

    // Acquire on every touch (each is a fresh user gesture)
    document.addEventListener('touchstart', () => {
      hasUserGesture = true;
      this._acquireWakeLock();
    }, { passive: true });

    // Also handle click for non-touch interactions
    document.addEventListener('click', () => {
      hasUserGesture = true;
      this._acquireWakeLock();
    });
  }

  /* ---- Mobile UI Toggle ---- */

  _updateMobileUIVisibility() {
    const hidden = this._mobileUIHidden;
    const controlPanel = document.querySelector('.control-panel');
    const floatingMic = this._floatingMicBtn;

    // For Liquid Lite, delegate to its own panel toggle
    if (controlPanel.classList.contains('ll-active')) {
      controlPanel.classList.toggle('ll-ui-hidden', hidden);
      const llPanel = document.querySelector('.ll-lite-panel');
      if (llPanel) llPanel.classList.toggle('ll-ui-hidden', hidden);
      return;
    }

    // For other modes, toggle the control panel and floating mic
    controlPanel.classList.toggle('mobile-ui-hidden', hidden);
    if (floatingMic) floatingMic.classList.toggle('mobile-ui-hidden', hidden);
  }

  /* ---- Floating Mic Button (mobile, non-Liquid-Lite modes) ---- */

  _createFloatingMic() {
    const btn = document.createElement('button');
    btn.className = 'll-lite-mic floating-mic';
    btn.innerHTML = '<span class="mic-icon">🎤</span>';
    btn.style.display = 'none'; // hidden by default, shown for non-custom-panel modes

    // Short tap = toggle, long press = gain popover
    let longPressTimer = null;
    let didLongPress = false;
    const startPress = () => {
      didLongPress = false;
      longPressTimer = setTimeout(() => {
        didLongPress = true;
        this._showFloatingGainPopover(btn);
      }, 500);
    };
    const endPress = () => {
      clearTimeout(longPressTimer);
      if (!didLongPress) this.toggleMic();
    };
    const cancelPress = () => { clearTimeout(longPressTimer); };
    btn.addEventListener('touchstart', startPress, { passive: true });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); endPress(); });
    btn.addEventListener('touchcancel', cancelPress);
    btn.addEventListener('mousedown', startPress);
    btn.addEventListener('mouseup', endPress);
    btn.addEventListener('mouseleave', cancelPress);

    document.body.appendChild(btn);
    this._floatingMicBtn = btn;

    // Floating mic listens via its own callback
    this._floatingMicStateChange = (state) => {
      btn.classList.toggle('mic-active', state === true);
      if (!state) btn.style.removeProperty('--mic-level');
      if (state === true) this._startFloatingLevelMonitor();
      else this._stopFloatingLevelMonitor();
    };
  }

  _updateFloatingMicVisibility() {
    if (!this._floatingMicBtn) return;
    // Show floating mic when active mode does NOT have its own panel (i.e. not Liquid Lite / Liquid Show)
    const hasOwnPanel = !!this.activeVisualizer?.buildPanel;
    this._floatingMicBtn.style.display = hasOwnPanel ? 'none' : 'flex';
    // Sync active state
    this._floatingMicBtn.classList.toggle('mic-active', this.mic.active);
    if (this.mic.active) this._startFloatingLevelMonitor();
  }

  _startFloatingLevelMonitor() {
    this._stopFloatingLevelMonitor();
    const update = () => {
      if (!this.mic.active || !this.mic.analyser) return;
      this.mic.analyser.getByteFrequencyData(this.mic.freqData);
      let sum = 0;
      const bins = Math.min(32, this.mic.freqData.length);
      for (let i = 0; i < bins; i++) sum += this.mic.freqData[i];
      const level = sum / (bins * 255);
      if (this._floatingMicBtn) this._floatingMicBtn.style.setProperty('--mic-level', level.toFixed(2));
      this._floatingMicLevelRAF = requestAnimationFrame(update);
    };
    this._floatingMicLevelRAF = requestAnimationFrame(update);
  }

  _stopFloatingLevelMonitor() {
    if (this._floatingMicLevelRAF) {
      cancelAnimationFrame(this._floatingMicLevelRAF);
      this._floatingMicLevelRAF = null;
    }
  }

  _showFloatingGainPopover(anchorBtn) {
    this._dismissFloatingGainPopover();

    const popover = document.createElement('div');
    popover.className = 'll-gain-popover floating-gain-popover';

    const label = document.createElement('div');
    label.className = 'll-gain-label';
    label.textContent = `Mic Gain: ${this.mic.gainValue.toFixed(1)}x`;
    popover.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'll-gain-slider';
    slider.min = '0.5';
    slider.max = '10';
    slider.step = '0.5';
    slider.value = this.mic.gainValue;
    slider.addEventListener('input', () => {
      this.setMicGain(parseFloat(slider.value));
      label.textContent = `Mic Gain: ${this.mic.gainValue.toFixed(1)}x`;
    });
    popover.appendChild(slider);

    document.body.appendChild(popover);
    this._floatingGainPopover = popover;

    setTimeout(() => {
      this._floatingGainDismiss = (e) => {
        if (!popover.contains(e.target) && e.target !== anchorBtn && !anchorBtn.contains(e.target)) {
          this._dismissFloatingGainPopover();
        }
      };
      document.addEventListener('click', this._floatingGainDismiss, true);
      document.addEventListener('touchstart', this._floatingGainDismiss, true);
    }, 10);
  }

  _dismissFloatingGainPopover() {
    if (this._floatingGainPopover) { this._floatingGainPopover.remove(); this._floatingGainPopover = null; }
    if (this._floatingGainDismiss) {
      document.removeEventListener('click', this._floatingGainDismiss, true);
      document.removeEventListener('touchstart', this._floatingGainDismiss, true);
      this._floatingGainDismiss = null;
    }
  }

  /* ---- Shared Mic Input ---- */

  async toggleMic() {
    if (this.mic.active) {
      this.stopMic();
    } else {
      await this.startMic();
    }
  }

  async startMic() {
    try {
      this.mic.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.mic.context = new (window.AudioContext || window.webkitAudioContext)();
      this.mic.source = this.mic.context.createMediaStreamSource(this.mic.stream);

      this.mic.gainNode = this.mic.context.createGain();
      this.mic.gainNode.gain.value = this.mic.gainValue;

      this.mic.analyser = this.mic.context.createAnalyser();
      this.mic.analyser.fftSize = 2048;
      this.mic.analyser.smoothingTimeConstant = 0.88;
      this.mic.analyser.minDecibels = -80;
      this.mic.analyser.maxDecibels = -10;

      this.mic.source.connect(this.mic.gainNode);
      this.mic.gainNode.connect(this.mic.analyser);

      const binCount = this.mic.analyser.frequencyBinCount;
      this.mic.freqData = new Uint8Array(binCount);
      this.mic.timeData = new Uint8Array(this.mic.analyser.fftSize);
      // Secondary smoothing buffer for extra-smooth visuals
      this.mic.smoothedFreq = new Float32Array(binCount);
      this.mic.smoothedTime = new Float32Array(this.mic.analyser.fftSize);

      this.mic.active = true;
      this._notifyMicState(true);

      // Handle track ending unexpectedly
      this.mic.stream.getAudioTracks()[0].addEventListener('ended', () => this.stopMic());
    } catch (err) {
      this._notifyMicState('error', err);
    }
  }

  stopMic() {
    this.mic.active = false;
    if (this.mic.stream) { this.mic.stream.getTracks().forEach(t => t.stop()); this.mic.stream = null; }
    if (this.mic.source) { this.mic.source.disconnect(); this.mic.source = null; }
    if (this.mic.gainNode) { this.mic.gainNode.disconnect(); this.mic.gainNode = null; }
    if (this.mic.context && this.mic.context.state !== 'closed') { this.mic.context.close(); this.mic.context = null; }
    this.mic.analyser = null;
    this.mic.freqData = null;
    this.mic.timeData = null;
    this.mic.smoothedFreq = null;
    this.mic.smoothedTime = null;
    this._notifyMicState(false);
  }

  _notifyMicState(state, err) {
    // Notify panel callback (Liquid Lite)
    if (err) this.mic.onStateChange?.('error', err);
    else this.mic.onStateChange?.(state);
    // Notify floating mic button
    this._floatingMicStateChange?.(state);
  }

  setMicGain(value) {
    this.mic.gainValue = value;
    if (this.mic.gainNode) this.mic.gainNode.gain.value = value;
  }

  /* ---- Debug HUD ---- */

  _setupDebugHUD() {
    const hud = document.createElement('div');
    hud.id = 'debug-hud';
    hud.innerHTML = `
      <div class="debug-line"><span class="debug-label">FPS</span> <span id="dbg-fps">--</span> <span id="dbg-fps-dot">●</span></div>
      <div class="debug-line"><span class="debug-label">Target</span> <span id="dbg-target">--</span></div>
      <div class="debug-line"><span class="debug-label">Canvas</span> <span id="dbg-canvas">--</span></div>
      <div class="debug-line"><span class="debug-label">DPR</span> <span id="dbg-dpr">--</span></div>
      <div class="debug-line"><span class="debug-label">Mode</span> <span id="dbg-mode">--</span></div>
      <div class="debug-line"><span class="debug-label">Preset</span> <span id="dbg-preset">--</span></div>
      <div class="debug-line"><span class="debug-label">Audio</span> <span id="dbg-audio">--</span></div>
      <div class="debug-line"><span class="debug-label">Quality</span> <span id="dbg-quality">--</span></div>
      <div class="debug-line"><span class="debug-label">App Mode</span> <span id="dbg-appmode">--</span></div>
      <div class="debug-line"><span class="debug-label">Wake Lock</span> <span id="dbg-wakelock">--</span></div>
      <div class="debug-line"><span class="debug-label">WL Event</span> <span id="dbg-wlevent">--</span></div>
      <div id="dbg-timing" class="debug-timing"></div>
      <div id="dbg-frozen" class="debug-frozen" style="display:none">FROZEN</div>
      <div id="dbg-freeze-tap" class="debug-freeze-tap">⏸</div>
    `;
    document.body.appendChild(hud);

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #debug-hud {
        position: fixed;
        top: 8px;
        right: 8px;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.75);
        color: #ccc;
        font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
        font-size: 11px;
        line-height: 1.5;
        padding: 8px 10px;
        border-radius: 6px;
        pointer-events: none;
        min-width: 180px;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .debug-line {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .debug-label {
        color: #888;
        flex-shrink: 0;
      }
      .debug-timing {
        border-top: 1px solid rgba(255,255,255,0.15);
        margin-top: 4px;
        padding-top: 4px;
        font-size: 10px;
        line-height: 1.4;
      }
      .debug-timing .debug-line {
        font-size: 10px;
      }
      .debug-timing .dt-val {
        color: #aaa;
      }
      .debug-timing .dt-total {
        border-top: 1px solid rgba(255,255,255,0.1);
        margin-top: 2px;
        padding-top: 2px;
        color: #fff;
      }
      #dbg-fps-dot {
        font-size: 9px;
        margin-left: 4px;
      }
      .debug-frozen {
        text-align: center;
        color: #ff6b6b;
        font-weight: bold;
        font-size: 10px;
        letter-spacing: 2px;
        margin-top: 4px;
        animation: debug-blink 1s ease-in-out infinite;
      }
      @keyframes debug-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .debug-freeze-tap {
        position: absolute;
        bottom: -28px;
        right: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.6);
        border-radius: 50%;
        font-size: 12px;
        cursor: pointer;
        pointer-events: auto;
        opacity: 0.5;
        user-select: none;
        -webkit-user-select: none;
      }
      .debug-freeze-tap:hover { opacity: 1; }
    `;
    document.head.appendChild(style);

    // State
    this._debugHUD = {
      el: hud,
      fps: document.getElementById('dbg-fps'),
      fpsDot: document.getElementById('dbg-fps-dot'),
      target: document.getElementById('dbg-target'),
      canvas: document.getElementById('dbg-canvas'),
      dpr: document.getElementById('dbg-dpr'),
      mode: document.getElementById('dbg-mode'),
      preset: document.getElementById('dbg-preset'),
      audio: document.getElementById('dbg-audio'),
      quality: document.getElementById('dbg-quality'),
      timingEl: document.getElementById('dbg-timing'),
      appMode: document.getElementById('dbg-appmode'),
      wakeLock: document.getElementById('dbg-wakelock'),
      wlEvent: document.getElementById('dbg-wlevent'),
      frozenLabel: document.getElementById('dbg-frozen'),
      frozen: false,
      fpsHistory: [],
      lastUpdate: 0,
    };

    // Set static app mode value
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    this._debugHUD.appMode.textContent = isStandalone ? 'Standalone' : 'Browser';

    // Populate wake lock status if already set before HUD was created
    if (this._wakeLockStatus) {
      this._debugHUD.wakeLock.textContent = this._wakeLockStatus;
      this._debugHUD.wakeLock.style.color = this._wakeLockStatus === 'Held' ? '#4caf50' : this._wakeLockStatus === 'Failed' ? '#f44336' : '#ffc107';
    }
    if (this._wakeLockLastEvent) {
      this._debugHUD.wlEvent.textContent = this._wakeLockLastEvent;
    }

    // Freeze toggle via F key (desktop)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        this._toggleDebugFreeze();
      }
    });

    // Freeze toggle via tap target (mobile)
    document.getElementById('dbg-freeze-tap').addEventListener('click', () => this._toggleDebugFreeze());
    document.getElementById('dbg-freeze-tap').addEventListener('touchend', (e) => {
      e.preventDefault();
      this._toggleDebugFreeze();
    });
  }

  _toggleDebugFreeze() {
    if (!this._debugHUD) return;
    this._debugHUD.frozen = !this._debugHUD.frozen;
    this._debugHUD.frozenLabel.style.display = this._debugHUD.frozen ? 'block' : 'none';
    const tap = document.getElementById('dbg-freeze-tap');
    if (tap) tap.textContent = this._debugHUD.frozen ? '▶' : '⏸';
  }

  _updateDebugHUD(timestamp) {
    if (!this._debugHUD || this._debugHUD.frozen) return;

    // Track FPS via rolling window
    this._debugHUD.fpsHistory.push(timestamp);
    const cutoff = timestamp - 1000;
    while (this._debugHUD.fpsHistory.length > 0 && this._debugHUD.fpsHistory[0] < cutoff) {
      this._debugHUD.fpsHistory.shift();
    }

    // Update once per second
    if (timestamp - this._debugHUD.lastUpdate < 1000) return;
    this._debugHUD.lastUpdate = timestamp;

    const fps = this._debugHUD.fpsHistory.length;
    const d = this._debugHUD;

    d.fps.textContent = fps;
    // Color coding
    const color = fps >= 50 ? '#4caf50' : fps >= 30 ? '#ffc107' : '#f44336';
    d.fps.style.color = color;
    d.fpsDot.style.color = color;

    d.target.textContent = this.targetFps + ' fps';
    d.canvas.textContent = `${this.canvas.width}×${this.canvas.height}`;
    d.dpr.textContent = (window.devicePixelRatio || 1).toFixed(1);

    // Mode
    const modeLabel = VIZ_CLASSES[this.activeKey]?.label || this.activeKey;
    d.mode.textContent = modeLabel;

    // Preset (for Liquid Lite, show selected preset name)
    const viz = this.activeVisualizer;
    let presetName = '—';
    if (viz?._currentPresetId) {
      const found = (LiquidShowVisualizer.presets || []).find(p => p.id === viz._currentPresetId);
      if (found) presetName = found.name;
    } else if (viz?.engine?._currentPresetId) {
      const found = (LiquidShowVisualizer.presets || []).find(p => p.id === viz.engine._currentPresetId);
      if (found) presetName = found.name;
    }
    d.preset.textContent = presetName;

    // Audio source
    d.audio.textContent = this.mic.active ? 'Mic' : this.audio.isCapturing ? 'System' : 'Demo';

    // Quality scale
    const qPct = Math.round(this._qualityScale * 100);
    d.quality.textContent = `${qPct}%`;
    d.quality.style.color = qPct === 100 ? '#4caf50' : qPct >= 80 ? '#ffc107' : '#f44336';

    // Wake lock status (refresh every update cycle)
    if (this._wakeLockStatus) {
      d.wakeLock.textContent = this._wakeLockStatus;
      d.wakeLock.style.color = this._wakeLockStatus === 'Held' ? '#4caf50' : this._wakeLockStatus === 'Failed' ? '#f44336' : '#ffc107';
      d.wlEvent.textContent = this._wakeLockLastEvent || '--';
    }

    // Per-layer and post-processing timing
    const engine = this.activeVisualizer?.engine || this.activeVisualizer;
    const timing = engine?._timing;
    if (timing && d.timingEl) {
      let html = '';
      for (const l of timing.layers) {
        html += `<div class="debug-line"><span class="debug-label">L${l.index} (${l.type})</span> <span class="dt-val">${l.ms.toFixed(1)}ms</span></div>`;
      }
      const postKeys = ['bloom', 'softness', 'contrast', 'bw', 'grain'];
      for (const k of postKeys) {
        if (timing.post[k] != null) {
          html += `<div class="debug-line"><span class="debug-label">Post (${k})</span> <span class="dt-val">${timing.post[k].toFixed(1)}ms</span></div>`;
        }
      }
      html += `<div class="debug-line dt-total"><span class="debug-label">Total draw</span> <span class="dt-val">${timing.total.toFixed(1)}ms</span></div>`;
      d.timingEl.innerHTML = html;
    } else if (d.timingEl) {
      d.timingEl.innerHTML = '';
    }
  }

  /* ---- Adaptive Quality ---- */

  _adaptiveQualityUpdate(fps, timestamp) {
    const LOW_THRESHOLD = 30;
    const HIGH_THRESHOLD = 45;
    const LOW_DURATION = 4000;   // ms below threshold before stepping down
    const HIGH_DURATION = 5000;  // ms above threshold before stepping up
    const STEP = 0.1;
    const MIN_SCALE = 0.8;
    const MAX_SCALE = 1.0;

    if (fps < LOW_THRESHOLD) {
      this._qualityHighSince = 0;
      if (!this._qualityLowSince) {
        this._qualityLowSince = timestamp;
      } else if (timestamp - this._qualityLowSince > LOW_DURATION) {
        const newScale = Math.max(MIN_SCALE, this._qualityScale - STEP);
        if (newScale !== this._qualityScale) {
          this._qualityScale = Math.round(newScale * 100) / 100;
          this.resizeCanvas();
        }
        this._qualityLowSince = timestamp; // reset for next step
      }
    } else if (fps > HIGH_THRESHOLD) {
      this._qualityLowSince = 0;
      if (!this._qualityHighSince) {
        this._qualityHighSince = timestamp;
      } else if (timestamp - this._qualityHighSince > HIGH_DURATION && this._qualityScale < MAX_SCALE) {
        const newScale = Math.min(MAX_SCALE, this._qualityScale + STEP);
        this._qualityScale = Math.round(newScale * 100) / 100;
        this.resizeCanvas();
        this._qualityHighSince = timestamp;
      }
    } else {
      // In the acceptable range — reset both timers
      this._qualityLowSince = 0;
      this._qualityHighSince = 0;
    }
  }

  _preWarmRenderers() {
    // Run a few silent frames through each visualizer to warm up JIT and canvas contexts
    const synth = this._generateSyntheticAudio(0);
    const savedViz = this.activeVisualizer;
    const savedKey = this.activeKey;
    for (const [key, viz] of Object.entries(this.visualizers)) {
      try {
        viz.draw(synth.frequency, synth.timeDomain);
        viz.draw(synth.frequency, synth.timeDomain);
      } catch (_) { /* ignore errors during warmup */ }
    }
    // Restore and clear canvas
    this.activeVisualizer = savedViz;
    this.activeKey = savedKey;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /* ---- Canvas ---- */

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;

    // Render at reduced resolution for performance.
    // _qualityScale ranges from 0.5 to 1.0 (adaptive quality system).
    // On Retina displays, even scale=1.0 means we render at CSS pixels (not device pixels),
    // which is already half the native resolution at DPR 2.
    const scale = this._qualityScale;
    const renderW = Math.round(cssW * scale);
    const renderH = Math.round(cssH * scale);

    // CSS size = full container; buffer = scaled render resolution
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = renderW;
    this.canvas.height = renderH;
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
      // Reset adaptive quality and re-fit canvas after layout change
      this._qualityScale = 1.0;
      this._qualityLowSince = 0;
      this._qualityHighSince = 0;
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

  exportConfig() {
    const state = this._captureState();
    const preset = VIZ_CLASSES[this.activeKey]?.label || this.activeKey;
    const data = {
      name: `${preset} — ${new Date().toLocaleString()}`,
      date: new Date().toISOString(),
      state,
      version: 1,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const safeName = preset.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `visualizer-${safeName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.statusText.textContent = `Exported: ${data.name}`;
  }

  importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.state || !data.state.preset) {
            alert('Invalid configuration file.\n\nThe file does not contain a valid visualizer configuration.');
            return;
          }
          this._applyState(data.state);
          this.statusText.textContent = `Imported: ${data.name || file.name}`;

          // Also save to localStorage so it shows up in Manage Saved
          const configs = this._getConfigs();
          configs.push({
            name: data.name || file.name.replace('.json', ''),
            date: data.date || new Date().toISOString(),
            state: data.state,
          });
          this._setConfigs(configs);
        } catch (err) {
          alert('Could not read configuration file.\n\n' + err.message);
        }
      };
      reader.readAsText(file);
      document.body.removeChild(input);
    });

    input.click();
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
  window.__app = new App();
});
