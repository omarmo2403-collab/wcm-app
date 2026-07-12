import { useCallback, useEffect, useState } from 'react';

import {
  cancelRow, insertQueued, listUpcoming, SOURCE_LABELS, TOPIC_LABELS, type QueueRow,
} from '../lib/queue';
import { callSendPush, supabase } from '../lib/supabase';
import { formatUk, ukToIso } from '../lib/uktime';

// Matches the app's three notification switches exactly — congregants who
// turn a switch off are excluded from that topic's sends automatically
// (OneSignal tag filter enforced by the send-push edge function).
const TOPICS = [
  { value: 'prayer_times', label: 'Prayer Times (incl. iqamah changes)' },
  { value: 'events', label: 'Events' },
  { value: 'stadium', label: 'Stadium event days' },
];

interface EventOption {
  id: string;
  title: string;
  starts_at: string;
  all_day: boolean;
}

function formatEventDate(ev: EventOption): string {
  const d = new Date(ev.starts_at);
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (ev.all_day) return date;
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date}, ${time}`;
}

/** "2026-07-25T09:00" (UK wall time) -> UTC ISO string */
function ukWallTimeToIso(local: string): string {
  const [d, t] = local.split('T');
  return ukToIso(d!, t ?? '00:00');
}

/** Where a tap takes the phone — for the scheduled list. */
function tapOpens(r: QueueRow): string {
  if (r.route?.startsWith('/event/')) return 'opens event page';
  if (r.route) return `opens app screen ${r.route}`;
  if (r.url) return `opens web link: ${r.url.slice(0, 40)}`;
  return 'opens the app';
}

export function PushComposer() {
  const [kind, setKind] = useState<'general' | 'event'>('general');
  const [topic, setTopic] = useState('prayer_times');
  const [eventId, setEventId] = useState('');
  const [deepLink, setDeepLink] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [sendAt, setSendAt] = useState(''); // datetime-local, UK wall time
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduled, setScheduled] = useState<QueueRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  const refreshScheduled = useCallback(async () => {
    setScheduled(await listUpcoming());
  }, []);

  useEffect(() => {
    refreshScheduled();
    // upcoming events for the event-notification picker
    supabase
      .from('events')
      .select('id,title,starts_at,all_day')
      .eq('is_published', true) // drafts would deep-link to a page the app can't load
      .neq('category', 'stadium') // stadium days: use the Stadium topic instead
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(30)
      .then(({ data }) => setEvents((data as EventOption[]) ?? []));
  }, [refreshScheduled]);

  const selectEvent = (id: string) => {
    setEventId(id);
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    // prefill — staff can edit both before sending
    if (!title.trim()) setTitle(ev.title.slice(0, 65));
    if (!message.trim()) setMessage(`${formatEventDate(ev)} — tap for details.`.slice(0, 178));
  };

  const effectiveTopic = kind === 'event' ? 'events' : topic;

  const send = async () => {
    const when = sendAt ? formatUk(ukWallTimeToIso(sendAt)) : 'now';
    if (!window.confirm(`Send this notification to everyone subscribed to "${effectiveTopic}" — ${sendAt ? `scheduled for ${when} (UK time)` : 'immediately'}?`)) return;
    setSending(true);
    setStatus('Sending…');
    const link = url.trim();
    const route = kind === 'event' && deepLink && eventId ? `/event/${eventId}` : undefined;
    let ok: boolean;
    let failMsg = '';
    if (sendAt) {
      // scheduled: one queue row; the dispatcher sends it at fire time
      const res = await insertQueued([{
        source: 'composer',
        title,
        message,
        topic: effectiveTopic,
        fire_at: ukWallTimeToIso(sendAt),
        ...(route ? { route } : kind === 'general' && link ? { url: link } : {}),
      }]);
      ok = res.ok === 1;
      failMsg = res.duplicates
        ? 'same audience already scheduled at that minute — pick another time or cancel it in Notifications'
        : res.failures.join('; ');
    } else {
      const res = await callSendPush({
        title,
        message,
        topic: effectiveTopic,
        ...(route ? { route } : {}),
        ...(kind === 'general' && link ? { url: link } : {}),
      });
      ok = Boolean(res.ok);
      failMsg = typeof res.message === 'string' ? res.message : JSON.stringify(res.errors);
    }
    setStatus(ok ? (sendAt ? `Scheduled for ${when} ✓` : 'Sent ✓') : `Failed: ${failMsg}`);
    setSending(false);
    if (ok) {
      setTitle('');
      setMessage('');
      setUrl('');
      setSendAt('');
      setEventId('');
      refreshScheduled();
    }
  };

  const cancel = async (item: QueueRow) => {
    if (!window.confirm(`Cancel the scheduled notification "${item.title}"?`)) return;
    const e = await cancelRow(item.id);
    if (e) window.alert(`Could not cancel: ${e}`);
    else refreshScheduled();
  };

  const canSend = title.trim() && message.trim() && (kind === 'general' || eventId);

  return (
    <>
      <h2>Send Notification</h2>
      <div className="card" style={{ maxWidth: 560 }}>
        <label>Notification type</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            className={kind === 'general' ? 'btn' : 'btn secondary'}
            onClick={() => setKind('general')}
          >
            General
          </button>
          <button
            className={kind === 'event' ? 'btn' : 'btn secondary'}
            onClick={() => setKind('event')}
          >
            Event
          </button>
        </div>

        {kind === 'general' ? (
          <>
            <label>Audience topic</label>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label>Event</label>
            <select value={eventId} onChange={(e) => selectEvent(e.target.value)}>
              <option value="">— select an event —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({formatEventDate(ev)})
                </option>
              ))}
            </select>
            {events.length === 0 && (
              <p className="note" style={{ marginTop: 4 }}>
                No upcoming events — add one in the Events section first.
              </p>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={deepLink}
                onChange={(e) => setDeepLink(e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              Tapping the notification opens the event page in the app
            </label>
            <p className="note" style={{ marginTop: 4 }}>
              Sent to everyone subscribed to Events notifications.
            </p>
          </>
        )}

        <label>Title ({title.length}/65)</label>
        <input value={title} maxLength={65} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'event' ? 'Prefilled from the event — edit freely' : 'e.g. Isha iqamah change'} />

        <label>Message ({message.length}/178)</label>
        <textarea value={message} maxLength={178} onChange={(e) => setMessage(e.target.value)} placeholder="Keep it short — this is a phone notification." />

        {kind === 'general' && (
          <>
            <label>Web link (optional — opens in browser when tapped)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </>
        )}

        <label>Schedule (optional — UK time; leave empty to send now)</label>
        <input
          type="datetime-local"
          value={sendAt}
          onChange={(e) => setSendAt(e.target.value)}
        />

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={send} disabled={sending || !canSend}>
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
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {s.title}
                    <span style={{
                      marginLeft: 8, fontWeight: 600, fontSize: 11, padding: '1px 8px',
                      borderRadius: 999, background: 'rgba(21,151,120,0.1)', color: 'var(--green, #159778)',
                    }}>
                      {TOPIC_LABELS[s.topic] ?? s.topic}
                    </span>
                    <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 11, color: 'var(--text-light)' }}>
                      {SOURCE_LABELS[s.source]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{s.message}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                    Tap: {tapOpens(s)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--green, #159778)', fontWeight: 600 }}>
                    {formatUk(s.fire_at)} (UK)
                  </div>
                </div>
                <button className="btn secondary" onClick={() => cancel(s)}>Cancel</button>
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
          {kind === 'event' && deepLink && eventId && (
            <div style={{ fontSize: 12, color: 'var(--green, #159778)', marginTop: 4 }}>
              ↳ opens the event page in the app
            </div>
          )}
        </div>
      </div>
    </>
  );
}
