import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "@react-pdf/renderer",
  ],
  outputFileTracingIncludes: {
    "/api/receipts/[id]/pdf": ["./public/fonts/**/*"],
  },
};

export default nextConfig;
