import posthog from 'posthog-js';
import { isPopoutMode } from './popout-sync.js';

// Privacy-first PostHog setup (same config across all projects):
// - cookieless_mode "always": nothing stored in the visitor's browser, so no
//   cookie banner is needed. PostHog counts unique visitors with a daily
//   rotating server-side hash instead.
// - person_profiles "never": no user profiles, identify() does nothing.
// - no session recordings or surveys.
// The project token is public by design (write-only). It's only set in
// production builds (.env.production), so `npm run dev` sends nothing unless
// you add it to .env.local.
const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

// The pop-out controls window is part of the same visit, so don't count it.
if (token && !isPopoutMode()) {
  posthog.init(token, {
    api_host: host,
    defaults: '2026-05-30',
    cookieless_mode: 'always',
    person_profiles: 'never',
    disable_session_recording: true,
    disable_surveys: true,
  });
}
