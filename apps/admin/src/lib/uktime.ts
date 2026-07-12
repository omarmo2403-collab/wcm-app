/** All admin date maths is Europe/London, whatever the viewer's machine says. */

function ukParts(d: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** UK wall time -> UTC ISO (handles BST/GMT). */
export function ukToIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23',
  });
  const offset = (Number(fmt.format(new Date(guess))) - h! + 24) % 24;
  return new Date(guess - offset * 3600 * 1000).toISOString();
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" UK wall clock, for datetime-local inputs. */
export function isoToUkInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = ukParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "Mon 13 Jul, 8:53 pm" in UK time. */
export function formatUk(isoOrUnixSeconds: string | number): string {
  const d = typeof isoOrUnixSeconds === 'number'
    ? new Date(isoOrUnixSeconds * 1000)
    : new Date(isoOrUnixSeconds);
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).replace(' at ', ', ');
}
