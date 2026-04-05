import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/admin", destination: "/myadminportal/dashboard", permanent: false },
      {
        source: "/admin/:path*",
        destination: "/myadminportal/:path*",
        permanent: false,
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' ,
        hostname: 'picsum.photos' ,
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverMinification: false,
  },
};

export default nextConfig;
