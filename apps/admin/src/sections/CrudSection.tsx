import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

type ColumnType = 'text' | 'textarea' | 'number' | 'bool' | 'datetime' | 'time' | 'select';

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
    orderBy: 'sort_order',
    columns: [
      { key: 'badge', label: 'Badge', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'action_type', label: 'Action', type: 'select', options: ['none', 'screen', 'url'] },
      { key: 'action_target', label: 'Target', type: 'text' },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'bool' },
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
      { key: 'description', label: 'Description', type: 'text' },
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
  if (typeof value !== 'string' || value === '') return type === 'number' ? 0 : null;
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
    Object.fromEntries(config.columns.map((c) => [c.key, toInput(row?.[c.key], c.type)])),
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
