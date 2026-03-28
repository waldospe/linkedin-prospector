/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'bcryptjs'],
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'bcryptjs']
  }
};

export default nextConfig;
