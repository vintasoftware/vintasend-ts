import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['vintasend', 'vintasend-prisma', 'vintasend-pug', 'vintasend-nodemailer', 'vintasend-winston'],
};

export default nextConfig;
