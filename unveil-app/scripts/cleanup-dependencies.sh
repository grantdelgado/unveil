#!/bin/bash

# Unveil App - Dependency Cleanup Script
# Removes unused dependencies identified in maintainability audit

set -e

echo "🧹 Starting dependency cleanup..."

# Remove unused production dependencies
echo "📦 Removing unused production dependencies..."
pnpm remove react-window react-window-infinite-loader recharts zustand

# Remove unused dev dependencies  
echo "🔧 Removing unused dev dependencies..."
pnpm remove @sentry/tracing @testing-library/user-event @types/react-window @vitest/coverage-v8 autoprefixer eslint-config-next eslint-plugin-prettier

# Add missing dependencies
echo "➕ Adding missing dependencies..."
pnpm add -D puppeteer glob

# Clean up node_modules and lockfile
echo "🔄 Refreshing dependencies..."
pnpm install

echo "✅ Dependency cleanup complete!"
echo ""
echo "📊 Estimated bundle size reduction: ~2.1MB"
echo "🧪 Run 'pnpm test' to verify everything still works"
