/**
 * Import Path Standards for Unveil
 *
 * Defines consistent import conventions and provides utilities
 * for enforcing standardized import patterns across the application.
 */

// Import path conventions
export const IMPORT_CONVENTIONS = {
  // External libraries should be imported first
  EXTERNAL_FIRST: true,

  // React imports should come first among externals
  REACT_FIRST: true,

  // Next.js imports should come after React
  NEXTJS_AFTER_REACT: true,

  // Internal imports should be grouped and ordered
  INTERNAL_ORDER: [
    '@/app', // App-specific imports
    '@/components', // UI components
    '@/hooks', // Custom hooks
    '@/lib', // Library utilities
    '@/services', // Business logic services
    '@/types', // Type definitions
  ],

  // Type imports should be separated when possible
  SEPARATE_TYPE_IMPORTS: true,

  // Prefer specific imports over barrel exports for better tree-shaking
  PREFER_SPECIFIC_IMPORTS: true,

  // Use absolute paths with @ alias consistently
  USE_ABSOLUTE_PATHS: true,
} as const;

// Standardized import patterns
export const STANDARD_IMPORT_PATTERNS = {
  // React and hooks
  REACT: "import React from 'react'",
  REACT_HOOKS:
    "import { useState, useEffect, useCallback, useMemo } from 'react'",

  // Next.js
  NEXT_ROUTER: "import { useRouter, usePathname } from 'next/navigation'",
  NEXT_IMAGE: "import Image from 'next/image'",
  NEXT_LINK: "import Link from 'next/link'",

  // Supabase
  SUPABASE_CLIENT: "import { supabase } from '@/lib/supabase/client'",
  SUPABASE_TYPES: "import type { User, Session } from '@supabase/supabase-js'",

  // Internal types
  APP_TYPES:
    "import type { Event, EventGuest, Message, Media } from '@/lib/types'",
  ERROR_TYPES:
    "import type { AuthError, DatabaseError, MediaError } from '@/lib/types'",
  HOOK_TYPES:
    "import type { AuthHookResult, EventDetailsHookResult } from '@/lib/types'",

  // Services (prefer specific imports)
  AUTH_SERVICE: "import { sendOTP, verifyOTP, signOut } from '@/services/auth'",
  EVENTS_SERVICE:
    "import { createEvent, getEventDetails, updateEvent } from '@/services/events'",
  MEDIA_SERVICE:
    "import { uploadMedia, getEventMedia, deleteMedia } from '@/services/media'",

  // UI Components (prefer specific imports)
  UI_COMPONENTS:
    "import { Button, Input, LoadingSpinner } from '@/components/ui'",

  // Utilities
  LOGGER: "import { logAuth, logError, logDev } from '@/lib/logger'",
  VALIDATION:
    "import { validatePhoneNumber, validateEmail } from '@/lib/validations'",
  ERROR_HANDLING:
    "import { handleDatabaseError, withErrorHandling } from '@/lib/error-handling'",
} as const;

// Import grouping rules
export interface ImportGroup {
  name: string;
  order: number;
  patterns: string[];
  description: string;
}

export const IMPORT_GROUPS: ImportGroup[] = [
  {
    name: 'react',
    order: 1,
    patterns: ['react', 'react-dom', 'react/*'],
    description: 'React core and related packages',
  },
  {
    name: 'next',
    order: 2,
    patterns: ['next', 'next/*'],
    description: 'Next.js framework imports',
  },
  {
    name: 'external',
    order: 3,
    patterns: ['@supabase/*', 'zod', 'date-fns', 'clsx', 'tailwind-merge'],
    description: 'Third-party libraries and packages',
  },
  {
    name: 'internal-types',
    order: 4,
    patterns: ['@/lib/types', '@/lib/types/*'],
    description: 'Internal type definitions',
  },
  {
    name: 'internal-lib',
    order: 5,
    patterns: ['@/lib/*'],
    description: 'Internal library utilities',
  },
  {
    name: 'internal-services',
    order: 6,
    patterns: ['@/services', '@/services/*'],
    description: 'Business logic services',
  },
  {
    name: 'internal-hooks',
    order: 7,
    patterns: ['@/hooks', '@/hooks/*'],
    description: 'Custom React hooks',
  },
  {
    name: 'internal-components',
    order: 8,
    patterns: ['@/components', '@/components/*'],
    description: 'UI components',
  },
  {
    name: 'internal-app',
    order: 9,
    patterns: ['@/app/*'],
    description: 'App-specific imports',
  },
  {
    name: 'relative',
    order: 10,
    patterns: ['./.*', '../.*'],
    description: 'Relative imports (should be avoided when possible)',
  },
];

