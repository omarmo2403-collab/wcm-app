import { useCallback, useEffect, useRef, useState } from 'react';

import { callSendPush, supabase } from '../lib/supabase';
import { parseTimetableDocument } from '../lib/timetable-import';

const PRAYER_FIELDS = [
  'fajr_begins', 'fajr_iqamah', 'sunrise',
  'zuhr_begins', 'zuhr_iqamah',
  'asr_begins', 'asr_iqamah',
  'maghrib_begins', 'maghrib_iqamah',
  'isha_begins', 'isha_iqamah',
] as const;
type Field = (typeof PRAYER_FIELDS)[number];
const IQAMAH_FIELDS: Field[] = ['fajr_iqamah', 'zuhr_iqamah', 'asr_iqamah', 'maghrib_iqamah', 'isha_iqamah'];

const HEAD: Record<Field, string> = {
  fajr_begins: 'Fajr', fajr_iqamah: 'Iqamah', sunrise: 'Sunrise',
  zuhr_begins: 'Zuhr', zuhr_iqamah: 'Iqamah',
  asr_begins: 'Asr', asr_iqamah: 'Iqamah',
  maghrib_begins: 'Maghrib', maghrib_iqamah: 'Iqamah',
  isha_begins: 'Isha', isha_iqamah: 'Iqamah',
};

type Row = { date: string } & Record<Field, string>;

function monthNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y!, m!, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

function prettyPrayer(field: Field): string {
  return field.split('_')[0]!.replace(/^./, (c) => c.toUpperCase());
}

