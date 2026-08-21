import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos', pathname: '/**' }],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
    // O Webpack usa eval no servidor de desenvolvimento. A exceção nunca é
    // aplicada ao build de produção.
    const scriptSrc = process.env.NODE_ENV === 'development'
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' https://www.mercadopago.com https://www.mercadopago.com.br",
      "object-src 'none'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https://picsum.photos",
      `connect-src 'self' ${supabaseOrigin} wss://*.supabase.co`,
      "upgrade-insecure-requests",
    ].join('; ');
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }];
  },
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
