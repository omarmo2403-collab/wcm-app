import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

const HINTS: Record<string, string> = {
  hijri_offset_days: 'Moon-sighting adjustment: -1, 0 or 1. Changes the Hijri date shown in the app.',
  live_events_url: 'URL for the "Watch Live Events" card. Use null to show "coming soon".',
  tour_url: '360° tour URL. null hides the button behaviour.',
  is_ramadan: 'true promotes Suhoor/Iftar in the widget (needs timetable columns filled).',
  donation_fallback_url: 'Used when a donation category has no URL of its own.',
  qibla_bearing_degrees: 'Fallback bearing shown when phone sensors are unavailable.',
};

export function ConfigSection() {
  const [rows, setRows] = useState<{ key: string; value: string }[]>([]);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('app_config').select('*').order('key');
    if (error) setStatus(`Error: ${error.message}`);
    else setRows((data ?? []).map((r) => ({ key: r.key, value: JSON.stringify(r.value) })));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string, raw: string) => {
    setStatus('');
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      setStatus(`"${key}": not valid JSON — wrap text in double quotes, e.g. "https://…"`);
      return;
    }
    const { error } = await supabase.from('app_config').upsert({ key, value });
    setStatus(error ? `Error: ${error.message}` : `${key} saved ✓`);
  };

  return (
    <>
      <h2>App Config</h2>
      <p className="note" style={{ marginBottom: 12 }}>
        Values are JSON: text needs double quotes (&quot;https://…&quot;), numbers and true/false/null do not.
      </p>
      {status && <p className={status.includes('Error') || status.includes('not valid') ? 'err' : 'ok'}>{status}</p>}
      {rows.map((row, i) => (
        <div className="card" key={row.key}>
          <h3>{row.key}</h3>
          {HINTS[row.key] && <p className="note" style={{ marginBottom: 8 }}>{HINTS[row.key]}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={row.value}
              onChange={(e) =>
                setRows((r) => r.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
            />
            <button className="btn small" onClick={() => save(row.key, row.value)}>Save</button>
          </div>
        </div>
      ))}
    </>
  );
}
