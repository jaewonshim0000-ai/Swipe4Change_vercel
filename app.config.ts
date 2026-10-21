import type { ConfigContext } from 'expo/config';

// Supabase's Vercel integration names the project's public URL and publishable key
// NEXT_PUBLIC_SUPABASE_* and SUPABASE_*, but Expo builds in only EXPO_PUBLIC_* values. Copy just
// those two public values across, so connecting the integration is enough; the secret and
// service-role keys it also adds are never read here. Explicit EXPO_PUBLIC_* values win.
for (const [target, ...sources] of [
  ['EXPO_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  [
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
  ],
]) {
  const value = sources.map((name) => process.env[name]).find(Boolean);
  if (!process.env[target] && value) process.env[target] = value;
}

// Vercel serves the web build as static files with a single-page fallback (vercel.json), so its
// builds export one index.html. Everywhere else keeps server output, which the local demo's
// development-only /api routes need. Everything else comes from app.json.
export default ({ config }: ConfigContext) => ({
  ...config,
  web: { ...config.web, output: process.env.VERCEL ? 'single' : 'server' },
});
