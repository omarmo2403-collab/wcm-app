import { useState } from 'react';

import { callSendPush } from '../lib/supabase';

const TOPICS = [
  { value: 'announcements', label: 'Announcements (general)' },
  { value: 'prayer_times', label: 'Prayer time changes' },
  { value: 'events', label: 'Events' },
  { value: 'jumuah', label: "Jumu'ah reminders" },
  { value: 'donations', label: 'Donation appeals' },
  { value: 'madrasah', label: 'Madrasah' },
  { value: 'stadium', label: 'Stadium event days' },
];

export function PushComposer() {
  const [topic, setTopic] = useState('announcements');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!window.confirm(`Send this notification to everyone subscribed to "${topic}"?`)) return;
    setSending(true);
    setStatus('Sending…');
    const res = await callSendPush({ title, message, topic, ...(url ? { url } : {}) });
    setStatus(res.ok ? 'Sent ✓' : `Failed: ${JSON.stringify(res.errors)}`);
    setSending(false);
    if (res.ok) {
      setTitle('');
      setMessage('');
      setUrl('');
    }
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

        <label>Link (optional — opens when tapped)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={send} disabled={sending || !title.trim() || !message.trim()}>
            Send notification
          </button>
          {status && <span className={status.startsWith('Failed') ? 'err' : 'ok'}>{status}</span>}
        </div>
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
