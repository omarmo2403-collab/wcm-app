import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_PREFS, type NotificationPrefs, type PrayerName } from '@wcm/shared';

interface NotificationPrefsState {
  prefs: NotificationPrefs;
  /** user dismissed the Home enable-alerts prompt */
  promptDismissed: boolean;
  setPrayerEnabled: (prayer: PrayerName, enabled: boolean) => void;
  setLeadMinutes: (minutes: number) => void;
  setJumuah: (mode: NotificationPrefs['jumuah']) => void;
  dismissPrompt: () => void;
}

export const usePrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      promptDismissed: false,
      setPrayerEnabled: (prayer, enabled) =>
        set((s) => ({
          prefs: { ...s.prefs, enabled: { ...s.prefs.enabled, [prayer]: enabled } },
        })),
      setLeadMinutes: (leadMinutes) => set((s) => ({ prefs: { ...s.prefs, leadMinutes } })),
      setJumuah: (jumuah) => set((s) => ({ prefs: { ...s.prefs, jumuah } })),
      dismissPrompt: () => set({ promptDismissed: true }),
    }),
    {
      name: 'wcm-notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
