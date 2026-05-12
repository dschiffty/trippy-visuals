/* ============================================
   PopoutSync — cross-window state sync via BroadcastChannel
   Used by the Liquid Lights "Pop Out Controls" feature.
   ============================================ */

const CHANNEL = 'll-popout-sync';

export class PopoutSync {
  /**
   * @param {'main'|'popout'} mode
   */
  constructor(mode) {
    this.mode = mode;
    try {
      this.channel = new BroadcastChannel(CHANNEL);
    } catch (e) {
      console.warn('[PopoutSync] BroadcastChannel unsupported:', e);
      this.channel = null;
    }
    this._listeners = {};
    if (this.channel) {
      this.channel.addEventListener('message', (ev) => this._dispatch(ev.data));
    }
    if (this.mode === 'popout') {
      // Announce arrival so the main window knows we're up.
      // Fire on next tick so listeners are registered first.
      Promise.resolve().then(() => this.send('hello'));
      const closingSend = () => this.send('closing');
      window.addEventListener('pagehide', closingSend);
      window.addEventListener('beforeunload', closingSend);
    }
  }

  _dispatch(msg) {
    if (!msg || msg.from === this.mode) return; // ignore own
    const list = this._listeners[msg.type];
    if (!list) return;
    list.forEach(fn => { try { fn(msg.payload, msg); } catch (err) { console.error('[PopoutSync] listener error:', err); } });
  }

  send(type, payload) {
    if (!this.channel) return;
    try {
      this.channel.postMessage({ type, payload, from: this.mode, ts: Date.now() });
    } catch (e) {
      console.warn('[PopoutSync] postMessage failed:', e);
    }
  }

  on(type, fn) {
    (this._listeners[type] ||= []).push(fn);
    return () => {
      const list = this._listeners[type];
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }

  close() {
    try { this.channel?.close(); } catch (_) {}
    this.channel = null;
    this._listeners = {};
  }
}

export function isPopoutMode() {
  return new URLSearchParams(location.search).get('popout') === '1';
}