// Specific import recommendations for common scenarios
export const IMPORT_RECOMMENDATIONS = {
  // Authentication pages
  AUTH_PAGE: [
    "import { useState, useCallback } from 'react'",
    "import { useRouter } from 'next/navigation'",
    "import type { AuthError } from '@/lib/types'",
    "import { sendOTP, verifyOTP } from '@/services/auth'",
    "import { validatePhoneNumber } from '@/lib/validations'",
    "import { logAuth, logAuthError } from '@/lib/logger'",
    "import { Button, Input } from '@/components/ui'",
  ],

  // Event pages
  EVENT_PAGE: [
    "import { useEffect, useState, useCallback } from 'react'",
    "import { useRouter, useParams } from 'next/navigation'",
    "import type { Event, EventGuest, EventDetailsHookResult } from '@/lib/types'",
    "import { useEventDetails } from '@/hooks/events'",
    "import { useAuth } from '@/hooks/auth'",
    "import { createEvent, updateEvent } from '@/services/events'",
    "import { logError } from '@/lib/logger'",
    "import { Button, Input, LoadingSpinner } from '@/components/ui'",
  ],

  // Service files
  SERVICE_FILE: [
    "import { supabase } from '@/lib/supabase/client'",
    "import type { Event, EventInsert, EventUpdate } from '@/lib/types'",
    "import { handleDatabaseError } from '@/lib/error-handling'",
    "import { logDatabaseError } from '@/lib/logger'",
  ],

  // Hook files
  HOOK_FILE: [
    "import { useEffect, useState, useCallback, useMemo } from 'react'",
    "import { supabase } from '@/lib/supabase/client'",
    "import type { EventDetailsHookResult, DatabaseError } from '@/lib/types'",
    "import { createDatabaseError } from '@/lib/types'",
    "import { withErrorHandling } from '@/lib/error-handling'",
    "import { logError } from '@/lib/logger'",
  ],

  // Component files
  COMPONENT_FILE: [
    "import React, { useState, useCallback } from 'react'",
    "import type { ComponentProps, ReactNode } from 'react'",
    "import { cn } from '@/lib/utils'",
    "import { Button } from '@/components/ui'",
  ],
} as const;

// Import validation utilities
export interface ImportValidationRule {
  name: string;
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export const IMPORT_VALIDATION_RULES: ImportValidationRule[] = [
  {
    name: 'no-barrel-imports-for-large-modules',
    pattern: /import\s+.*\s+from\s+['"]@\/services['"]$/,
    message:
      'Prefer specific imports over barrel exports for better tree-shaking: import { specificFunction } from "@/services/specificService"',
    severity: 'warning',
  },
  {
    name: 'prefer-absolute-paths',
    pattern: /import\s+.*\s+from\s+['"]\.\.?\//,
    message: 'Prefer absolute paths with @ alias over relative paths',
    severity: 'warning',
  },
  {
    name: 'separate-type-imports',
    pattern: /import\s+\{[^}]*type\s+[^}]*\}\s+from/,
    message:
      'Consider separating type imports: import type { TypeName } from "module"',
    severity: 'info',
  },
  {
    name: 'consistent-react-imports',
    pattern: /import\s+React\s*,\s*\{.*\}\s+from\s+['"]react['"]/,
    message:
      'Consider importing React separately if not using JSX: import { useState } from "react"',
    severity: 'info',
  },
];

// Utility functions for import standardization
export const ImportUtils = {
  /**
   * Sort imports according to standardized groups
   */
  sortImports: (imports: string[]): string[] => {
    const grouped = new Map<number, string[]>();

    imports.forEach((importStatement) => {
      const group = ImportUtils.getImportGroup(importStatement);
      const order = group?.order ?? 999;

      if (!grouped.has(order)) {
        grouped.set(order, []);
      }
      grouped.get(order)!.push(importStatement);
    });

    // Sort groups by order, then sort imports within each group alphabetically
    const sortedGroups = Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([, imports]) => imports.sort());

    return sortedGroups.flat();
  },

  /**
   * Get the import group for a given import statement
   */
  getImportGroup: (importStatement: string): ImportGroup | null => {
    for (const group of IMPORT_GROUPS) {
      for (const pattern of group.patterns) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(importStatement)) {
          return group;
        }
      }
    }
    return null;
  },

  /**
   * Validate import statement against rules
   */
  validateImport: (
    importStatement: string,
  ): Array<{
    rule: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }> => {
    const violations = [];

    for (const rule of IMPORT_VALIDATION_RULES) {
      if (rule.pattern.test(importStatement)) {
        violations.push({
          rule: rule.name,
          message: rule.message,
          severity: rule.severity,
        });
      }
    }

    return violations;
  },

  /**
   * Convert relative import to absolute import
   */
   
  toAbsoluteImport: (importStatement: string): string => {
    // Implementation would depend on file structure analysis
    // This is a placeholder for the concept
    return importStatement.replace(/from\s+['"]\.\.?\//, 'from "@/');
  },

  /**
   * Split combined imports into separate type and value imports
   */
  separateTypeImports: (importStatement: string): string[] => {
    const typeRegex = /import\s+\{([^}]*)\}\s+from\s+(['"][^'"]+['"])/;
    const match = importStatement.match(typeRegex);

    if (!match) return [importStatement];

    const [, imports, module] = match;
    const typeImports: string[] = [];
    const valueImports: string[] = [];

    imports.split(',').forEach((imp) => {
      const trimmed = imp.trim();
      if (trimmed.startsWith('type ')) {
        typeImports.push(trimmed.substring(5));
      } else {
        valueImports.push(trimmed);
      }
    });

    const result = [];
    if (typeImports.length > 0) {
      result.push(`import type { ${typeImports.join(', ')} } from ${module}`);
    }
    if (valueImports.length > 0) {
      result.push(`import { ${valueImports.join(', ')} } from ${module}`);
    }

    return result;
  },
};

// ESLint rule configuration for import ordering
export const ESLINT_IMPORT_RULES = {
  'import/order': [
    'error',
    {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
        'type',
      ],
      pathGroups: [
        {
          pattern: 'react',
          group: 'external',
          position: 'before',
        },
        {
          pattern: 'next/**',
          group: 'external',
          position: 'after',
        },
        {
          pattern: '@/**',
          group: 'internal',
          position: 'before',
        },
      ],
      pathGroupsExcludedImportTypes: ['type'],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    },
  ],
  'import/no-default-export': 'off', // Next.js requires default exports for pages
  'import/prefer-default-export': 'off',
  'import/no-cycle': 'error',
  'import/no-self-import': 'error',
  'import/no-useless-path-segments': 'error',
} as const;