/** within N days from today (inclusive), i.e. worth pushing about */
function isNearTerm(dateISO: string, days = 14): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateISO}T00:00:00`);
  const diff = (d.getTime() - today.getTime()) / 86_400_000;
  return diff >= 0 && diff <= days;
}

export function Timetable() {
  const [month, setMonth] = useState(monthNow());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [original, setOriginal] = useState<Record<string, Row>>({});
  const [status, setStatus] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setStatus('');
    const { data, error } = await supabase
      .from('prayer_times')
      .select('*')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .order('date');
    if (error) { setStatus(`Error: ${error.message}`); return; }
    const map: Record<string, Row> = {};
    for (const r of data ?? []) {
      const row = { date: r.date } as Row;
      for (const f of PRAYER_FIELDS) row[f] = String(r[f] ?? '').slice(0, 5);
      map[r.date] = row;
    }
    setRows(map);
    setOriginal(JSON.parse(JSON.stringify(map)));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const setCell = (date: string, field: Field, value: string) =>
    setRows((r) => ({ ...r, [date]: { ...(r[date] ?? ({ date } as Row)), [field]: value } }));

  const dirtyDates = Object.keys(rows).filter(
    (d) => JSON.stringify(rows[d]) !== JSON.stringify(original[d]),
  );

  const save = async () => {
    setStatus('Saving…');
    const payload = dirtyDates.map((d) => {
      const row = rows[d]!;
      const out: Record<string, string> = { date: d };
      for (const f of PRAYER_FIELDS) out[f] = row[f] || '00:00';
      return out;
    });
    const { error } = await supabase.from('prayer_times').upsert(payload);
    if (error) { setStatus(`Error: ${error.message}`); return; }

    // Iqamah-change push automation (REBUILD_PLAN §4 layer 2):
    // near-term iqamah edits offer an automatic congregation announcement.
    const changes: string[] = [];
    for (const d of dirtyDates) {
      if (!isNearTerm(d) || !original[d]) continue;
      for (const f of IQAMAH_FIELDS) {
        if (rows[d]![f] !== original[d]![f]) {
          changes.push(`${prettyPrayer(f)} iqamah is now ${rows[d]![f]} on ${new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`);
        }
      }
    }
    if (changes.length > 0) {
      const body = changes.join('. ');
      if (window.confirm(`Saved. Notify the congregation now?\n\n"${body}"`)) {
        const res = await callSendPush({
          title: 'Prayer time change',
          message: body,
          topic: 'prayer_times',
        });
        setStatus(res.ok ? 'Saved — congregation notified ✓' : `Saved, but push failed: ${JSON.stringify(res.errors)}`);
        await load();
        return;
      }
    }
    setStatus('Saved ✓');
    await load();
  };

  /** Committee document import: parse .docx/.pdf in the browser, fill the
   *  grid as pending changes — the admin reviews, then Save runs the normal
   *  upsert + near-term iqamah-change push flow. */
  const importDocument = async (file: File) => {
    setStatus(`Reading ${file.name}…`);
    try {
      const result = await parseTimetableDocument(file);
      if (!result.month || result.days.length === 0) {
        setStatus(`Error: ${result.warnings[0] ?? 'nothing parsed'}`);
        return;
      }
      setMonth(result.month);
      // load existing rows for that month first so dirty-diffing works
      const { data } = await supabase
        .from('prayer_times')
        .select('*')
        .gte('date', `${result.month}-01`)
        .lte('date', `${result.month}-31`);
      const existing: Record<string, Row> = {};
      for (const r of data ?? []) {
        const row = { date: r.date } as Row;
        for (const f of PRAYER_FIELDS) row[f] = String(r[f] ?? '').slice(0, 5);
        existing[r.date] = row;
      }
      setOriginal(JSON.parse(JSON.stringify(existing)));
      const next: Record<string, Row> = { ...existing };
      for (const d of result.days) {
        const row = { date: d.date } as Row;
        for (const f of PRAYER_FIELDS) row[f] = (d[f as keyof typeof d] ?? '') as string;
        next[d.date] = row;
      }
      setRows(next);
      const monthName = new Date(`${result.month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      setStatus(
        `Parsed ${result.days.length} days for ${monthName}` +
        (result.warnings.length ? ` — ${result.warnings.length} warning(s): ${result.warnings.slice(0, 3).join('; ')}` : ' ✓') +
        ' — review below, then Save.',
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const importCsv = async () => {
    setStatus('Importing…');
    const lines = csvText.trim().split(/\r?\n/).filter((l) => l && !l.startsWith('date'));
    const payload = lines.map((line) => {
      const parts = line.split(',').map((s) => s.trim());
      const out: Record<string, string> = { date: parts[0]! };
      PRAYER_FIELDS.forEach((f, i) => { out[f] = parts[i + 1] ?? '00:00'; });
      return out;
    });
    const { error } = await supabase.from('prayer_times').upsert(payload);
    setStatus(error ? `Import error: ${error.message}` : `Imported ${payload.length} days ✓`);
    if (!error) { setCsvOpen(false); setCsvText(''); load(); }
  };

  const days = daysInMonth(month);
  const covered = days.filter((d) => rows[d]).length;

  return (
    <>
      <h2>Prayer Times</h2>
      <div className="toolbar">
        <input type="month" style={{ width: 170 }} value={month} onChange={(e) => setMonth(e.target.value)} />
        <span className="note">{covered}/{days.length} days have times</span>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importDocument(f);
            e.target.value = '';
          }}
        />
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>
          Import committee document
        </button>
        <button className="btn secondary" onClick={() => setCsvOpen((v) => !v)}>CSV import</button>
        <button className="btn" onClick={save} disabled={dirtyDates.length === 0}>
          Save {dirtyDates.length > 0 ? `${dirtyDates.length} changed day(s)` : 'changes'}
        </button>
        {status && <span className={status.startsWith('Error') || status.includes('failed') ? 'err' : 'ok'}>{status}</span>}
      </div>
      <p className="note" style={{ marginBottom: 10 }}>
        <strong>Monthly workflow:</strong> click &ldquo;Import committee document&rdquo; and choose
        the timetable Word/PDF file — every day is auto-filled (blank jamat cells inherit the
        previous day, exactly as printed). Review the highlighted rows, then Save.
        Editing a day within the next 14 days offers to push an automatic
        &ldquo;prayer time change&rdquo; alert to the congregation. Phones re-sync their local
        alarms when the app is next opened or in daily background sync.
      </p>

      {csvOpen && (
        <div className="card">
          <h3>CSV import</h3>
          <p className="note">
            One line per day: date,fajr_begins,fajr_iqamah,sunrise,zuhr_begins,zuhr_iqamah,asr_begins,asr_iqamah,maghrib_begins,maghrib_iqamah,isha_begins,isha_iqamah
            — 24-hour times, e.g. 2026-08-01,03:39,04:45,05:21,13:12,13:30,18:25,19:30,20:52,20:52,21:54,22:00
          </p>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} style={{ minHeight: 140 }} />
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={importCsv} disabled={!csvText.trim()}>Import</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="grid">
          <thead>
            <tr>
              <th>Date</th>
              {PRAYER_FIELDS.map((f) => (
                <th key={f}>{HEAD[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const row = rows[d];
              const dirty = dirtyDates.includes(d);
              return (
                <tr key={d} className={dirty ? 'dirty' : ''}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' })}
                  </td>
                  {PRAYER_FIELDS.map((f) => (
                    <td key={f}>
                      <input
                        type="time"
                        value={row?.[f] ?? ''}
                        onChange={(e) => setCell(d, f, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
