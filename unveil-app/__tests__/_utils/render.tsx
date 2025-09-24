/**
 * Test-only render utilities for component testing
 */
import React, { StrictMode } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  strict?: boolean;
}

/**
 * Test-only render helper with optional StrictMode control
 * Use strict: false for legacy tests that cannot tolerate double-invocation
 */
export function renderStable(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { strict = true, ...renderOptions } = options;
  
  const Wrapper = ({ children }: { children?: React.ReactNode }) => {
    if (strict) {
      return <StrictMode>{children}</StrictMode>;
    }
    return <>{children}</>;
  };

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Standard render with StrictMode enabled (default)
 */
export const renderWithStrict = (ui: React.ReactElement, options?: RenderOptions) =>
  renderStable(ui, { strict: true, ...options });

/**
 * Legacy render without StrictMode for problematic tests
 * Use sparingly - prefer fixing tests to be StrictMode-safe
 */
export const renderWithoutStrict = (ui: React.ReactElement, options?: RenderOptions) =>
  renderStable(ui, { strict: false, ...options });
