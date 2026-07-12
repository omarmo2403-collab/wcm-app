import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { callSendPush, supabase } from '../lib/supabase';
import { destinationLabel, TOPIC_LABELS, type ScheduledItem } from '../lib/push';

/**
 * Bulk-schedule notifications from a filled-in template (Excel/CSV/Word
 * table). Download the template, fill one row per notification, upload —
 * each row becomes a OneSignal scheduled send (fires even if this browser
 * is closed). Times are UK wall-clock.
 */

const TOPICS = ['prayer_times', 'events', 'stadium'] as const;

interface ParsedRow {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  topic: string;
  title: string;
  message: string;
  link?: string; // web URL — opens in browser
  route?: string; // in-app screen path (e.g. /event/<id>) — takes precedence
  error?: string;
}

interface EventOption {
  id: string;
  title: string;
  starts_at: string;
}

// Fixed in-app screens a notification can open (event pages added dynamically)
const APP_SCREENS = [
  { route: '/stadium', label: 'Stadium event days screen' },
  { route: '/prayer-times', label: 'Prayer times screen' },
  { route: '/donate', label: 'Donate screen' },
  { route: '/news', label: 'News screen' },
];

/** UK wall time -> UTC ISO (handles BST/GMT) */
function ukToIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' });
  const offset = (Number(fmt.format(new Date(guess))) - h! + 24) % 24;
  return new Date(guess - offset * 3600 * 1000).toISOString();
}

