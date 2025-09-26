/**
 * ESLint rule: Enforce canonical messaging RPC usage
 * 
 * Prevents direct calls to get_guest_event_messages_v2 or get_guest_event_messages_v3
 * Forces usage of the canonical get_guest_event_messages alias.
 */

module.exports = {
  'canonical-messaging-rpc': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Enforce canonical messaging RPC usage',
        category: 'Best Practices',
        recommended: true,
      },
      fixable: 'code',
      messages: {
        directVersionCall: 'Use canonical alias "get_guest_event_messages" instead of "{{functionName}}". Direct version calls can cause type mismatches and break delegation pattern.',
      },
    },
    create(context) {
      return {
        CallExpression(node) {
          // Check for supabase.rpc calls
          if (
            node.callee?.property?.name === 'rpc' &&
            node.arguments?.[0]?.type === 'Literal'
          ) {
            const functionName = node.arguments[0].value;
            
            if (
              functionName === 'get_guest_event_messages_v2' ||
              functionName === 'get_guest_event_messages_v3'
            ) {
              context.report({
                node: node.arguments[0],
                messageId: 'directVersionCall',
                data: {
                  functionName,
                },
                fix(fixer) {
                  return fixer.replaceText(
                    node.arguments[0],
                    "'get_guest_event_messages'"
                  );
                },
              });
            }
          }
        },
      };
    },
  },
};
