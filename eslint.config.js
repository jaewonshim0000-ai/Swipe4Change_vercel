const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'dist-*/**', 'coverage/**', 'supabase/**', 'design/**'] },
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } },
]);
