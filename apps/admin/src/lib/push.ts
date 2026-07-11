/** Shared shape + display helpers for OneSignal scheduled notifications. */

export interface ScheduledItem {
  id: string;
  title: string;
  message: string;
  send_after: number; // unix seconds
  topic: string | null;
  url: string | null; // web link (opens in browser)
  route: string | null; // in-app screen path (opens in the app)
}

export const TOPIC_LABELS: Record<string, string> = {
  prayer_times: 'Prayer Times',
  events: 'Events',
  stadium: 'Stadium',
};

/** Where the phone goes when the notification is tapped. */
export function destinationLabel(
  s: Pick<ScheduledItem, 'url' | 'route'>,
  events: { id: string; title: string }[],
): string {
  if (s.route) {
    const ev = s.route.startsWith('/event/')
      ? events.find((e) => `/event/${e.id}` === s.route)
      : null;
    if (ev) return `opens event: ${ev.title}`;
    return `opens app screen: ${s.route}`;
  }
  if (s.url) return `opens web link: ${s.url}`;
  return 'opens the app';
}

export function formatUkTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
