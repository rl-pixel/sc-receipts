import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
    "@react-pdf/renderer",
  ],
};

export default nextConfig;
