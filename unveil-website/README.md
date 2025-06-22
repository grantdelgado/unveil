# Unveil Website

The official marketing and compliance website for Unveil at [www.sendunveil.com](https://www.sendunveil.com).

## Purpose

This standalone website serves a dual purpose:
- **Marketing**: Attract prospective wedding hosts (couples and planners)
- **Compliance**: Provide Twilio A2P 10DLC public documentation for SMS consent

## Architecture

The website is completely isolated from the main Unveil mobile app, with its own:
- Next.js App Router setup
- Tailwind CSS configuration
- Component library
- Deployment pipeline

## Tech Stack

- **Framework**: Next.js 15+ with App Router
- **Styling**: Tailwind CSS v4
- **Components**: Custom components with shadcn/ui patterns
- **Typography**: Inter font family
- **Icons**: Lucide React
- **Deployment**: Vercel

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
apps/unveil-website/
├── app/                  # Next.js App Router
│   ├── layout.tsx       # Root layout with metadata
│   ├── page.tsx         # Homepage
│   └── globals.css      # Global styles
├── components/          # Reusable components
│   ├── layout/          # Header, Footer
│   ├── sections/        # Page sections
│   └── ui/              # UI primitives
├── lib/                 # Utilities
└── public/              # Static assets
```

## Key Features

- **Hero Section**: Value proposition and CTA
- **Guest Consent Proof**: Visual documentation for Twilio compliance
- **Policies Section**: SMS consent policy and privacy policy
- **Mobile-First Design**: Responsive and accessible
- **Performance Optimized**: Core Web Vitals compliant

## Deployment

The website is deployed independently to:
- **Production**: [www.sendunveil.com](https://www.sendunveil.com)
- **Preview**: Vercel preview deployments

## Compliance

The website includes comprehensive SMS consent documentation required for Twilio A2P 10DLC compliance, including:
- Visual guest consent flow
- SMS consent policy
- Privacy policy
- Example messages

## Brand Guidelines

- **Font**: Inter (400, 500, 600, 700)
- **Colors**: Rose to purple gradient (#fb7185 to #a855f7)
- **Tone**: Modern, warm, minimal, reliable
- **Layout**: Mobile-first responsive design 