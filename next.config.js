/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.edgestore.dev",
      },
      {
        protocol: "https",
        hostname: "pub-016cea187e65447bbd8c605758a5dfdd.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    // missingSuspenseWithCSRBailout: false,
  },
};

module.exports = nextConfig;
