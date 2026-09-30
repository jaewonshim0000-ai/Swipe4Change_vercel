import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from '../domain/model';
import { Signal, SignalKind } from '../domain/for-you';

/**
 * What you opened, read, swiped and shared, kept on this device only. Browsing history in a civic
 * app is sensitive, so it never reaches the server, organizers or other people; the For You
 * ranking reads it right here. Signatures, saves and volunteering are already server records.
 * ponytail: per-device, so a second phone starts cold; sync it (own-rows RLS) if that matters.
 */
const LIMIT = 500;
const keyOf = (owner: string) => `swipe4change.signals.${owner}`;
let state: { owner: string; signals: Signal[] } = { owner: '', signals: [] };
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const set = (next: typeof state) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Serialized so a record never races the load that precedes it. */
function run(task: () => Promise<void>) {
  queue = queue.then(task).catch(() => undefined);
  return queue;
}
async function select(owner: string) {
  if (state.owner === owner) return;
  let signals: Signal[] = [];
  try {
    const raw = await AsyncStorage.getItem(keyOf(owner));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) signals = parsed as Signal[];
  } catch {
    // Unreadable history just means starting fresh.
  }
  set({ owner, signals });
}

type Owner = Pick<Profile, 'id' | 'useSigningHistory'> | null | undefined;
const ownerOf = (profile: Owner) => profile?.id ?? 'guest';

export function useSignals(profile: Owner): Signal[] {
  const owner = ownerOf(profile);
  useEffect(() => {
    void run(() => select(owner));
  }, [owner]);
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
  return current.owner === owner ? current.signals : [];
}

/** Does nothing when the person switched personalization off in Profile. */
export function recordSignal(profile: Owner, petitionId: string, kind: SignalKind) {
  if (profile?.useSigningHistory === false) return Promise.resolve();
  const owner = ownerOf(profile);
  return run(async () => {
    await select(owner);
    const signals = [...state.signals, { petitionId, kind, at: Date.now() }].slice(-LIMIT);
    set({ owner, signals });
    await AsyncStorage.setItem(keyOf(owner), JSON.stringify(signals));
  });
}

export function clearSignals(profile: Owner) {
  const owner = ownerOf(profile);
  return run(async () => {
    set({ owner, signals: [] });
    await AsyncStorage.setItem(keyOf(owner), '[]');
  });
}
