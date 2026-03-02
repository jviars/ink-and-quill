/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // ✅ critical for SSG
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};
export default nextConfig;
