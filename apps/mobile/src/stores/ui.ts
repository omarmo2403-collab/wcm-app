import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface UiState {
  dismissedNoticeIds: string[];
  dismissNotice: (id: string) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      dismissedNoticeIds: [],
      dismissNotice: (id) =>
        set((s) => ({ dismissedNoticeIds: [...new Set([...s.dismissedNoticeIds, id])] })),
    }),
    { name: 'wcm-ui', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
