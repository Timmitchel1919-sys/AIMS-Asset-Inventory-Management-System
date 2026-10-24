import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/.claude/**', '**/analyze.js', '**/analyze.ts'] },
  { extends: [js.configs.recommended, ...tseslint.configs.recommended], files: ['**/*.{ts,tsx}'], languageOptions: { ecmaVersion: 2022, globals: globals.browser }, plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh }, rules: { ...reactHooks.configs.recommended.rules, '@typescript-eslint/no-explicit-any': 'off', 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
  {
    files: [
      '**/src/main.tsx',
      '**/src/context/AppContext.tsx',
      '**/src/components/PwaStatus.tsx',
      '**/src/components/shell.tsx',
      '**/src/data/firebaseRepository.tsx',
      '**/src/data/mockRepository.tsx',
      '**/src/data/repositoryContext.tsx',
      '**/src/pages/Assets.tsx',
      '**/src/pages/Settings.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  }
);
