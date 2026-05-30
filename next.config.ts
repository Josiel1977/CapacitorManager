import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos', pathname: '/**' }],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
        stream: false,
        crypto: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        util: false,
      };
    }
    // Não use alias para pdfjs-dist
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Critical dependency: the request of a dependency is an expression/,
    ];
    return config;
  },
};

export default nextConfig;