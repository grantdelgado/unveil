# ESLint Rules for Messaging Hooks Consolidation

Custom ESLint rules to enforce the consolidated messaging hooks architecture.

## Installation

Add to your ESLint config:

```js
// eslint.config.mjs
export default [
  // ... other config
  {
    rules: {
      'messaging-hooks/no-legacy-messaging-hooks': 'error',
      'messaging-hooks/prefer-core-messaging-hooks': 'warn',
      'messaging-hooks/no-direct-messaging-imports': 'error',
      'messaging-hooks/no-compat-imports-after-migration': ['error', {
        migrationEndDate: '2025-02-15'
      }],
    },
  },
];
```

## Rules

### `no-legacy-messaging-hooks`

**Type:** Error  
**Fixable:** No

Disallows usage of legacy messaging hooks that have been consolidated.

#### ❌ Incorrect

```ts
import { useMessages } from 'hooks/messaging/useMessages';
import { useEventMessages } from 'hooks/queries/useEventMessages';

function MyComponent({ eventId }: { eventId: string }) {
  const { messages } = useMessages(eventId);
  const { data } = useEventMessages(eventId);
  // ...
}
```

#### ✅ Correct

```ts
import { useEventMessagesList, useMessageMutations } from 'hooks/messaging/_core';

function MyComponent({ eventId }: { eventId: string }) {
  const { data: messages } = useEventMessagesList(eventId);
  const { sendAnnouncement } = useMessageMutations();
  // ...
}
```

### `prefer-core-messaging-hooks`

**Type:** Warning  
**Fixable:** No

Suggests using core hooks instead of legacy alternatives when detected.

#### Examples

- `useMessages` → `useEventMessagesList + useMessageMutations`
- `useEventMessages` → `useEventMessagesList`
- `useSendMessage` → `useMessageMutations`
- `useMessagesRealtime` → `useMessageRealtime`

### `no-direct-messaging-imports`

**Type:** Error  
**Fixable:** No

Prevents direct imports from messaging hook modules outside of the core system.

#### ❌ Incorrect

```ts
import { useMessages } from 'hooks/messaging/useMessages';
import { useScheduledMessages } from 'hooks/messaging/useScheduledMessages';
```

#### ✅ Correct

```ts
import { useEventMessagesList } from 'hooks/messaging/_core';
import { useMessages } from 'hooks/messaging/compat'; // During migration period
```

### `no-compat-imports-after-migration`

**Type:** Error  
**Fixable:** No  
**Options:** `{ migrationEndDate: string }`

Prevents usage of compatibility layer after the migration period ends.

```js
// After 2025-02-15, this will error:
import { useMessages } from 'hooks/messaging/compat';
```

## Migration Guide

### Phase 1: Enable Rules (Current)

Add the ESLint rules to catch new usage of legacy hooks:

```js
rules: {
  'messaging-hooks/no-direct-messaging-imports': 'error',
  'messaging-hooks/prefer-core-messaging-hooks': 'warn',
}
```

### Phase 2: Update Imports

Change existing imports to use the compatibility layer:

```diff
- import { useMessages } from 'hooks/messaging/useMessages';
+ import { useMessages } from 'hooks/messaging/compat';
```

### Phase 3: Migrate to Core Hooks

Replace legacy hook usage with core hooks:

```diff
- const { messages, sendMessage } = useMessages(eventId);
+ const { data: messages } = useEventMessagesList(eventId);
+ const { sendAnnouncement } = useMessageMutations();
```

### Phase 4: Remove Compatibility Layer

Enable the strict rule:

```js
rules: {
  'messaging-hooks/no-compat-imports-after-migration': ['error', {
    migrationEndDate: '2025-02-15'
  }],
}
```

## Hook Mappings

| Legacy Hook | Core Replacement |
|-------------|------------------|
| `useMessages` | `useEventMessagesList` + `useMessageMutations` |
| `useEventMessages` | `useEventMessagesList` |
| `useScheduledMessages` | `useMessageMutations` (schedule/cancel methods) |
| `useSendMessage` | `useMessageMutations` |
| `useMessagesRealtime` | `useMessageRealtime` |
| `useMessagesPagination` | Built into `useEventMessagesList` |
| `useGuestMessagesRPC` | Special case - needs guest-specific implementation |

## Automated Migration

For large codebases, consider using a codemod:

```bash
# Example codemod usage (when available)
npx @unveil/codemods messaging-hooks-migration src/
```

## Troubleshooting

### Rule Not Working?

1. Ensure the plugin is loaded in your ESLint config
2. Check that file patterns include the files you want to lint
3. Verify the rule is enabled with the correct severity

### False Positives?

Use ESLint disable comments sparingly:

```ts
// eslint-disable-next-line messaging-hooks/no-legacy-messaging-hooks
const { messages } = useMessages(eventId); // TODO: Migrate to core hooks
```

### Need Help?

Check the migration guides in `/docs/migration/` or ask in the team chat.
