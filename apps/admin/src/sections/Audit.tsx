import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
}

export function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id,actor_email,action,entity,entity_id,created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRows((data ?? []) as AuditRow[]);
      });
  }, []);

  return (
    <>
      <h2>Audit Log</h2>
      <p className="note" style={{ marginBottom: 12 }}>
        Every change made through this dashboard, newest first. Answers &ldquo;who changed
        Friday&rsquo;s iqamah and when&rdquo;.
      </p>
      {err && <p className="err">{err}</p>}
      <div className="card">
        <table className="grid">
          <thead>
            <tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>Item</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(r.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>{r.actor_email ?? 'system'}</td>
                <td><span className="badge">{r.action}</span></td>
                <td>{r.entity}</td>
                <td className="note">{r.entity_id ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
