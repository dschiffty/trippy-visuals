import { isPopoutMode } from './popout-sync.js';

// Privacy-first PostHog setup (same config across all projects):
// - cookieless_mode "always": PostHog stores nothing in the visitor's browser,
//   so no cookie banner is needed. It counts unique visitors with a daily
//   rotating server-side hash instead.
// - person_profiles "never": no user profiles, identify() does nothing.
// - no session recordings or surveys.
// The project token is public by design (write-only). It's only set in
// production builds (.env.production), so `npm run dev` sends nothing unless
// you add it to .env.local.
//
// PostHog is loaded lazily, after the page has loaded and the browser is idle,
// so it never delays the visualizer starting. Events tracked before then are
// queued and sent once it's ready.
const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

// Owner opt-out: visit any page with ?notrack=1 once per browser to stop
// counting your own visits; ?notrack=0 turns tracking back on. This is a
// choice the visitor makes on their own device, so it needs no consent banner.
const OPT_OUT_KEY = 'analytics_opt_out';

function isOptedOut() {
  try {
    const flag = new URLSearchParams(location.search).get('notrack');
    if (flag === '1') localStorage.setItem(OPT_OUT_KEY, '1');
    if (flag === '0') localStorage.removeItem(OPT_OUT_KEY);
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false; // storage blocked: fall back to tracking normally
  }
}

// The pop-out controls window is part of the same visit, so don't count it.
const enabled = Boolean(token) && !isPopoutMode() && !isOptedOut();

let posthog = null;
const queue = [];

/**
 * Record a product event, e.g. track('visualizer_mode_changed', { mode: 'lissajous' }).
 * Never include personal data (names, file names, free text) in properties.
 */
export function track(event, properties) {
  if (!enabled) return;
  if (posthog) posthog.capture(event, properties);
  else queue.push([event, properties]);
}

async function loadPostHog() {
  const { default: ph } = await import('posthog-js');
  ph.init(token, {
    api_host: host,
    defaults: '2026-05-30',
    cookieless_mode: 'always',
    person_profiles: 'never',
    disable_session_recording: true,
    disable_surveys: true,
  });
  posthog = ph;
  queue.splice(0).forEach(([event, properties]) => ph.capture(event, properties));
}

if (enabled) {
  const whenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
  const start = () => whenIdle(() => loadPostHog().catch(() => {}), { timeout: 3000 });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
