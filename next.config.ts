import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "music-metadata",
    "@prisma/client",
    "prisma",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};

export default nextConfig;
