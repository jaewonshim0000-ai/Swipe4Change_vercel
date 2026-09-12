import React, { createContext, useContext, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Adapter, Command, Snapshot } from '../domain/model';
import { optimisticSnapshot } from '../domain/rules';
import { LocalAdapter } from './local';
import { createSupabaseAdapter } from './supabase';
export const isDemo = process.env.EXPO_PUBLIC_BACKEND !== 'supabase';
export const localAdapter = new LocalAdapter(AsyncStorage, Crypto.randomUUID);
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 }, mutations: { retry: false } },
});
const Context = createContext<{
  adapter: Adapter;
  sessionKey: string;
  signOut: () => Promise<void>;
}>({ adapter: localAdapter, sessionKey: 'demo', signOut: () => localAdapter.signOut() });
function CloudProvider({ children }: React.PropsWithChildren) {
  const { getToken, userId, signOut } = useAuth();
  const adapter = useMemo(() => createSupabaseAdapter(() => getToken()), [getToken]);
  return (
    <Context.Provider
      value={{
        adapter,
        sessionKey: userId ?? 'guest',
        signOut: async () => {
          await signOut();
          queryClient.clear();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function Providers({ children }: React.PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {isDemo ? (
        children
      ) : (
        <ClerkProvider
          publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
          tokenCache={tokenCache}
        >
          <CloudProvider>{children}</CloudProvider>
        </ClerkProvider>
      )}
    </QueryClientProvider>
  );
}
export const useBackend = () => useContext(Context);
export function useSnapshot() {
  const { adapter, sessionKey } = useBackend();
  return useQuery({ queryKey: ['snapshot', sessionKey], queryFn: () => adapter.load() });
}
export function useCommand() {
  const { adapter, sessionKey } = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (command: Command) => adapter.execute(command),
    onMutate: async (command) => {
      const key = ['snapshot', sessionKey];
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Snapshot>(key);
      if (previous && (command.type === 'save' || command.type === 'sign'))
        client.setQueryData(key, optimisticSnapshot(previous, command));
      return { previous, key };
    },
    onError: (_error, _command, context) => {
      if (context?.previous) client.setQueryData(context.key, context.previous);
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ['snapshot'] });
      await client.invalidateQueries({ queryKey: ['requests'] });
      await client.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
