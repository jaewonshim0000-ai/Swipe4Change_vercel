import type { ConfigContext } from 'expo/config';

// Vercel serves the web build as static files with a single-page fallback (vercel.json), so its
// builds export one index.html. Everywhere else keeps server output, which the local demo's
// development-only /api routes need. Everything else comes from app.json.
export default ({ config }: ConfigContext) => ({
  ...config,
  web: { ...config.web, output: process.env.VERCEL ? 'single' : 'server' },
});
