import { Platform } from 'react-native';

/**
 * Crash reporting (REBUILD_PLAN M4). DSN is the project's public client key
 * from sentry.io — Settings → Projects → wcm-app → Client Keys. Safe to
 * commit (it can only ingest events, not read them). Empty DSN = Sentry
 * fully disabled, so the app never depends on it existing.
 */
export const SENTRY_DSN = '';

export function initSentry(): void {
  if (!SENTRY_DSN || Platform.OS === 'web' || __DEV__) return;
  try {
    // require() so the web bundle never touches the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      // crash reporting only — keep performance tracing minimal for the free tier
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
    });
  } catch {
    /* never let crash reporting crash the app */
  }
}

/** Report a handled error (e.g. from the root error boundary). */
export function captureError(error: unknown): void {
  if (!SENTRY_DSN || Platform.OS === 'web' || __DEV__) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.captureException(error);
  } catch {
    /* ignore */
  }
}
