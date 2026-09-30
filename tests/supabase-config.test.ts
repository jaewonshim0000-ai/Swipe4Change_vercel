import { readBackendConfig } from '../src/data/config';
const env = {
  backend: 'supabase',
  url: 'https://sample.supabase.co',
  publicKey: 'sb_publishable_example',
  clerkKey: 'pk_test_ZXhhbXBsZSQ=',
};
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role }))}.signature`;
test('demo needs no credentials; unknown backends cannot silently select demo', () => {
  expect(readBackendConfig({ backend: 'demo' })).toEqual({ backend: 'demo' });
  expect(() => readBackendConfig({})).toThrow(/SUPABASE_URL/);
  expect(() => readBackendConfig({ backend: 'supabse' })).toThrow(/must be/);
});
test('accepts public keys and legacy anon JWTs, including local development', () => {
  expect(readBackendConfig(env)).toMatchObject({ publicKey: env.publicKey });
  expect(
    readBackendConfig({
      ...env,
      publicKey: '',
      legacyKey: jwt('anon'),
      url: 'http://127.0.0.1:54321',
    }),
  ).toMatchObject({ backend: 'supabase' });
});
test.each(['sb_secret_private', jwt('service_role'), 'YOUR_PUBLIC_KEY', 'eyJinvalid'])(
  'rejects unsafe or invalid key %s',
  (publicKey) => {
    expect(() => readBackendConfig({ ...env, publicKey })).toThrow(/publishable or legacy anon/);
  },
);
test.each([
  'http://sample.supabase.co',
  'https://YOUR_PROJECT.supabase.co',
  'https://user:pass@sample.supabase.co',
  'https://sample.supabase.co/rest/v1',
  'not-a-url',
])('rejects invalid URL %s', (url) => {
  expect(() => readBackendConfig({ ...env, url })).toThrow();
});
test('requires Clerk configuration before mounting hosted authentication', () => {
  expect(() => readBackendConfig({ ...env, clerkKey: '' })).toThrow(/CLERK/);
});
test('hosted auth is the default unless demo is explicitly requested', () => {
  expect(readBackendConfig({ ...env, backend: undefined })).toMatchObject({ backend: 'supabase' });
  expect(readBackendConfig({ ...env, backend: 'demo' })).toEqual({ backend: 'demo' });
  expect(() => readBackendConfig({ clerkKey: env.clerkKey })).toThrow(/SUPABASE_URL/);
});
