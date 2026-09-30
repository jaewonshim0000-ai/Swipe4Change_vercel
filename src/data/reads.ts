import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Which notifications this person has opened. Read state is a per-device convenience, so it stays
 * in device storage; losing it only makes old notifications look new again.
 */
export function useReads(profileId: string | undefined) {
  const client = useQueryClient();
  const key = ['reads', profileId ?? 'guest'];
  const storageKey = `swipe4change.reads.${profileId ?? 'guest'}`;
  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<string[]> => {
      const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
      return raw ? (JSON.parse(raw) as string[]) : [];
    },
  });
  const read = q.data ?? [];
  return {
    read,
    markRead: (ids: string[]) => {
      const next = [...new Set([...read, ...ids])];
      client.setQueryData(key, next);
      void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
    },
  };
}
