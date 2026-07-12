import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

type ColumnType = 'text' | 'textarea' | 'number' | 'bool' | 'datetime' | 'time' | 'select' | 'image' | 'video';

const MEDIA_URL = 'https://gjffozmcbdtafdsxifyq.supabase.co/storage/v1/object/public/media/';

interface Column {
  key: string;
  label: string;
  type: ColumnType;
  options?: string[];
  listHidden?: boolean;
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
    note: 'Only published events appear in the app. Times are UK local.',
    orderBy: 'starts_at',
    columns: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', listHidden: true },
      { key: 'starts_at', label: 'Starts', type: 'datetime' },
      { key: 'all_day', label: 'All day', type: 'bool' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: ['community', 'lecture', 'madrasah', 'stadium', 'ramadan', 'eid', 'fundraising'],
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
      { key: 'published_at', label: 'Published at', type: 'datetime' },
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
      { key: 'starts_at', label: 'From', type: 'datetime' },
      { key: 'ends_at', label: 'Until', type: 'datetime' },
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
  if (type === 'datetime') {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
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
  if (type === 'datetime') return new Date(value).toISOString();
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

  return (
    <div className="card">
      <h3>{row ? 'Edit' : 'New'}</h3>
      {config.columns.map((c) => (
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
                  const path = `videos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                  const { error } = await supabase.storage.from('media').upload(path, file, {
                    cacheControl: '31536000',
                    upsert: false,
                  });
                  if (error) setErr(`Video upload failed: ${error.message}`);
                  else setValues((v) => ({ ...v, [c.key]: MEDIA_URL + path }));
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
                  const path = `${config.table}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                  const { error } = await supabase.storage.from('media').upload(path, file, {
                    cacheControl: '31536000',
                    upsert: false,
                  });
                  if (error) setErr(`Image upload failed: ${error.message}`);
                  else setValues((v) => ({ ...v, [c.key]: path }));
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
      ))}
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button className="btn" onClick={save}>Save</button>
        <button className="btn secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function CrudSection({ config }: { config: CrudConfig }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null | 'new'>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .order(config.orderBy, { ascending: true, nullsFirst: false });
    if (error) setErr(error.message);
    else setRows((data ?? []) as Row[]);
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
          config={config}
          row={editing === 'new' ? null : editing}
          onDone={(changed) => {
            setEditing(null);
            if (changed) load();
          }}
        />
      ) : (
        <>
          <div className="toolbar">
            <button className="btn" onClick={() => setEditing('new')}>+ New</button>
            <span className="note">{rows.length} items</span>
          </div>
          <div className="card">
            <table className="grid">
              <thead>
                <tr>
                  {listColumns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
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
                          new Date(String(row[c.key])).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })
                        ) : (
                          String(row[c.key] ?? '').slice(0, 60)
                        )}
                      </td>
                    ))}
                    <td className="row-actions">
                      <button className="btn small secondary" onClick={() => setEditing(row)}>Edit</button>
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
