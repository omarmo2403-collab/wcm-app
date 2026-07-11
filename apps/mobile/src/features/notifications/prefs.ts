import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_PREFS, type NotificationPrefs, type PrayerName } from '@wcm/shared';

/** OneSignal remote-push topics (REBUILD_PLAN §4 notification matrix) */
export const TOPICS = [
  { key: 'prayer_times', label: 'Prayer time changes', desc: 'When the Masjid changes an iqamah time' },
  { key: 'announcements', label: 'Announcements', desc: 'General Masjid news and urgent notices' },
  { key: 'events', label: 'Events', desc: 'Lectures, programmes and gatherings' },
  { key: 'jumuah', label: "Jumu'ah", desc: 'Friday prayer reminders' },
  { key: 'donations', label: 'Donation appeals', desc: 'Fundraising campaigns' },
  { key: 'madrasah', label: 'Madrasah', desc: 'Class updates and parent notices' },
  { key: 'stadium', label: 'Stadium event days', desc: 'Parking and traffic alerts' },
] as const;
export type TopicKey = (typeof TOPICS)[number]['key'];

export const DEFAULT_TOPICS: Record<TopicKey, boolean> = {
  prayer_times: true,
  announcements: true,
  events: true,
  jumuah: true,
  donations: true,
  madrasah: false,
  stadium: true,
};

interface NotificationPrefsState {
  prefs: NotificationPrefs;
  topics: Record<TopicKey, boolean>;
  /** user dismissed the Home enable-alerts prompt */
  promptDismissed: boolean;
  setPrayerEnabled: (prayer: PrayerName, enabled: boolean) => void;
  setLeadMinutes: (minutes: number) => void;
  setJumuah: (mode: NotificationPrefs['jumuah']) => void;
  setTopic: (topic: TopicKey, enabled: boolean) => void;
  dismissPrompt: () => void;
}

export const usePrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      topics: DEFAULT_TOPICS,
      promptDismissed: false,
      setPrayerEnabled: (prayer, enabled) =>
        set((s) => ({
          prefs: { ...s.prefs, enabled: { ...s.prefs.enabled, [prayer]: enabled } },
        })),
      setLeadMinutes: (leadMinutes) => set((s) => ({ prefs: { ...s.prefs, leadMinutes } })),
      setJumuah: (jumuah) => set((s) => ({ prefs: { ...s.prefs, jumuah } })),
      setTopic: (topic, enabled) =>
        set((s) => ({ topics: { ...s.topics, [topic]: enabled } })),
      dismissPrompt: () => set({ promptDismissed: true }),
    }),
    {
      name: 'wcm-notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
