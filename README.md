# Unveil Monorepo

A production-ready monorepo containing the Unveil wedding coordination platform and marketing website.

## 📦 Projects

- **`unveil-app/`** - Main wedding coordination application
- **`unveil-website/`** - Marketing and compliance website

## 🏗️ Architecture & Technology Stack

### Aligned Versions (Production-Ready)
- **Next.js**: 15.3.4 (Latest stable)
- **React**: 19.0.0 (Latest with concurrent features)
- **TypeScript**: 5.x with ES2020 target
- **Tailwind CSS**: v4 (Latest with enhanced performance)
- **pnpm**: 8.15.0+ (Workspace management)

### unveil-app Stack
- **Framework**: Next.js 15.3.4 App Router
- **Database**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Styling**: Tailwind CSS v4 with custom design system
- **State**: TanStack Query + React 19 concurrent features
- **Testing**: Vitest + Playwright + MSW
- **Monitoring**: Sentry + custom performance monitoring
- **Messaging**: Twilio SMS integration
- **Deployment**: Vercel with cron jobs

### unveil-website Stack  
- **Framework**: Next.js 15.3.4 App Router (static generation)
- **Styling**: Tailwind CSS v4 with marketing-focused themes
- **Performance**: Optimized for Core Web Vitals
- **Deployment**: Vercel at www.sendunveil.com

## 🚀 Development Commands

```bash
# Install all dependencies
pnpm install

# Development (both apps)
pnpm dev              # Run both apps concurrently
pnpm dev:app          # Main app only (localhost:3000)
pnpm dev:website      # Website only (localhost:3001)

# Building
pnpm build            # Build both projects
pnpm build:app        # Build main app
pnpm build:website    # Build website

# Testing (unveil-app)
pnpm test             # Unit tests
pnpm test:e2e         # End-to-end tests
pnpm test:all         # All tests + performance audits

# Linting & Type Checking
pnpm lint             # Lint all projects
pnpm type-check       # TypeScript validation
```

## 🔧 Configuration Notes

### Port Configuration
- **unveil-app**: 3000 (development), 443/80 (production)
- **unveil-website**: 3001 (development), 443/80 (production at www.sendunveil.com)

### Tailwind CSS v4 Setup
Both projects use Tailwind v4 with:
- PostCSS plugin: `@tailwindcss/postcss`
- Modern CSS imports: `@import 'tailwindcss'`
- TypeScript configuration files
- Custom design systems per project

### Environment Variables
- **unveil-app**: Requires Supabase + Twilio + Sentry configuration
- **unveil-website**: Minimal setup (analytics optional)
- All secrets in `.env.local` (not committed)

## 🛡️ Production Architecture

### Security Features
- Row Level Security (RLS) on all database tables
- CSP headers and security middleware  
- Rate limiting on API routes
- PKCE flow for authentication
- Comprehensive error handling

### Performance Optimizations
- React 19 concurrent rendering
- Tailwind CSS v4 performance improvements
- Next.js App Router with ISR
- Image optimization and CDN
- Bundle splitting and lazy loading

## 📋 Development Guidelines

### Code Standards
- TypeScript strict mode enabled
- ESLint + Prettier for code formatting
- React 19 patterns and best practices
- Mobile-first responsive design
- Accessibility compliance (WCAG 2.1 AA)

### Version Alignment Strategy
All major dependencies are aligned for consistency:
- Reduces dependency conflicts
- Simplifies security updates
- Ensures compatibility across packages
- Enables shared tooling and configurations

### Cross-Package Prevention
Webpack aliases prevent accidental imports:
- `unveil-app` cannot import from `@unveil-website`
- `unveil-website` cannot import from `@unveil-app`
- Maintains clean separation of concerns

## 🚢 Deployment

### Production Environments
- **Main App**: Deployed to Vercel with database at Supabase
- **Website**: Static deployment to www.sendunveil.com
- **Database**: Supabase PostgreSQL with global CDN
- **Storage**: Supabase Storage with image optimization

### CI/CD Pipeline
- Automated testing on all PRs
- Type checking and linting validation
- Security and performance audits
- Zero-downtime deployments via Vercel

---

## 🤝 Contributing

1. Follow the established code standards
2. Update tests for new features
3. Maintain version alignment
4. Document architectural decisions
5. Test across both mobile and desktop

For detailed development setup, see individual project README files.
