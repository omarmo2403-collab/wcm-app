import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { Timetable } from './sections/Timetable';
import { CrudSection, CRUD_SECTIONS } from './sections/CrudSection';
import { PushComposer } from './sections/PushComposer';
import { ConfigSection } from './sections/Config';
import { AuditLog } from './sections/Audit';

type SectionKey = 'timetable' | keyof typeof CRUD_SECTIONS | 'push' | 'config' | 'audit';

const NAV: { key: SectionKey; label: string }[] = [
  { key: 'timetable', label: 'Prayer Times' },
  { key: 'events', label: 'Events' },
  { key: 'news', label: 'News' },
  { key: 'notices', label: 'Notices' },
  { key: 'banners', label: 'Banners' },
  { key: 'donations', label: 'Donations' },
  { key: 'madrasah', label: 'Madrasah' },
  { key: 'services', label: 'Services' },
  { key: 'jumuah', label: "Jumu'ah Times" },
  { key: 'push', label: 'Send Notification' },
  { key: 'config', label: 'App Config' },
  { key: 'audit', label: 'Audit Log' },
];

function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  const sendLink = async () => {
    setMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) setMsg(error.message);
    else setSent(true);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>WCM Admin</h1>
        <p>Wembley Central Masjid content dashboard. Staff sign-in via email link — no password.</p>
        {!sent ? (
          <>
            <label>Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <div style={{ marginTop: 14 }}>
              <button className="btn" onClick={sendLink} disabled={!email.includes('@')}>
                Email me a sign-in link
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>Sign-in link sent to {email}.</strong>
            </p>
            <p>
              Open the email and click the link — it brings you straight back here, signed in. Best
              opened in this same browser.
            </p>
            <button className="btn secondary" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </>
        )}
        {msg && <p style={{ marginTop: 12 }} className="err">{msg}</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<SectionKey>('timetable');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (!session) return <Login />;

  const role = (session.user.app_metadata as Record<string, unknown>).app_role;
  if (role !== 'admin' && role !== 'editor') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>No access</h1>
          <p>
            {session.user.email} is signed in but has no staff role. Ask an administrator to grant
            access.
          </p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <h1>WCM Admin</h1>
        {NAV.map((n) => (
          <button
            key={n.key}
            className={section === n.key ? 'active' : ''}
            onClick={() => setSection(n.key)}
          >
            {n.label}
          </button>
        ))}
        <button className="signout" onClick={() => supabase.auth.signOut()}>
          Sign out ({session.user.email})
        </button>
      </nav>
      <main className="main">
        {section === 'timetable' && <Timetable />}
        {section in CRUD_SECTIONS && (
          <CrudSection key={section} config={CRUD_SECTIONS[section as keyof typeof CRUD_SECTIONS]} />
        )}
        {section === 'push' && <PushComposer />}
        {section === 'config' && <ConfigSection />}
        {section === 'audit' && <AuditLog />}
      </main>
    </div>
  );
}
