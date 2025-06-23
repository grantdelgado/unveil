/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  poweredByHeader: false,
  // Prevent cross-imports from other workspace packages
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Prevent importing from the app package
      '@unveil-app': false,
    };
    return config;
  },
}

module.exports = nextConfig 