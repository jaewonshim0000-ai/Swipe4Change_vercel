import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getBackendConfig } from './config';
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
import { demoAi } from './ai';
import { createSupabaseAdapter } from './supabase';
export const isDemo = process.env.EXPO_PUBLIC_BACKEND === 'demo';
export const localAdapter = new LocalAdapter(AsyncStorage, Crypto.randomUUID, demoAi);
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 15000 }, mutations: { retry: false } },
  });
const Context = createContext<{
  adapter: Adapter;
  sessionKey: string;
  signOut: () => Promise<void>;
}>({ adapter: localAdapter, sessionKey: 'demo', signOut: () => localAdapter.signOut() });
function SessionQueries({ children }: React.PropsWithChildren) {
  const [client] = useState(createQueryClient);
  useEffect(
    () => () => {
      client.clear();
    },
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function CloudProvider({ children }: React.PropsWithChildren) {
  const { isLoaded, userId, sessionId } = useAuth();
  if (!isLoaded) return <ActivityIndicator accessibilityLabel="Loading your account" />;
  return (
    <SessionQueries key={sessionId ?? userId ?? 'guest'}>
      <CloudSession>{children}</CloudSession>
    </SessionQueries>
  );
}
function CloudSession({ children }: React.PropsWithChildren) {
  const { getToken, userId, signOut } = useAuth();
  const queryClient = useQueryClient();
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
function DemoProvider({ children }: React.PropsWithChildren) {
  const queryClient = useQueryClient();
  useEffect(() => {
    void localAdapter.backfillTags().then((tagged) => {
      if (tagged) void queryClient.invalidateQueries({ queryKey: ['snapshot'] });
    });
  }, [queryClient]);
  return children;
}
export function Providers({ children }: React.PropsWithChildren) {
  let config;
  try {
    config = getBackendConfig();
  } catch (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text accessibilityRole="header" style={{ fontSize: 24 }}>
          Connection setup needed
        </Text>
        <Text accessibilityRole="alert">
          {error instanceof Error ? error.message : 'Check your public backend configuration.'}
        </Text>
        <Text>Update your .env configuration and restart Expo.</Text>
      </View>
    );
  }
  if (config.backend === 'demo')
    return (
      <SessionQueries>
        <DemoProvider>{children}</DemoProvider>
      </SessionQueries>
    );
  return (
    <ClerkProvider publishableKey={config.clerkKey} tokenCache={tokenCache}>
      <CloudProvider>{children}</CloudProvider>
    </ClerkProvider>
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
