import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, { dev, isServer }) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }

    // 🔧 FIX: Configurações para o pdfjs-dist funcionar no cliente
    if (!isServer) {
      // Impede o webpack de tentar incluir módulos Node.js no bundle do cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        crypto: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
      };
    }

    // Alias para forçar o uso da versão legada do pdfjs-dist (compatível)
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.js',
    };

    // Ignora alguns warnings específicos que o pdfjs-dist pode gerar
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Critical dependency: the request of a dependency is an expression/,
      /Module not found: Can't resolve 'fs'/,
      /Module not found: Can't resolve 'path'/,
    ];

    return config;
  },
};

export default nextConfig;