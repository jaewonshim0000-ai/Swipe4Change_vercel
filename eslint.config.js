const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'coverage/**', 'supabase/**'] },
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } },
]);
