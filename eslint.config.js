const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'dist-*/**', 'coverage/**', 'supabase/**', 'design/**'] },
  // Preserve vendored React Bits source; upstream predates these compiler lint rules.
  {
    files: ['src/components/react-bits/**/*.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/array-type': 'off',
    },
  },
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } },
]);
