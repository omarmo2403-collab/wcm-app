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
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [msg, setMsg] = useState('');

  const sendCode = async () => {
    setMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) setMsg(error.message);
    else {
      setStage('code');
      setMsg('Check your email for a 6-digit code.');
    }
  };

  const verify = async () => {
    setMsg('');
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (error) setMsg(error.message);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>WCM Admin</h1>
        <p>Wembley Central Masjid content dashboard. Staff sign-in via email code — no password.</p>
        {stage === 'email' ? (
          <>
            <label>Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <div style={{ marginTop: 14 }}>
              <button className="btn" onClick={sendCode} disabled={!email.includes('@')}>
                Email me a code
              </button>
            </div>
          </>
        ) : (
          <>
            <label>6-digit code sent to {email}</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" onClick={verify} disabled={code.trim().length < 6}>
                Sign in
              </button>
              <button className="btn secondary" onClick={() => setStage('email')}>
                Back
              </button>
            </div>
          </>
        )}
        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
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
