import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { insertQueued } from '../lib/queue';
import { supabase } from '../lib/supabase';
import { ukToIso } from '../lib/uktime';

/**
 * Import Wembley Stadium event days from the flyer the committee circulates
 * each month ("WEMBLEY EVENT DAYS" — a list like "Wednesday - 01st July").
 * Parsing verified against the real July 2026 PDF. Accepts PDF, Excel, CSV
 * or Word. Saving REPLACES the stadium days of the covered month(s) in the
 * dedicated stadium_days table, which is what the app's Stadium screen
 * and Events tab read. Optionally schedules a morning push for each day.
 */

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface ParsedDay {
  date: string; // YYYY-MM-DD
  statedWeekday: string | null; // weekday as written in the document
  weekdayOk: boolean; // stated weekday matches the actual date
}

interface StadiumDay {
  id: string;
  date: string;
}

function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}

/**
 * Pull "Wednesday - 01st July"-style entries out of free text. PDFs fragment
 * ordinals into separate runs ("22" + "nd" + "July"), so matching is
 * whitespace-tolerant. The year is rarely in the document body — candidates
 * come from the text, the file name, or nearby years, scored by how many
 * stated weekdays agree with the actual date.
 */
function parseDaysFromText(text: string, fileName: string): { days: ParsedDay[]; error?: string } {
  const flat = text.toLowerCase().replace(/\s+/g, ' ');
  const found: { day: number; month: number; weekday: string | null }[] = [];

  const re = new RegExp(
    `(?:(${WEEKDAYS.join('|')})\\s*[-–—:]*\\s*)?(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+(${MONTHS.join('|')})`,
    'g',
  );
  for (const m of flat.matchAll(re)) {
    const day = Number(m[2]);
    if (day < 1 || day > 31) continue;
    found.push({ day, month: MONTHS.indexOf(m[3]!) + 1, weekday: m[1] ?? null });
  }
  // numeric fallback: 25/07/2026 (Excel exports)
  for (const m of flat.matchAll(/(\d{1,2})[/.](\d{1,2})[/.](20\d{2})/g)) {
    found.push({ day: Number(m[1]), month: Number(m[2]), weekday: null });
  }
  if (found.length === 0) {
    return { days: [], error: 'No dates found — expected entries like "Wednesday - 01st July".' };
  }

  // resolve the year: explicit beats guessed; weekday agreement decides ties
  const explicit =
    flat.match(/\b(20\d{2})\b/)?.[1] ?? fileName.match(/\b(20\d{2})\b/)?.[1] ?? null;
  const nowYear = new Date().getFullYear();
  const candidates = explicit ? [Number(explicit)] : [nowYear - 1, nowYear, nowYear + 1];
  let bestYear = candidates[0]!;
  let bestScore = -1;
  for (const y of candidates) {
    const score = found.reduce((acc, f) => {
      if (!f.weekday) return acc;
      const date = `${y}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
      return acc + (weekdayOf(date) === f.weekday ? 1 : 0);
    }, 0);
    if (score > bestScore || (score === bestScore && y >= nowYear && bestYear < nowYear)) {
      bestScore = score;
      bestYear = y;
    }
  }

  const seen = new Set<string>();
  const days: ParsedDay[] = [];
  for (const f of found) {
    const date = `${bestYear}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
    if (Number.isNaN(Date.parse(date)) || seen.has(date)) continue;
    seen.add(date);
    days.push({
      date,
      statedWeekday: f.weekday,
      weekdayOk: !f.weekday || weekdayOf(date) === f.weekday,
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days };
}

async function extractText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    let text = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      for (const item of content.items) text += (item as { str?: string }).str + ' ';
    }
    return text;
  }
  if (name.endsWith('.docx')) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml')!.async('string');
    // paragraph boundaries become spaces; text runs join with nothing
    return xml.replace(/<\/w:p>/g, ' ').replace(/<[^>]+>/g, '');
  }
  // Excel / CSV: every cell becomes a text line (Date cells formatted back).
  // CSVs stay TEXT — SheetJS's fuzzy pass reads "07/08/2026" US-style.
  const isCsv = name.endsWith('.csv');
  const wb = XLSX.read(buf, isCsv ? { raw: true } : { cellDates: true });
  let text = '';
  for (const sheetName of wb.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!, { header: 1, defval: '' }) as unknown[][];
    for (const row of matrix) {
      for (const cell of row) {
        if (cell instanceof Date) {
          text += ` ${cell.getDate()}/${cell.getMonth() + 1}/${cell.getFullYear()} `;
        } else {
          text += ` ${String(cell)} `;
        }
      }
      text += '\n';
    }
  }
  return text;
}

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function monthLabel(ym: string): string {
  return new Date(`${ym}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function StadiumDays() {
  const [days, setDays] = useState<ParsedDay[]>([]);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState(true);
  const [notifyTime, setNotifyTime] = useState('08:00');
  const [existing, setExisting] = useState<StadiumDay[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshExisting = useCallback(async () => {
    const { data } = await supabase
      .from('stadium_days')
      .select('id,date')
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date');
    setExisting((data as StadiumDay[]) ?? []);
  }, []);

  useEffect(() => { refreshExisting(); }, [refreshExisting]);

  const handleFile = async (file: File) => {
    setStatus(`Reading ${file.name}…`);
    setFileName(file.name);
    try {
      const text = await extractText(file);
      const { days: parsed, error } = parseDaysFromText(text, file.name);
      setDays(parsed);
      if (error) {
        setStatus(`Error: ${error}`);
        return;
      }
      const bad = parsed.filter((d) => !d.weekdayOk).length;
      setStatus(
        `${parsed.length} event day(s) found${bad ? ` — ${bad} where the weekday in the document does not match the date (check the year)` : ' — all weekdays check out ✓'}`,
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setDays([]);
    }
  };

  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))].sort();

  const save = async () => {
    const monthNames = months.map(monthLabel).join(', ');
    if (!window.confirm(
      `Replace ALL stadium event days for ${monthNames} with these ${days.length} date(s)?` +
      (notify ? ` A push notification will also be scheduled at ${notifyTime} (UK) on each remaining day.` : ''),
    )) return;
    setSaving(true);
    setStatus('Saving…');
    try {
      // atomic replace of the covered month(s) — one transaction server-side,
      // so a failure can never leave a month emptied but not refilled.
      // stadium_days is its OWN table: never mixed with events.
      const windows = months.map((ym) => {
        const [y, m] = ym.split('-').map(Number);
        return {
          from: `${ym}-01`,
          to: m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`,
        };
      });
      const { error } = await supabase.rpc('replace_stadium_days', {
        windows,
        days: days.map((d) => d.date),
      });
      if (error) throw new Error(error.message);

      let scheduled = 0;
      let skipped = 0;
      let failures: string[] = [];
      if (notify) {
        // replace this month's pending stadium notifications along with the days
        for (const w of windows) {
          await supabase.from('notification_queue').delete()
            .eq('source', 'stadium').eq('status', 'pending')
            .gte('fire_at', ukToIso(w.from, '00:00'))
            .lt('fire_at', ukToIso(w.to, '00:00'));
        }
        const rows = days
          .map((d) => ukToIso(d.date, notifyTime))
          .filter((iso) => Date.parse(iso) > Date.now() + 60_000) // day already passed
          .map((iso) => ({
            source: 'stadium' as const,
            title: 'Stadium Event Day at Wembley',
            message:
              'Expect parking restrictions and heavy traffic around the Masjid today. Please plan ahead or use public transport.',
            topic: 'stadium',
            route: '/stadium',
            fire_at: iso,
          }));
        const res = await insertQueued(rows);
        scheduled = res.ok;
        skipped = res.duplicates;
        failures = res.failures;
      }
      setStatus(
        `Saved ${days.length} stadium day(s) for ${monthNames} ✓` +
        (notify
          ? ` — ${scheduled} notification(s) scheduled${skipped ? `, ${skipped} already scheduled (skipped)` : ''}${failures.length ? `, failed: ${failures.join('; ')}` : ''}`
          : ''),
      );
      setDays([]);
      setFileName('');
      refreshExisting();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setSaving(false);
  };

  return (
    <>
      <h2>Stadium Event Days</h2>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>Upload the Wembley event days document</h3>
        <p className="note">
          The monthly "WEMBLEY EVENT DAYS" flyer as PDF, or the same list in Excel, CSV or Word.
          Dates like "Wednesday – 01st July" are read automatically; saving replaces that month's
          stadium days in the app.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.docx"
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

        {days.length > 0 && (
          <>
            <table className="grid" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>Date</th><th>In document</th><th>Check</th></tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} style={!d.weekdayOk ? { background: '#FDECEA' } : undefined}>
                    <td>{formatDay(d.date)}</td>
                    <td>{d.statedWeekday ?? '—'}</td>
                    <td>
                      {d.weekdayOk
                        ? <span className="ok">✓</span>
                        : <span className="err">document says {d.statedWeekday}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, marginTop: 14 }}>
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              Also schedule a push notification on each day at
              <input
                type="time"
                value={notifyTime}
                onChange={(e) => setNotifyTime(e.target.value)}
                disabled={!notify}
                style={{ width: 110, margin: 0 }}
              />
              (UK time)
            </label>
            <p className="note" style={{ marginTop: 4 }}>
              Sent to everyone subscribed to Stadium notifications; tapping opens the stadium screen
              in the app. Re-uploading a month replaces its scheduled notifications too — nothing is
              double-sent. Everything queued is visible in the Notifications section.
            </p>

            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={save} disabled={saving}>
                {saving
                  ? 'Saving…'
                  : `Save — replace ${months.map(monthLabel).join(', ')} (${days.length} day(s))`}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>Currently in the app (upcoming)</h3>
        {existing.length === 0 ? (
          <p className="note">No upcoming stadium event days.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
            {existing.map((e) => (
              <li key={e.id}>
                {new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                  timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </li>
            ))}
          </ul>
        )}
        <p className="note" style={{ marginTop: 8 }}>
          Stadium days are fully separate from Events — they live only here and on the app&apos;s
          Stadium screen.
        </p>
      </div>
    </>
  );
}
