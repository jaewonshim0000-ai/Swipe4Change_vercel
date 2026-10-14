// Offline UI tests explicitly opt into the fictional adapter.
process.env.EXPO_PUBLIC_BACKEND = 'demo';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
});
jest.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn(),
  useUser: jest.fn(() => ({ user: null })),
}));
jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: {} }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `mock-${Math.random()}` }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
// Reanimated and its worklets runtime are native modules; Jest uses their official mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The mock predates Reanimated's CSS animations, so keyframes and easings pass through inert.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  css: { keyframes: (k: object) => k, create: (s: object) => s },
  cubicBezier: () => 'ease',
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
