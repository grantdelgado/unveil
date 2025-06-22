# Unveil Monorepo

A monorepo containing the Unveil wedding platform and marketing website.

## Project Structure

```
unveil/
├── unveil-app/          # Main wedding app (Next.js + Supabase)
├── unveil-website/      # Marketing site (Next.js static)
├── package.json         # Root workspace configuration
└── pnpm-workspace.yaml  # PNPM workspace definition
```

## Prerequisites

- Node.js ≥18.0.0
- PNPM ≥8.0.0

## Quick Start

```bash
# Install all dependencies for both projects
pnpm install

# Run both projects in development mode
pnpm dev
# App runs on http://localhost:3000
# Website runs on http://localhost:3001

# Build both projects
pnpm build
```

## Available Scripts

### Development
```bash
pnpm dev            # Run both projects in parallel
pnpm dev:app        # Run only the main app
pnpm dev:website    # Run only the marketing website
```

### Building
```bash
pnpm build          # Build both projects
pnpm build:app      # Build only the main app
pnpm build:website  # Build only the marketing website
```

### Testing (App Only)
```bash
pnpm test           # Run unit tests
pnpm test:e2e       # Run end-to-end tests
pnpm test:all       # Run all tests including performance
```

### Linting & Type Checking
```bash
pnpm lint           # Lint both projects
pnpm lint:fix       # Fix linting issues (app only)
pnpm type-check     # Type check both projects
```

### Utilities
```bash
pnpm clean          # Clean build artifacts and cache
pnpm clean:all      # Clean everything and reinstall
```

## Project-Specific Work

### Working on the Main App
```bash
cd unveil-app
pnpm dev
# App-specific commands available here
```

### Working on the Website
```bash
cd unveil-website
pnpm dev
# Website-specific commands available here
```

## Environment Variables

Each project maintains its own environment variables:

- `unveil-app/.env.local` - App configuration (Supabase, Twilio, etc.)
- `unveil-website/.env.local` - Website configuration (if needed)

## Architecture

- **Unveil App**: Full-stack wedding application with authentication, media sharing, messaging, and event management
- **Unveil Website**: Marketing site with static pages for landing, features, and policies

## Development Guidelines

1. Keep projects completely separate - no cross-imports allowed
2. Use workspace commands from root for efficiency
3. Environment variables are scoped to each project
4. Each project has its own deployment pipeline
5. Shared dependencies are managed at the workspace level

## Deployment

- **App**: Deploy from `unveil-app/` directory
- **Website**: Deploy from `unveil-website/` directory

Both projects can be deployed independently. # Test deployment Sun Jun 22 12:35:21 HST 2025
