import { supabase } from './supabase';

export interface QueueRow {
  id: string;
  source: 'event' | 'stadium' | 'template' | 'composer' | 'prayer_change';
  source_id: string | null;
  title: string;
  message: string;
  topic: 'prayer_times' | 'events' | 'stadium';
  route: string | null;
  url: string | null;
  fire_at: string;
  status: 'pending' | 'sent' | 'failed' | 'canceled' | 'expired';
  sent_at: string | null;
  recipients: number | null;
  error: string | null;
}
export interface NewQueueRow {
  source: 'stadium' | 'template' | 'composer';
  title: string;
  message: string;
  topic: string;
  route?: string;
  url?: string;
  fire_at: string;
}

export const TOPIC_LABELS: Record<string, string> = {
  prayer_times: 'Prayer Times',
  events: 'Events',
  stadium: 'Stadium',
};
export const SOURCE_LABELS: Record<QueueRow['source'], string> = {
  event: 'Event reminder',
  stadium: 'Stadium day',
  template: 'Scheduled (template)',
  composer: 'Composer',
  prayer_change: 'Prayer time change',
};

const COLS = 'id,source,source_id,title,message,topic,route,url,fire_at,status,sent_at,recipients,error';

export async function listUpcoming(): Promise<QueueRow[]> {
  const { data } = await supabase
    .from('notification_queue').select(COLS)
    .eq('status', 'pending').order('fire_at');
  return (data as QueueRow[]) ?? [];
}

export async function listSent(): Promise<QueueRow[]> {
  const { data } = await supabase
    .from('notification_queue').select(COLS)
    .neq('status', 'pending')
    .gte('fire_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .order('fire_at', { ascending: false });
  return (data as QueueRow[]) ?? [];
}

/** Insert scheduled rows one by one so a duplicate (23505) skips, not aborts. */
export async function insertQueued(
  rows: NewQueueRow[],
): Promise<{ ok: number; duplicates: number; failures: string[] }> {
  let ok = 0;
  let duplicates = 0;
  const failures: string[] = [];
  for (const r of rows) {
    const { error } = await supabase.from('notification_queue').insert(r);
    if (!error) ok++;
    else if (error.code === '23505') duplicates++;
    else failures.push(`${r.title}: ${error.message}`);
  }
  return { ok, duplicates, failures };
}

export async function cancelRow(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('notification_queue').update({ status: 'canceled' }).eq('id', id);
  return error ? error.message : null;
}

/** TS mirror of public.compose_event_reminder — used for the form preview. */
export function composeEventReminder(ev: {
  title: string; starts_at: string; all_day: boolean; time_label: string | null;
}): { title: string; message: string } {
  const label = ev.time_label?.trim() ? ev.time_label.trim() : null;
  const when = label
    ? label.charAt(0).toLowerCase() + label.slice(1)
    : ev.all_day
      ? 'today'
      : `at ${new Date(ev.starts_at).toLocaleTimeString('en-GB', {
          timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: true,
        })}`;
  return {
    title: `${ev.title.slice(0, 59)} today`,
    message: `Join us ${when} at Wembley Central Masjid. Tap for details.`.slice(0, 178),
  };
}
