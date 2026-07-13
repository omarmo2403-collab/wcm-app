import { useCallback, useEffect, useState } from 'react';

import { composeEventReminder, type QueueRow } from '../lib/queue';
import { callSendPush, supabase } from '../lib/supabase';
import { formatUk, isoToUkInput, ukToIso } from '../lib/uktime';

type ColumnType = 'text' | 'textarea' | 'number' | 'bool' | 'datetime' | 'time' | 'select' | 'image' | 'video';

const MEDIA_URL = 'https://gjffozmcbdtafdsxifyq.supabase.co/storage/v1/object/public/media/';

interface Column {
  key: string;
  label: string;
  type: ColumnType;
  options?: string[];
  listHidden?: boolean;
  /** managed by a custom control (e.g. the events schedule fields), not rendered as a plain input */
  formHidden?: boolean;
}

export interface CrudConfig {
  table: string;
  title: string;
  note?: string;
  orderBy: string;
  columns: Column[];
}

export const CRUD_SECTIONS: Record<string, CrudConfig> = {
  events: {
    table: 'events',
    title: 'Events',
    note: 'Only published events appear in the app. All times are UK (Europe/London), whatever timezone this computer is in.',
    orderBy: 'starts_at',
    columns: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', listHidden: true },
      { key: 'starts_at', label: 'Starts (UK)', type: 'datetime' },
      { key: 'all_day', label: 'All day', type: 'bool', listHidden: true, formHidden: true },
      { key: 'time_label', label: 'Time label', type: 'text', listHidden: true, formHidden: true },
      { key: 'notify_at', label: 'Reminder', type: 'datetime', listHidden: true, formHidden: true },
      { key: 'notify_message', label: 'Custom reminder message', type: 'textarea', listHidden: true, formHidden: true },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        // 'stadium' intentionally absent — stadium days have their own section
        options: ['community', 'lecture', 'madrasah', 'ramadan', 'eid', 'fundraising'],
      },
      { key: 'location', label: 'Location', type: 'text', listHidden: true },
      { key: 'image_path', label: 'Image', type: 'image', listHidden: true },
      { key: 'is_published', label: 'Published', type: 'bool' },
    ],
  },
  news: {
    table: 'news',
    title: 'News',
    orderBy: 'published_at',
    columns: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea', listHidden: true },
      { key: 'image_path', label: 'Image (optional)', type: 'image', listHidden: true },
      { key: 'published_at', label: 'Published at (UK)', type: 'datetime' },
      { key: 'is_published', label: 'Published', type: 'bool' },
    ],
  },
  notices: {
    table: 'notices',
    title: 'Home-screen Notices',
    note: 'The strip under the prayer widget, e.g. stadium parking warnings.',
    orderBy: 'starts_at',
    columns: [
      { key: 'message', label: 'Message', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'text' },
      { key: 'action_type', label: 'Action', type: 'select', options: ['none', 'screen', 'url'] },
      { key: 'action_target', label: 'Target', type: 'text' },
      { key: 'starts_at', label: 'From (UK)', type: 'datetime' },
      { key: 'ends_at', label: 'Until (UK)', type: 'datetime' },
      { key: 'is_active', label: 'Active', type: 'bool' },
    ],
  },
  banners: {
    table: 'banners',
    title: 'Home Banners',
    note: 'Upload a poster image to show it full-size in the carousel (like event posters). Add a video (YouTube link or upload) for a playable video card. Leave both empty for a text banner.',
    orderBy: 'sort_order',
    columns: [
      { key: 'badge', label: 'Badge (text banners)', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle (text banners)', type: 'text' },
      { key: 'image_path', label: 'Poster image', type: 'image', listHidden: true },
      { key: 'video_url', label: 'Video (YouTube link or upload)', type: 'video', listHidden: true },
      { key: 'action_type', label: 'Action', type: 'select', options: ['none', 'screen', 'url'] },
      { key: 'action_target', label: 'Target', type: 'text' },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'bool' },
    ],
  },
  media: {
    table: 'gallery_images',
    title: 'Home Media',
    note: 'Photos and videos shown in the strip below the home banners. Upload a photo, or add a video (YouTube link or upload) — a photo alongside a video acts as its thumbnail.',
    orderBy: 'sort_order',
    columns: [
      { key: 'caption', label: 'Caption (optional)', type: 'text' },
      { key: 'storage_path', label: 'Photo (or video thumbnail)', type: 'image', listHidden: true },
      { key: 'video_url', label: 'Video (YouTube link or upload)', type: 'video', listHidden: true },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'is_published', label: 'Published', type: 'bool' },
    ],
  },
  donations: {
    table: 'donation_categories',
    title: 'Donation Categories',
    note: 'URL is where the app sends donors — point it at the campaign page.',
    orderBy: 'sort_order',
    columns: [
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', listHidden: true },
      { key: 'icon', label: 'Icon', type: 'text' },
      { key: 'url', label: 'Donation URL', type: 'text' },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'bool' },
    ],
  },
  madrasah: {
    table: 'madrasah_classes',
    title: 'Madrasah Classes',
    orderBy: 'sort_order',
    columns: [
      { key: 'name', label: 'Class', type: 'text' },
      { key: 'days', label: 'Days', type: 'text' },
      { key: 'time_range', label: 'Time', type: 'text' },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'bool' },
    ],
  },
  services: {
    table: 'services',
    title: 'Services',
    orderBy: 'sort_order',
    columns: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Short description', type: 'text' },
      { key: 'body', label: 'Page content', type: 'textarea', listHidden: true },
      { key: 'icon', label: 'Icon', type: 'text' },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'bool' },
    ],
  },
  jumuah: {
    table: 'jumuah_times',
    title: "Jumu'ah Times",
    note: 'Changing these updates the app widget and Friday reminders.',
    orderBy: 'sort_order',
    columns: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'khutbah_time', label: 'Khutbah', type: 'time' },
      { key: 'iqamah_time', label: 'Iqamah', type: 'time' },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'bool' },
    ],
  },
};

