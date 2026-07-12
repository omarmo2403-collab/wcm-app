import { useCallback, useEffect, useState } from 'react';

import {
  cancelRow, listSent, listUpcoming, SOURCE_LABELS, TOPIC_LABELS, type QueueRow,
} from '../lib/queue';
import { formatUk } from '../lib/uktime';

/** Where "edit" jumps for each source (App.tsx section keys). */
const SOURCE_SECTION: Partial<Record<QueueRow['source'], string>> = {
  event: 'events',
  stadium: 'stadiumdays',
  template: 'schedule',
  composer: 'push',
};

function tapOpens(r: QueueRow): string {
  if (r.route?.startsWith('/event/')) return 'event page';
  if (r.route) return `app screen ${r.route}`;
  if (r.url) return `web: ${r.url.slice(0, 40)}`;
  return 'the app';
}

export function Notifications({ goTo }: { goTo: (section: string) => void }) {
  const [tab, setTab] = useState<'upcoming' | 'sent'>('upcoming');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setRows(tab === 'upcoming' ? await listUpcoming() : await listSent());
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const cancel = async (r: QueueRow) => {
    if (!window.confirm(`Cancel "${r.title}" (${formatUk(r.fire_at)} UK)? It will not be sent.`)) return;
    const e = await cancelRow(r.id);
    if (e) setErr(`Could not cancel: ${e}`);
    else load();
  };

  return (
    <>
      <h2>Notifications</h2>
      <p className="note">
        Every push the app will send and (for 30 days) has sent — event reminders, stadium days,
        scheduled, composer and prayer-time changes. Cancel here; edit at the source.
      </p>
      {err && <p className="err">{err}</p>}
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
        <button className={tab === 'upcoming' ? 'btn' : 'btn secondary'} onClick={() => setTab('upcoming')}>
          Upcoming
        </button>
        <button className={tab === 'sent' ? 'btn' : 'btn secondary'} onClick={() => setTab('sent')}>
          Sent (30 days)
        </button>
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <p className="note">
            {tab === 'upcoming' ? 'Nothing waiting to send.' : 'Nothing sent in the last 30 days.'}
          </p>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>When (UK)</th>
                <th>Audience</th>
                <th>Title</th>
                <th>Message</th>
                <th>Tap opens</th>
                <th>Source</th>
                <th>{tab === 'upcoming' ? '' : 'Outcome'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatUk(r.fire_at)}</td>
                  <td>{TOPIC_LABELS[r.topic] ?? r.topic}</td>
                  <td>{r.title.slice(0, 40)}</td>
                  <td>{r.message.slice(0, 60)}</td>
                  <td>{tapOpens(r)}</td>
                  <td>
                    {SOURCE_LABELS[r.source]}
                    {SOURCE_SECTION[r.source] && (
                      <>
                        {' '}
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            goTo(SOURCE_SECTION[r.source]!);
                          }}
                        >
                          edit
                        </a>
                      </>
                    )}
                  </td>
                  <td>
                    {tab === 'upcoming' ? (
                      <button className="btn small secondary" onClick={() => cancel(r)}>Cancel</button>
                    ) : r.status === 'sent' ? (
                      <span className="ok">sent ✓{r.recipients != null ? ` ${r.recipients}` : ''}</span>
                    ) : (
                      <span className={r.status === 'canceled' ? 'note' : 'err'}>
                        {r.status}
                        {r.error ? ` — ${r.error.slice(0, 60)}` : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
