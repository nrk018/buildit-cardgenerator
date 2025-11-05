/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },
  // Optimize for production (Vercel handles this automatically, but good to be explicit)
  swcMinify: true,
}

module.exports = nextConfig