function formatUk(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

/** normalise an Excel cell that might be a date/time serial or text */
function cellDate(v: unknown): string {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // 25/07/2026
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return s;
}
function cellTime(v: unknown): string {
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 0 && v < 1) { // Excel time fraction
    const mins = Math.round(v * 24 * 60);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return s;
  let h = Number(m[1]);
  // volunteers type "6:30 PM" no matter what the template says — honour it
  if (m[3]?.toLowerCase() === 'pm' && h !== 12) h += 12;
  if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** true only for a real calendar date — Date.UTC silently rolls "2026-06-31" into July */
function isRealDate(date: string): boolean {
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, mo! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo! - 1 && dt.getUTCDate() === d;
}

function validateRow(r: ParsedRow): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return `invalid date "${r.date}" (use YYYY-MM-DD or DD/MM/YYYY)`;
  if (!isRealDate(r.date)) return `"${r.date}" is not a real calendar date`;
  if (!/^\d{2}:\d{2}$/.test(r.time)) return `invalid time "${r.time}" (use HH:MM, 24-hour)`;
  if (Number(r.time.slice(0, 2)) > 23 || Number(r.time.slice(3)) > 59) return `invalid time "${r.time}"`;
  if (!TOPICS.includes(r.topic as (typeof TOPICS)[number])) return `topic must be one of: ${TOPICS.join(', ')}`;
  if (!r.title.trim()) return 'title is empty';
  if (r.title.length > 65) return `title too long (${r.title.length}/65 characters)`;
  if (!r.message.trim()) return 'message is empty';
  if (r.message.length > 178) return `message too long (${r.message.length}/178 characters)`;
  if (Date.parse(ukToIso(r.date, r.time)) < Date.now() + 60_000) return 'time is in the past';
  return undefined;
}

function rowsFromMatrix(matrix: unknown[][], events: EventOption[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const seen = new Set<string>(); // topic|date|time within this one file
  for (const cells of matrix) {
    const [date, time, topic, title, message, link, eventName] = cells;
    const dateS = cellDate(date);
    // skip header / example / fully-empty rows — but a row with content and
    // no date must SURFACE as an error, not vanish silently
    if (/^date$/i.test(dateS) || String(title ?? '').startsWith('EXAMPLE')) continue;
    if (!String(date ?? '').trim() && !String(title ?? '').trim() && !String(message ?? '').trim()) continue;
    const linkS = String(link ?? '').trim();
    const row: ParsedRow = {
      date: dateS,
      time: cellTime(time),
      topic: String(topic ?? '').trim().toLowerCase(),
      title: String(title ?? '').trim(),
      message: String(message ?? '').trim(),
      // leading "/" = in-app screen path, anything else = web URL
      link: linkS && !linkS.startsWith('/') ? linkS : undefined,
      route: linkS.startsWith('/') ? linkS : undefined,
    };
    // Event column: name of an upcoming event -> deep link to its page.
    // Exact title match first, then unique substring match.
    const evName = String(eventName ?? '').trim();
    let eventError: string | undefined;
    if (evName) {
      const lower = evName.toLowerCase();
      const exact = events.filter((e) => e.title.toLowerCase() === lower);
      const matched = exact.length > 0
        ? exact
        : events.filter((e) => e.title.toLowerCase().includes(lower));
      if (matched.length === 1) {
        row.route = `/event/${matched[0]!.id}`;
        if (!row.topic) row.topic = 'events';
        else if (row.topic !== 'events') {
          eventError = `row links to an event, so topic must be "events" (or blank), not "${row.topic}"`;
        }
      } else if (matched.length === 0) {
        eventError = `no upcoming event matching "${evName}" — check the Events section`;
      } else {
        eventError = `"${evName}" matches ${matched.length} upcoming events — use the full title`;
      }
    }
    row.error = eventError ?? validateRow(row);
    // two identical (audience, date, time) rows in one file = certain double send
    if (!row.error) {
      const key = `${row.topic}|${row.date}|${row.time}`;
      if (seen.has(key)) row.error = 'duplicate of another row in this file (same audience, date and time)';
      else seen.add(key);
    }
    rows.push(row);
  }
  return rows;
}

async function parseDocxTable(buf: ArrayBuffer): Promise<unknown[][]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')!.async('string');
  const matrix: unknown[][] = [];
  for (const tr of xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
    const cells = (tr.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map((tc) =>
      (tc.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('').trim(),
    );
    matrix.push(cells);
  }
  return matrix;
}

function downloadTemplate(events: EventOption[]) {
  const wb = XLSX.utils.book_new();
  const data = [
    ['Date', 'Time (24h UK)', 'Topic', 'Title', 'Message', 'Link (optional)', 'Event (optional)'],
    ['2026-07-25', '09:00', 'stadium', 'EXAMPLE — Stadium event today', 'Parking restrictions apply around the Masjid today. Please use public transport.', '/stadium', ''],
    ['2026-08-01', '10:00', '', 'EXAMPLE — Fundraising dinner tonight', 'Join us at 7pm — tap to see the details.', '', 'Annual Fundraising Dinner'],
    ['2026-08-03', '18:00', 'events', 'EXAMPLE — General with web link', 'Read the full announcement on our website.', 'https://wembleycentralmasjid.co.uk', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 34 }, { wch: 60 }, { wch: 34 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Notifications');
  const notes = XLSX.utils.aoa_to_sheet([
    ['How to use this template'],
    ['1. One row per notification. Delete the EXAMPLE rows (any row whose Title starts with EXAMPLE is ignored).'],
    ['2. Date: YYYY-MM-DD (or DD/MM/YYYY). Time: 24-hour UK time, e.g. 09:00 or 18:30.'],
    ['3. Topic: prayer_times, events or stadium — who receives it. Leave blank if you fill in Event.'],
    ['4. Title max 65 characters; Message max 178 characters (it is a phone notification).'],
    ['5. EVENT NOTIFICATION with deep link: put the event name in the Event column (as it appears in the app), e.g. "Annual Fundraising Dinner". Tapping the notification then opens that event page in the app. See the "Upcoming events" sheet for names.'],
    ['6. GENERAL NOTIFICATION: leave Event blank. Link is optional — a web address (https://…) opens in the browser; an app screen opens in the app: /stadium, /prayer-times, /donate or /news.'],
    ['7. Upload the file in the admin Scheduled Notifications section — you can still review and change where each row links before scheduling.'],
  ]);
  notes['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, notes, 'Instructions');
  if (events.length > 0) {
    const evSheet = XLSX.utils.aoa_to_sheet([
      ['Upcoming events (copy a name into the Event column)', 'Date'],
      ...events.map((e) => [
        e.title,
        new Date(e.starts_at).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' }),
      ]),
    ]);
    evSheet['!cols'] = [{ wch: 50 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, evSheet, 'Upcoming events');
  }
  XLSX.writeFile(wb, 'WCM Notification Schedule Template.xlsx');
}

export function SchedulePush() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshScheduled = useCallback(async () => {
    const res = await callSendPush({ action: 'list_scheduled' });
    if (res.ok) setScheduled((res.scheduled as ScheduledItem[]) ?? []);
  }, []);

  useEffect(() => {
    refreshScheduled();
    // upcoming events for the per-row "opens in app" picker
    supabase
      .from('events')
      .select('id,title,starts_at')
      .eq('is_published', true) // drafts would deep-link to a page the app can't load
      .neq('category', 'stadium') // stadium days: use the Stadium topic instead
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(30)
      .then(({ data }) => setEvents((data as EventOption[]) ?? []));
  }, [refreshScheduled]);

  const setRowRoute = (index: number, route: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, route: route || undefined } : r)));
  };

  const handleFile = async (file: File) => {
    setStatus(`Reading ${file.name}…`);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      let matrix: unknown[][];
      if (file.name.toLowerCase().endsWith('.docx')) {
        matrix = await parseDocxTable(buf);
      } else {
        // CSVs must stay TEXT: SheetJS's fuzzy date pass runs "07/08/2026"
        // through new Date(), which reads it US-style (8 July) — our own
        // DD/MM regex in cellDate is the only safe path. Real .xlsx files
        // keep cellDates (true serials, no ambiguity).
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const wb = XLSX.read(buf, isCsv ? { raw: true } : { cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }) as unknown[][];
      }
      const parsed = rowsFromMatrix(matrix, events);
      setRows(parsed);
      const bad = parsed.filter((r) => r.error).length;
      setStatus(
        parsed.length === 0
          ? 'No notification rows found — check the file follows the template.'
          : `${parsed.length} notification(s) found${bad ? `, ${bad} with problems (fix and re-upload, or schedule the valid ones)` : ' — all valid ✓'}`,
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setRows([]);
    }
  };

  const scheduleAll = async () => {
    const valid = rows.filter((r) => !r.error);
    if (!window.confirm(`Schedule ${valid.length} notification(s)? Each fires automatically at its UK time.`)) return;
    setSending(true);
    let ok = 0;
    let skipped = 0;
    const failedRows: ParsedRow[] = [];
    for (const r of valid) {
      const res = await callSendPush({
        title: r.title,
        message: r.message,
        topic: r.topic,
        send_after: ukToIso(r.date, r.time),
        // in-app screen takes precedence over a web URL
        ...(r.route ? { route: r.route } : r.link ? { url: r.link } : {}),
      });
      if (res.ok) ok++;
      else if (res.error === 'duplicate_scheduled') skipped++;
      else failedRows.push({ ...r, error: `failed: ${typeof res.message === 'string' ? res.message : JSON.stringify(res.errors)}` });
    }
    setSending(false);
    setStatus(
      `Scheduled ${ok}/${valid.length} ✓` +
      (skipped ? ` — ${skipped} skipped (same audience already scheduled at that time)` : '') +
      (failedRows.length ? ` — ${failedRows.length} failed (kept below; fix and press Schedule again)` : ''),
    );
    // keep failed + invalid rows so a partial failure never loses track of
    // which notifications still need scheduling or fixing
    const leftover = [...failedRows, ...rows.filter((r) => r.error)];
    setRows(leftover);
    if (leftover.length === 0) setFileName('');
    refreshScheduled();
  };

  const cancel = async (item: ScheduledItem) => {
    if (!window.confirm(`Cancel "${item.title}" (${formatUk(item.send_after)})?`)) return;
    const res = await callSendPush({ action: 'cancel', id: item.id });
    if (res.ok) refreshScheduled();
    else window.alert(`Could not cancel: ${JSON.stringify(res.errors ?? res)}`);
  };

  const validCount = rows.filter((r) => !r.error).length;

  return (
    <>
      <h2>Scheduled Notifications</h2>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>1 — Download the template</h3>
        <p className="note">
          Fill one row per notification — general (pick a topic, optional web link or app screen)
          or event (put the event name in the Event column and the notification deep-links to that
          event's page). The template includes instructions and the current list of upcoming
          events. Dates and times are UK local.
        </p>
        <button className="btn secondary" onClick={() => downloadTemplate(events)}>Download Excel template</button>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>2 — Upload the filled file</h3>
        <p className="note">Excel (.xlsx), CSV, or a Word document containing the same table.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>
          Choose file…
        </button>
        {fileName && <span className="note" style={{ marginLeft: 10 }}>{fileName}</span>}
        {status && (
          <p className={status.startsWith('Error') ? 'err' : 'ok'} style={{ marginTop: 10 }}>{status}</p>
        )}

        {rows.length > 0 && (
          <>
            <table className="grid" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>When (UK)</th><th>Topic</th><th>Title</th><th>Message</th><th>Tap opens</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={r.error ? { background: '#FDECEA' } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.date} {r.time}</td>
                    <td>{r.topic}</td>
                    <td>{r.title.slice(0, 40)}</td>
                    <td>{r.message.slice(0, 60)}</td>
                    <td>
                      {r.error ? (
                        '—'
                      ) : (
                        <select
                          value={r.route ?? ''}
                          onChange={(e) => setRowRoute(i, e.target.value)}
                          style={{ fontSize: 12, maxWidth: 180 }}
                        >
                          <option value="">{r.link ? `web: ${r.link.slice(0, 30)}` : 'app only'}</option>
                          {events.length > 0 && (
                            <optgroup label="Event pages">
                              {events.map((ev) => (
                                <option key={ev.id} value={`/event/${ev.id}`}>
                                  {ev.title.slice(0, 40)}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="App screens">
                            {APP_SCREENS.map((s) => (
                              <option key={s.route} value={s.route}>{s.label}</option>
                            ))}
                          </optgroup>
                          {r.route && !APP_SCREENS.some((s) => s.route === r.route) && !events.some((ev) => `/event/${ev.id}` === r.route) && (
                            <option value={r.route}>{r.route}</option>
                          )}
                        </select>
                      )}
                    </td>
                    <td>{r.error ? <span className="err">{r.error}</span> : <span className="ok">ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note" style={{ marginTop: 8 }}>
              "Tap opens" — where the phone goes when the notification is tapped: an event page or
              app screen (opens in the app), a web link from the file (opens in browser), or just
              the app.
            </p>
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={scheduleAll} disabled={sending || validCount === 0}>
                {sending ? 'Scheduling…' : `Schedule ${validCount} notification(s)`}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>Waiting to send ({scheduled.length})</h3>
        <p className="note">
          Every scheduled notification, whichever section created it. Check the audience and where
          a tap takes people — cancel anything that looks wrong.
        </p>
        {scheduled.length === 0 ? (
          <p className="note">Nothing scheduled yet.</p>
        ) : (
          <table className="grid" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>When (UK)</th><th>Audience</th><th>Title</th><th>Message</th><th>Tap opens</th><th></th></tr>
            </thead>
            <tbody>
              {scheduled
                .sort((a, b) => a.send_after - b.send_after)
                .map((s) => (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatUk(s.send_after)}</td>
                    <td>{(s.topic && TOPIC_LABELS[s.topic]) ?? s.topic ?? '?'}</td>
                    <td>{s.title.slice(0, 40)}</td>
                    <td>{s.message.slice(0, 60)}</td>
                    <td>{destinationLabel(s, events).replace(/^opens /, '')}</td>
                    <td><button className="btn secondary" onClick={() => cancel(s)}>Cancel</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
