/**
 * ESLint Rules for Messaging Hooks Consolidation
 * 
 * Custom ESLint rules to enforce usage of core messaging hooks
 * and prevent import of legacy/non-core messaging hooks.
 */

const path = require('path');

// List of core messaging hooks (the only allowed ones)
const CORE_HOOKS = [
  'useEventMessagesList',
  'useMessageById',
  'useDeliveriesByMessage',
  'useMessageMutations',
  'useMessageRealtime',
];

// Legacy hooks that should be migrated
const LEGACY_HOOKS = [
  'useMessages',
  'useEventMessages',
  'useScheduledMessages',
  'useScheduledMessagesQuery',
  'useScheduledMessagesCache',
  'useScheduledMessagesRealtime',
  'useGuestMessagesRPC',
  'useMessagingRecipients',
  'useGuestSelection',
  'useCurrentAudienceCount',
  'useRecipientPreview',
  'useSendMessage',
  'useMessagesRealtime',
  'useMessagesPagination',
];

// Restricted import paths (legacy hooks)
const RESTRICTED_PATHS = [
  'hooks/messaging/useMessages',
  'hooks/messaging/useScheduledMessages',
  'hooks/messaging/scheduled/',
  'hooks/queries/useEventMessages',
  'hooks/messaging/useGuestMessagesRPC',
  'hooks/messaging/useMessagingRecipients',
  'hooks/messaging/useGuestSelection',
  'hooks/messaging/useCurrentAudienceCount',
  'hooks/messaging/useRecipientPreview',
];

// Allowed import paths
const ALLOWED_PATHS = [
  'hooks/messaging/_core',
  'hooks/messaging/compat', // Temporary during migration
];

module.exports = {
  rules: {
    'no-legacy-messaging-hooks': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow usage of legacy messaging hooks',
          category: 'Best Practices',
        },
        fixable: null,
        schema: [],
        messages: {
          legacyHook: 'Legacy messaging hook "{{hookName}}" is deprecated. Use core hooks from hooks/messaging/_core instead.',
          restrictedImport: 'Import from "{{importPath}}" is restricted. Use hooks/messaging/_core or hooks/messaging/compat instead.',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const importPath = node.source.value;
            
            // Check for restricted import paths
            const isRestricted = RESTRICTED_PATHS.some(restricted => 
              importPath.includes(restricted)
            );
            
            if (isRestricted) {
              context.report({
                node,
                messageId: 'restrictedImport',
                data: {
                  importPath,
                },
              });
            }
          },
          
          CallExpression(node) {
            // Check for direct usage of legacy hooks
            if (node.callee.type === 'Identifier' && LEGACY_HOOKS.includes(node.callee.name)) {
              // Allow usage if imported from compat layer
              const scope = context.getScope();
              const variable = scope.set.get(node.callee.name);
              
              if (variable && variable.defs.length > 0) {
                const importDeclaration = variable.defs[0].node.parent;
                if (importDeclaration && importDeclaration.source) {
                  const importPath = importDeclaration.source.value;
                  if (importPath.includes('hooks/messaging/compat')) {
                    // Allow compat usage but warn
                    return;
                  }
                }
              }
              
              context.report({
                node,
                messageId: 'legacyHook',
                data: {
                  hookName: node.callee.name,
                },
              });
            }
          },
        };
      },
    },
    
    'prefer-core-messaging-hooks': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Prefer core messaging hooks over legacy alternatives',
          category: 'Best Practices',
        },
        fixable: null,
        schema: [],
        messages: {
          preferCore: 'Consider using core hook "{{coreHook}}" instead of legacy "{{legacyHook}}".',
        },
      },
      create(context) {
        const hookMapping = {
          useMessages: 'useEventMessagesList + useMessageMutations',
          useEventMessages: 'useEventMessagesList',
          useScheduledMessages: 'useMessageMutations',
          useSendMessage: 'useMessageMutations',
          useMessagesRealtime: 'useMessageRealtime',
        };
        
        return {
          CallExpression(node) {
            if (node.callee.type === 'Identifier' && hookMapping[node.callee.name]) {
              context.report({
                node,
                messageId: 'preferCore',
                data: {
                  legacyHook: node.callee.name,
                  coreHook: hookMapping[node.callee.name],
                },
              });
            }
          },
        };
      },
    },
    
    'no-direct-messaging-imports': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow direct imports of messaging modules outside of core',
          category: 'Best Practices',
        },
        fixable: null,
        schema: [],
        messages: {
          directImport: 'Direct import of "{{importPath}}" is not allowed. Import from hooks/messaging/_core or hooks/messaging/compat instead.',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const importPath = node.source.value;
            const filename = context.getFilename();
            
            // Skip if we're inside the messaging hooks directory
            if (filename.includes('hooks/messaging/')) {
              return;
            }
            
            // Check for direct imports of messaging modules
            if (importPath.startsWith('hooks/messaging/') && 
                !importPath.includes('/_core') && 
                !importPath.includes('/compat')) {
              
              context.report({
                node,
                messageId: 'directImport',
                data: {
                  importPath,
                },
              });
            }
          },
        };
      },
    },
    
    'no-compat-imports-after-migration': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow compat imports after migration period',
          category: 'Best Practices',
        },
        fixable: null,
        schema: [
          {
            type: 'object',
            properties: {
              migrationEndDate: {
                type: 'string',
                format: 'date',
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          compatExpired: 'Compatibility imports are no longer allowed after {{endDate}}. Migrate to core hooks.',
        },
      },
      create(context) {
        const options = context.options[0] || {};
        const migrationEndDate = options.migrationEndDate || '2025-02-15';
        const endDate = new Date(migrationEndDate);
        const now = new Date();
        
        if (now <= endDate) {
          // Still in migration period, allow compat imports
          return {};
        }
        
        return {
          ImportDeclaration(node) {
            const importPath = node.source.value;
            
            if (importPath.includes('hooks/messaging/compat')) {
              context.report({
                node,
                messageId: 'compatExpired',
                data: {
                  endDate: migrationEndDate,
                },
              });
            }
          },
        };
      },
    },
  },
};
