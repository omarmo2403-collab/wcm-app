import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_PREFS, type NotificationPrefs, type PrayerName } from '@wcm/shared';

import { syncTopicTags } from '@/lib/onesignal';

/**
 * Notification topics (simplified per Omar, 12 Jul 2026): exactly three
 * user-facing switches. 'prayer_times' is a master switch — it controls BOTH
 * the local 15-minutes-before-iqamah alerts scheduled on-device AND the
 * remote iqamah-change pushes sent by the admin dashboard.
 */
export const TOPICS = [
  {
    key: 'prayer_times',
    label: 'Prayer Times',
    desc: 'Daily Adhan and Iqamah alerts, and any changes to prayer times',
    icon: 'time' as const,
    color: '#159778',
  },
  {
    key: 'events',
    label: 'Events',
    desc: 'Upcoming lectures, programmes and gatherings',
    icon: 'calendar' as const,
    color: '#2980B9',
  },
  {
    key: 'stadium',
    label: 'Stadium Event Days',
    desc: 'Parking and traffic alerts on event days',
    icon: 'car' as const,
    color: '#E67E22',
  },
] as const;
export type TopicKey = (typeof TOPICS)[number]['key'];

export const DEFAULT_TOPICS: Record<TopicKey, boolean> = {
  prayer_times: true,
  events: true,
  stadium: true,
};

const ALL_ON: NotificationPrefs['enabled'] = {
  fajr: true,
  zuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
};
const ALL_OFF: NotificationPrefs['enabled'] = {
  fajr: false,
  zuhr: false,
  asr: false,
  maghrib: false,
  isha: false,
};

interface NotificationPrefsState {
  prefs: NotificationPrefs;
  topics: Record<TopicKey, boolean>;
  /** user dismissed the Home enable-alerts prompt */
  promptDismissed: boolean;
  setPrayerEnabled: (prayer: PrayerName, enabled: boolean) => void;
  setTopic: (topic: TopicKey, enabled: boolean) => void;
  dismissPrompt: () => void;
}

export const usePrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      prefs: { ...DEFAULT_PREFS, jumuah: 'both' },
      topics: DEFAULT_TOPICS,
      promptDismissed: false,
      setPrayerEnabled: (prayer, enabled) =>
        set((s) => ({
          prefs: { ...s.prefs, enabled: { ...s.prefs.enabled, [prayer]: enabled } },
        })),
      setTopic: (topic, enabled) =>
        set((s) => {
          const topics = { ...s.topics, [topic]: enabled };
          // User-driven toggle: push tags to OneSignal IMMEDIATELY so the
          // opt-out holds even if the app is closed right after.
          syncTopicTags(topics, { immediate: true });
          // Master switch: prayer_times also arms/disarms the local alerts.
          const prefs: NotificationPrefs =
            topic === 'prayer_times'
              ? { ...s.prefs, enabled: enabled ? ALL_ON : ALL_OFF, jumuah: enabled ? 'both' : 'off' }
              : s.prefs;
          return { topics, prefs };
        }),
      dismissPrompt: () => set({ promptDismissed: true }),
    }),
    {
      name: 'wcm-notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted) => {
        // v1 stored 7 topics; keep only the 3 that survive, default true.
        const old = persisted as {
          topics?: Record<string, boolean>;
          prefs?: NotificationPrefs;
          promptDismissed?: boolean;
        };
        const prayerTimesOn = old?.topics?.prayer_times ?? true;
        // In v2 prayer_times is a MASTER switch coupled to prefs.enabled — a
        // migrated v1 pair could disagree (switch off, alerts still armed), so
        // derive the per-prayer prefs from the switch instead of carrying both.
        const prefs: NotificationPrefs = {
          ...(old?.prefs ?? DEFAULT_PREFS),
          enabled: prayerTimesOn ? ALL_ON : ALL_OFF,
          jumuah: prayerTimesOn ? 'both' : 'off',
        };
        return {
          prefs,
          topics: {
            prayer_times: prayerTimesOn,
            events: old?.topics?.events ?? true,
            stadium: old?.topics?.stadium ?? true,
          },
          promptDismissed: old?.promptDismissed ?? false,
        };
      },
    },
  ),
);
