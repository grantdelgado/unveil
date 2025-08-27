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
    // Global rules to prevent usage of deprecated patterns
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/*get_guest_event_messages_v1*'],
              message: 'get_guest_event_messages_v1 is deprecated. Use get_guest_event_messages_v2 instead.'
            },
            {
              group: ['**/*get_guest_event_messages_legacy*'],
              message: 'get_guest_event_messages_legacy is deprecated and removed. Use get_guest_event_messages_v2 instead.'
            },
            {
              group: ['**/*message_delivery_rollups_v1*'],
              message: 'message_delivery_rollups_v1 is deprecated and removed. Use current analytics methods instead.'
            }
          ]
        }
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name="rpc"][arguments.0.value=/get_guest_event_messages_(v1|legacy)/]',
          message: 'Direct RPC calls to deprecated get_guest_event_messages_v1 or legacy versions are not allowed. Use get_guest_event_messages_v2 instead.'
        }
      ]
    }
  },
  {
    // Warn about legacy analytics fields usage (existing code allowed, but discouraged)
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'MemberExpression[property.name=/^(delivered_count|failed_count)$/]',
          message: 'DEPRECATED: Legacy analytics fields delivered_count and failed_count. Consider migrating to message_deliveries table for new features.'
        }
      ]
    }
  },
  {
    files: [
      '**/components/features/messaging/host/**/*.tsx',
      '**/lib/services/messageAnalytics.ts',
      '**/lib/services/messaging-client.ts',
      '**/lib/services/guestAutoJoin.ts',
      '**/app/api/**/*.ts',
      '**/lib/auth/**/*.ts',
      '**/lib/auth/**/*.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
  {
    files: ['**/components/features/messaging/host/MessageAnalyticsCard.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];

export default eslintConfig;
