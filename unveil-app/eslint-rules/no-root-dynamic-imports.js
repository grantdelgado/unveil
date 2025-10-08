/**
 * ESLint rule to prevent next/dynamic imports in root layout and providers
 * Prevents CSR bailouts that cause non-deterministic first paint on iOS
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent next/dynamic imports in root layout and provider files',
      category: 'iOS Compatibility',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noDynamicInRoot: 'next/dynamic imports are not allowed in root layout or provider files. Move dynamic imports to page level to prevent CSR bailouts on iOS WebView.',
      noDynamicInProviders: 'next/dynamic imports in provider files cause CSR bailouts. Use static imports for deterministic first paint.',
      noDynamicInLayout: 'next/dynamic imports in app/layout.tsx cause SSR bailouts. Move to page-level components.',
    },
  },

  create(context) {
    const filename = context.getFilename();
    const isRootLayout = filename.includes('app/layout.tsx');
    const isProvider = filename.includes('Provider.tsx') || filename.includes('providers/');
    const isRootLevel = isRootLayout || isProvider;

    if (!isRootLevel) {
      return {}; // Only check root-level files
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'next/dynamic') {
          const messageId = isRootLayout ? 'noDynamicInLayout' : 'noDynamicInProviders';
          context.report({
            node,
            messageId,
          });
        }
      },

      CallExpression(node) {
        // Check for dynamic() calls
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'dynamic'
        ) {
          const messageId = isRootLayout ? 'noDynamicInLayout' : 'noDynamicInProviders';
          context.report({
            node,
            messageId,
          });
        }
      },
    };
  },
};