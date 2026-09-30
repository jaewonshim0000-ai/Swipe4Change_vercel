/** Public Expo configuration only. Never read server credentials from this module. */
export type BackendConfig =
  { backend: 'demo' } | { backend: 'supabase'; url: string; publicKey: string; clerkKey: string };

export function readBackendConfig(env: {
  backend?: string;
  url?: string;
  publicKey?: string;
  legacyKey?: string;
  clerkKey?: string;
}): BackendConfig {
  const backend = env.backend || 'supabase';
  if (backend === 'demo') return { backend: 'demo' };
  if (backend !== 'supabase') throw new Error('EXPO_PUBLIC_BACKEND must be demo or supabase.');
  const url = env.url?.trim();
  let parsed: URL;
  try {
    parsed = new URL(url ?? '');
  } catch {
    throw new Error('Set EXPO_PUBLIC_SUPABASE_URL to your Supabase project URL.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (
    (!local && parsed.protocol !== 'https:') ||
    (local && !['http:', 'https:'].includes(parsed.protocol)) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/' ||
    /YOUR_PROJECT/i.test(parsed.hostname)
  )
    throw new Error('Use an HTTPS Supabase project URL (HTTP is allowed for localhost).');
  const publicKey = (env.publicKey || env.legacyKey)?.trim() ?? '';
  let validKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey) && !/YOUR_/i.test(publicKey);
  if (publicKey.startsWith('eyJ')) {
    try {
      const payload: unknown = JSON.parse(
        atob(publicKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      validKey =
        typeof payload === 'object' &&
        payload !== null &&
        'role' in payload &&
        payload.role === 'anon';
    } catch {
      validKey = false;
    }
  }
  if (!validKey)
    throw new Error(
      'Set a Supabase publishable or legacy anon key. Secret and service-role keys must never be used in the app.',
    );
  const clerkKey = env.clerkKey?.trim() ?? '';
  if (!/^pk_(test|live)_[A-Za-z0-9=]+$/.test(clerkKey) || /YOUR_/i.test(clerkKey))
    throw new Error('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your Clerk publishable key.');
  return { backend: 'supabase', url: parsed.origin, publicKey, clerkKey };
}

export function getBackendConfig(): BackendConfig {
  // Expo requires direct property access to inline public environment variables.
  return readBackendConfig({
    backend: process.env.EXPO_PUBLIC_BACKEND,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publicKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    legacyKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    clerkKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
}
