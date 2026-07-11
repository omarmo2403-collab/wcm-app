import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://gjffozmcbdtafdsxifyq.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZmZvem1jYmR0YWZkc3hpZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTI1NTcsImV4cCI6MjA5OTI4ODU1N30.A-0IuKpQGyz8ZxlXtkr1CbfDA1YhySOqeXU_FqCcZQc';

export const supabase = createClient(SUPABASE_URL, ANON_KEY);

export async function callSendPush(payload: {
  title: string;
  message: string;
  topic: string;
  url?: string;
}): Promise<{ ok: boolean; errors: unknown }> {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const out = await resp.json().catch(() => ({}));
  return { ok: resp.ok && out.ok !== false, errors: out.errors ?? (resp.ok ? null : out) };
}
