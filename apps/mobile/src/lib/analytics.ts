import { Platform } from 'react-native';

/**
 * Anonymous product analytics (PostHog EU — GDPR data residency, REBUILD_PLAN §5).
 * The project key is a public client token. No personal data is ever attached;
 * the flagship event is notifications_rescheduled, which powers the admin
 * dashboard's "% of devices re-synced after an iqamah change" gauge.
 */
const POSTHOG_KEY = 'phc_vjuYkoAvoEqnFY5yBAZTzwURW22ooBB9GsVXAG8sjPr7';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

type Client = { capture: (event: string, properties?: Record<string, unknown>) => void };
let client: Client | null = null;

export function initAnalytics(): void {
  if (Platform.OS === 'web' || client) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require('posthog-react-native') as typeof import('posthog-react-native');
    client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
    client.capture('app_opened');
  } catch {
    client = null; // analytics must never break the app
  }
}

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    client?.capture(event, properties);
  } catch {
    /* never throw from analytics */
  }
}
