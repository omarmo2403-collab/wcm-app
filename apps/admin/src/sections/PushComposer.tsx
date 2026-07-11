import { useCallback, useEffect, useState } from 'react';

import { callSendPush, supabase } from '../lib/supabase';

// Matches the app's three notification switches exactly — congregants who
// turn a switch off are excluded from that topic's sends automatically
// (OneSignal tag filter enforced by the send-push edge function).
const TOPICS = [
  { value: 'prayer_times', label: 'Prayer Times (incl. iqamah changes)' },
  { value: 'events', label: 'Events' },
  { value: 'stadium', label: 'Stadium event days' },
];

interface ScheduledItem {
  id: string;
  title: string;
  message: string;
  send_after: number; // unix seconds
}

interface EventOption {
  id: string;
  title: string;
  starts_at: string;
}

// Fixed in-app screens a notification can open (event links are added dynamically)
const APP_SCREENS = [
  { route: '/stadium', label: 'Stadium event days screen' },
  { route: '/prayer-times', label: 'Prayer times screen' },
  { route: '/donate', label: 'Donate screen' },
  { route: '/news', label: 'News screen' },
];

/** "2026-07-25T09:00" (UK wall time) -> UTC ISO string */
function ukWallTimeToIso(local: string): string {
  const [d, t] = local.split('T');
  const [y, mo, day] = d!.split('-').map(Number);
  const [h, mi] = t!.split(':').map(Number);
  // find the UTC instant whose Europe/London wall clock matches
  const guess = Date.UTC(y!, mo! - 1, day!, h!, mi!);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const offset = (Number(fmt.format(new Date(guess))) - h! + 24) % 24;
  return new Date(guess - offset * 3600 * 1000).toISOString();
}

function formatUk(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PushComposer() {
  const [topic, setTopic] = useState('prayer_times');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [sendAt, setSendAt] = useState(''); // datetime-local, UK wall time
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  const refreshScheduled = useCallback(async () => {
    const res = await callSendPush({ action: 'list_scheduled' });
    if (res.ok) setScheduled((res.scheduled as ScheduledItem[]) ?? []);
  }, []);

  useEffect(() => {
    refreshScheduled();
    // upcoming events for the deep-link picker
    supabase
      .from('events')
      .select('id,title,starts_at')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(30)
      .then(({ data }) => setEvents((data as EventOption[]) ?? []));
  }, [refreshScheduled]);

  const send = async () => {
    const when = sendAt ? formatUk(Date.parse(ukWallTimeToIso(sendAt)) / 1000) : 'now';
    if (!window.confirm(`Send this notification to everyone subscribed to "${topic}" — ${sendAt ? `scheduled for ${when} (UK time)` : 'immediately'}?`)) return;
    setSending(true);
    setStatus('Sending…');
    // Leading "/" = in-app screen (deep link); anything else = web URL
    const link = url.trim();
    const res = await callSendPush({
      title,
      message,
      topic,
      ...(link ? (link.startsWith('/') ? { route: link } : { url: link }) : {}),
      ...(sendAt ? { send_after: ukWallTimeToIso(sendAt) } : {}),
    });
    setStatus(res.ok ? (sendAt ? `Scheduled for ${when} ✓` : 'Sent ✓') : `Failed: ${JSON.stringify(res.errors)}`);
    setSending(false);
    if (res.ok) {
      setTitle('');
      setMessage('');
      setUrl('');
      setSendAt('');
      refreshScheduled();
    }
  };

  const cancel = async (item: ScheduledItem) => {
    if (!window.confirm(`Cancel the scheduled notification "${item.title}"?`)) return;
    const res = await callSendPush({ action: 'cancel', id: item.id });
    if (res.ok) refreshScheduled();
    else window.alert(`Could not cancel: ${JSON.stringify(res.errors ?? res)}`);
  };

  return (
    <>
      <h2>Send Notification</h2>
      <div className="card" style={{ maxWidth: 560 }}>
        <label>Audience topic</label>
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <label>Title ({title.length}/65)</label>
        <input value={title} maxLength={65} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Isha iqamah change" />

        <label>Message ({message.length}/178)</label>
        <textarea value={message} maxLength={178} onChange={(e) => setMessage(e.target.value)} placeholder="Keep it short — this is a phone notification." />

        <label>Open in app when tapped (optional)</label>
        <select value={url.startsWith('/') ? url : ''} onChange={(e) => setUrl(e.target.value)}>
          <option value="">— nothing / web link below —</option>
          {events.length > 0 && (
            <optgroup label="Event pages">
              {events.map((ev) => (
                <option key={ev.id} value={`/event/${ev.id}`}>
                  {ev.title} ({new Date(ev.starts_at).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })})
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="App screens">
            {APP_SCREENS.map((s) => (
              <option key={s.route} value={s.route}>{s.label}</option>
            ))}
          </optgroup>
        </select>

        <label>…or a web link (optional — opens in browser)</label>
        <input
          value={url.startsWith('/') ? '' : url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />

        <label>Schedule (optional — UK time; leave empty to send now)</label>
        <input
          type="datetime-local"
          value={sendAt}
          onChange={(e) => setSendAt(e.target.value)}
        />

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={send} disabled={sending || !title.trim() || !message.trim()}>
            {sendAt ? 'Schedule notification' : 'Send notification'}
          </button>
          {status && <span className={status.startsWith('Failed') ? 'err' : 'ok'}>{status}</span>}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Scheduled — waiting to send</h3>
        {scheduled.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
            Nothing scheduled. Use the field above to queue notifications ahead of time — e.g. all
            stadium event days for the season.
          </p>
        ) : (
          scheduled
            .sort((a, b) => a.send_after - b.send_after)
            .map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{s.message}</div>
                  <div style={{ fontSize: 12, color: 'var(--green, #159778)', fontWeight: 600 }}>
                    {formatUk(s.send_after)} (UK)
                  </div>
                </div>
                <button className="btn-secondary" onClick={() => cancel(s)}>Cancel</button>
              </div>
            ))
        )}
      </div>

      <div className="card" style={{ maxWidth: 560, background: '#f9f9fb' }}>
        <h3>Preview</h3>
        <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Wembley Central Masjid · now</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title || 'Notification title'}</div>
          <div style={{ fontSize: 13 }}>{message || 'Notification message appears here.'}</div>
        </div>
      </div>
    </>
  );
}
