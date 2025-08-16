import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import eslintConfigPrettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  eslintConfigPrettier,
  {
    files: [
      '**/components/features/messaging/host/**/*.tsx',
      '**/lib/services/messageAnalytics.ts',
      '**/lib/services/messaging-client.ts',
      '**/app/api/**/*.ts',
      '**/lib/auth/**/*.ts',
      '**/lib/auth/**/*.tsx'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn'
    }
  }
];

export default eslintConfig;
