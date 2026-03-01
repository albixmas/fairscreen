/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@fairscreen/db",
    "@fairscreen/shared",
    "@fairscreen/scoring",
    "@fairscreen/extraction",
    "@fairscreen/worker",
  ],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bullmq", "ioredis"],
  },
};

module.exports = nextConfig;