type Row = Record<string, unknown> & { id: string };

function toInput(value: unknown, type: ColumnType): string | boolean {
  if (type === 'bool') return Boolean(value);
  if (value == null) return '';
  if (type === 'datetime') return isoToUkInput(String(value));
  if (type === 'time') return String(value).slice(0, 5);
  return String(value);
}

function fromInput(value: string | boolean, type: ColumnType): unknown {
  if (type === 'bool') return Boolean(value);
  if (typeof value !== 'string' || value === '') {
    if (type === 'number') return 0;
    // empty TEXT stays '' — most text columns are NOT NULL DEFAULT '', and an
    // explicit null both fails inserts and makes clearing a field impossible
    if (type === 'text' || type === 'textarea') return '';
    return null; // datetime / image / video / select: nullable by design
  }
  if (type === 'number') return Number(value);
  if (type === 'datetime') {
    const [d, t] = value.split('T');
    return ukToIso(d!, t || '00:00');
  }
  return value;
}

function Editor({
  config,
  row,
  onDone,
}: {
  config: CrudConfig;
  row: Row | null;
  onDone: (changed: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      config.columns.map((c) => [
        c.key,
        // selects must START on a real option — '' matches none, and an
        // untouched select would otherwise submit null into a NOT NULL column
        row == null && c.type === 'select'
          ? (c.options?.[0] ?? '')
          : toInput(row?.[c.key], c.type),
      ]),
    ),
  );
  const [err, setErr] = useState('');
  // in-flight image/video uploads — Save must wait for them, or a quick
  // Save races the upload and the row is stored without the file
  const [uploading, setUploading] = useState(0);

  const save = async () => {
    setErr('');
    const payload = Object.fromEntries(
      config.columns.map((c) => [c.key, fromInput(values[c.key] ?? '', c.type)]),
    );
    const q = row
      ? supabase.from(config.table).update(payload).eq('id', row.id)
      : supabase.from(config.table).insert(payload);
    const { error } = await q;
    if (error) setErr(error.message);
    else onDone(true);
  };

  const renderField = (c: Column) => (
        <div key={c.key}>
          <label>{c.label}</label>
          {c.type === 'textarea' ? (
            <textarea
              value={String(values[c.key] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
            />
          ) : c.type === 'bool' ? (
            <input
              type="checkbox"
              checked={Boolean(values[c.key])}
              onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.checked }))}
            />
          ) : c.type === 'select' ? (
            <select
              value={String(values[c.key] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
            >
              {(c.options ?? []).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : c.type === 'video' ? (
            <div>
              <input
                type="text"
                placeholder="Paste a YouTube link, or upload a video file below"
                value={String(values[c.key] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
              />
              <input
                type="file"
                accept="video/mp4,video/webm"
                style={{ marginTop: 6 }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 50 * 1024 * 1024) {
                    setErr('Video too large — keep uploads under 50 MB (or use YouTube).');
                    return;
                  }
                  setErr('');
                  setUploading((u) => u + 1);
                  try {
                    const path = `videos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                    const { error } = await supabase.storage.from('media').upload(path, file, {
                      cacheControl: '31536000',
                      upsert: false,
                    });
                    if (error) setErr(`Video upload failed: ${error.message}`);
                    else setValues((v) => ({ ...v, [c.key]: MEDIA_URL + path }));
                  } finally {
                    setUploading((u) => u - 1);
                  }
                  e.target.value = '';
                }}
              />
            </div>
          ) : c.type === 'image' ? (
            <div>
              {values[c.key] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <img
                    src={MEDIA_URL + String(values[c.key])}
                    alt=""
                    style={{ height: 60, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, [c.key]: '' }))}
                  >
                    Remove image
                  </button>
                </div>
              ) : null}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setErr('');
                  setUploading((u) => u + 1);
                  try {
                    const path = `${config.table}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                    const { error } = await supabase.storage.from('media').upload(path, file, {
                      cacheControl: '31536000',
                      upsert: false,
                    });
                    if (error) setErr(`Image upload failed: ${error.message}`);
                    else setValues((v) => ({ ...v, [c.key]: path }));
                  } finally {
                    setUploading((u) => u - 1);
                  }
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <input
              type={c.type === 'datetime' ? 'datetime-local' : c.type === 'time' ? 'time' : c.type === 'number' ? 'number' : 'text'}
              value={String(values[c.key] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
            />
          )}
        </div>
  );

  const visible = config.columns.filter((c) => !c.formHidden);
  const splitAt = config.table === 'events'
    ? visible.findIndex((c) => c.key === 'starts_at') + 1
    : visible.length;

  return (
    <div className="card">
      <h3>{row ? 'Edit' : 'New'}</h3>
      {visible.slice(0, splitAt).map(renderField)}
      {config.table === 'events' && (
        <EventScheduleFields values={values} setValues={setValues} row={row} />
      )}
      {visible.slice(splitAt).map(renderField)}
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button className="btn" onClick={save} disabled={uploading > 0}>
          {uploading > 0 ? 'Uploading…' : 'Save'}
        </button>
        <button className="btn secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * Events-only schedule controls: one "Time type" choice replaces the
 * all_day/time_label tangle, and the "Reminder" picker writes an explicit
 * notify_at (the DB default remains only a safety net). Shows the exact
 * push text that will go out, and the sent/failed status afterwards.
 */
function EventScheduleFields({ values, setValues, row }: {
  values: Record<string, string | boolean>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | boolean>>>;
  row: Row | null;
}) {
  // own state, not derived: deriving from the label made "Flexible" impossible
  // to select (empty label snapped it back to "All day")
  const [timeType, setTimeType] = useState<'fixed' | 'flexible' | 'allday'>(() =>
    values.all_day ? (String(values.time_label ?? '').trim() ? 'flexible' : 'allday') : 'fixed',
  );
  const [reminderMode, setReminderMode] = useState<'auto' | 'morning' | 'custom' | 'none'>(
    () => (row ? (values.notify_at ? 'custom' : 'none') : 'auto'),
  );
  const [queueRow, setQueueRow] = useState<QueueRow | null>(null);
  const [sendingNow, setSendingNow] = useState(false);
  const [sendStatus, setSendStatus] = useState('');

  const refreshQueueRow = useCallback(() => {
    if (!row) return;
    supabase.from('notification_queue')
      .select('id,source,source_id,title,message,topic,route,url,fire_at,status,sent_at,recipients,error')
      .eq('source', 'event').eq('source_id', row.id)
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setQueueRow((data?.[0] as QueueRow) ?? null));
  }, [row]);

  useEffect(() => { refreshQueueRow(); }, [refreshQueueRow]);

  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }));

  const startsInput = typeof values.starts_at === 'string' ? values.starts_at : '';
  const day = startsInput.split('T')[0] ?? '';
  const startsIso = startsInput
    ? ukToIso(day, startsInput.split('T')[1] ?? '00:00')
    : null;

  const autoDefault = !startsIso
    ? ''
    : timeType === 'fixed'
      ? isoToUkInput(new Date(Date.parse(startsIso) - 2 * 3600 * 1000).toISOString())
      : `${day}T09:00`;

  const applyReminder = (mode: 'auto' | 'morning' | 'custom' | 'none') => {
    setReminderMode(mode);
    if (mode === 'auto') set('notify_at', autoDefault);
    else if (mode === 'morning') set('notify_at', day ? `${day}T09:00` : '');
    else if (mode === 'none') set('notify_at', '');
    // 'custom': the datetime input below manages the value
  };

  const effectiveNotify = reminderMode === 'none'
    ? ''
    : String(values.notify_at ?? '') || (reminderMode === 'auto' ? autoDefault : '');

  const preview = startsIso
    ? composeEventReminder({
        title: String(values.title ?? ''),
        starts_at: startsIso,
        all_day: Boolean(values.all_day),
        time_label: String(values.time_label ?? '').trim() || null,
        notify_message: String(values.notify_message ?? ''),
      })
    : null;

  return (
    <>
      <label>Time type</label>
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        {([['fixed', 'Fixed time'], ['flexible', 'Flexible (label instead of a time)'], ['allday', 'All day']] as const)
          .map(([v, lbl]) => (
            <label key={v} style={{ fontWeight: 400, display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="radio" name="timetype" checked={timeType === v} style={{ width: 'auto', margin: 0 }}
                onChange={() => {
                  setTimeType(v);
                  set('all_day', v !== 'fixed');
                  if (v !== 'flexible') set('time_label', '');
                }} />
              {lbl}
            </label>
          ))}
      </div>
      {timeType === 'flexible' && (
        <div>
          <label>Time label (shown instead of a clock time, e.g. "After Maghrib Salah")</label>
          <input value={String(values.time_label ?? '')} onChange={(e) => set('time_label', e.target.value)} />
        </div>
      )}

      <label>Reminder notification</label>
      <div style={{ display: 'flex', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
        {([['auto', timeType === 'fixed' ? 'Automatic (2h before)' : 'Automatic (9am UK)'],
           ['morning', 'Morning of event (9am UK)'], ['custom', 'Custom (UK)'], ['none', 'No reminder']] as const)
          .map(([v, lbl]) => (
            <label key={v} style={{ fontWeight: 400, display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="radio" name="remindermode" checked={reminderMode === v} style={{ width: 'auto', margin: 0 }}
                onChange={() => applyReminder(v)} />
              {lbl}
            </label>
          ))}
      </div>
      {reminderMode === 'custom' && (
        <input type="datetime-local" value={String(values.notify_at ?? '')}
          onChange={(e) => set('notify_at', e.target.value)} />
      )}

      {reminderMode !== 'none' && (
        <div>
          <label>
            Custom reminder message (optional — replaces the automatic text,{' '}
            {String(values.notify_message ?? '').length}/178)
          </label>
          <textarea
            value={String(values.notify_message ?? '')}
            maxLength={178}
            placeholder='Leave blank for the automatic text, or write your own — e.g. "Tonight&apos;s lecture is moved to the main hall."'
            onChange={(e) => set('notify_message', e.target.value)}
          />
        </div>
      )}

      {queueRow?.status === 'sent' && (
        <p className="ok">
          Sent ✓ {formatUk(queueRow.sent_at!)} (UK)
          {queueRow.recipients != null ? ` — ${queueRow.recipients} devices` : ''}
        </p>
      )}
      {(queueRow?.status === 'failed' || queueRow?.status === 'expired') && (
        <p className="err">Reminder {queueRow.status}{queueRow.error ? ` — ${queueRow.error}` : ''}</p>
      )}
      {effectiveNotify && preview && (
        <p className="note">
          Reminder fires {formatUk(ukToIso(effectiveNotify.split('T')[0]!, effectiveNotify.split('T')[1] ?? '00:00'))} (UK) —
          "{preview.title}: {preview.message}"
        </p>
      )}
      {reminderMode === 'none' && (
        <p className="note">No push notification will be sent for this event.</p>
      )}

      {row && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn secondary"
            type="button"
            disabled={sendingNow || !values.is_published || !preview}
            onClick={async () => {
              if (!preview) return;
              if (!window.confirm(
                `Send this push to Events subscribers NOW?\n\n"${preview.title}: ${preview.message}"\n\n` +
                'Any scheduled reminder for this event will be cancelled so nothing is sent twice.',
              )) return;
              setSendingNow(true);
              setSendStatus('');
              const res = await callSendPush({
                title: preview.title,
                message: preview.message,
                topic: 'events',
                route: `/event/${row.id}`,
                source: 'event',
                source_id: row.id,
              });
              if (res.ok) {
                // clear the scheduled reminder so it cannot also fire
                await supabase.from('events').update({ notify_at: null }).eq('id', row.id);
                setReminderMode('none');
                set('notify_at', '');
                setSendStatus('Sent now ✓');
                refreshQueueRow();
              } else {
                setSendStatus(`Send failed: ${typeof res.message === 'string' ? res.message : JSON.stringify(res.errors)}`);
              }
              setSendingNow(false);
            }}
          >
            {sendingNow ? 'Sending…' : 'Send reminder now'}
          </button>
          {!values.is_published && <span className="note">publish the event first</span>}
          {sendStatus && (
            <span className={sendStatus.startsWith('Send failed') ? 'err' : 'ok'}>{sendStatus}</span>
          )}
        </div>
      )}
    </>
  );
}

export function CrudSection({ config, hashBase, sub }: {
  config: CrudConfig;
  /** section key this instance lives under — editor state is written to the hash */
  hashBase: string;
  /** hash remainder: '' (list) | 'new' | 'edit/<row id>' */
  sub: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [reminders, setReminders] = useState<Map<string, QueueRow>>(new Map());
  const [err, setErr] = useState('');

  // the open editor is derived from the URL hash, so browser back/forward
  // naturally close and reopen it
  const editing: Row | 'new' | null = sub === 'new'
    ? 'new'
    : sub.startsWith('edit/')
      ? rows.find((r) => r.id === sub.slice('edit/'.length)) ?? null
      : null;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .order(config.orderBy, { ascending: true, nullsFirst: false });
    if (error) {
      setErr(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
    if (config.table === 'events' && data?.length) {
      const ids = (data as Row[]).map((r) => r.id);
      const { data: q } = await supabase
        .from('notification_queue')
        .select('id,source,source_id,title,message,topic,route,url,fire_at,status,sent_at,recipients,error')
        .eq('source', 'event')
        .in('source_id', ids)
        .order('created_at', { ascending: true });
      const m = new Map<string, QueueRow>();
      for (const qr of (q as QueueRow[]) ?? []) {
        const existing = m.get(qr.source_id!);
        // prefer the live pending row; otherwise the latest outcome
        if (!existing || qr.status === 'pending' || existing.status !== 'pending') {
          m.set(qr.source_id!, qr);
        }
      }
      setReminders(m);
    }
  }, [config]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (row: Row) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    const { error } = await supabase.from(config.table).delete().eq('id', row.id);
    if (error) setErr(error.message);
    else load();
  };

  const listColumns = config.columns.filter((c) => !c.listHidden);

  return (
    <>
      <h2>{config.title}</h2>
      {config.note && <p className="note" style={{ marginBottom: 12 }}>{config.note}</p>}
      {err && <p className="err">{err}</p>}
      {editing !== null ? (
        <Editor
          key={editing === 'new' ? 'new' : editing.id}
          config={config}
          row={editing === 'new' ? null : editing}
          onDone={(changed) => {
            window.location.hash = `#${hashBase}`;
            if (changed) load();
          }}
        />
      ) : (
        <>
          <div className="toolbar">
            <button className="btn" onClick={() => { window.location.hash = `#${hashBase}/new`; }}>+ New</button>
            <span className="note">{rows.length} items</span>
          </div>
          <div className="card">
            <table className="grid">
              <thead>
                <tr>
                  {listColumns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  {config.table === 'events' && <th>Reminder (UK)</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {listColumns.map((c) => (
                      <td key={c.key}>
                        {c.type === 'bool' ? (
                          row[c.key] ? <span className="badge">yes</span> : 'no'
                        ) : c.type === 'datetime' && row[c.key] ? (
                          formatUk(String(row[c.key]))
                        ) : (
                          String(row[c.key] ?? '').slice(0, 60)
                        )}
                      </td>
                    ))}
                    {config.table === 'events' && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {(() => {
                          const q = reminders.get(row.id);
                          if (!q) return '—';
                          if (q.status === 'pending') return formatUk(q.fire_at);
                          if (q.status === 'sent') return <span className="ok">✓ {formatUk(q.sent_at ?? q.fire_at)}</span>;
                          return <span className={q.status === 'canceled' ? 'note' : 'err'}>{q.status}</span>;
                        })()}
                      </td>
                    )}
                    <td className="row-actions">
                      <button className="btn small secondary" onClick={() => { window.location.hash = `#${hashBase}/edit/${row.id}`; }}>Edit</button>
                      <button className="btn small danger" onClick={() => remove(row)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
