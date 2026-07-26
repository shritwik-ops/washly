import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @washly/shared ships its .ts sources directly (no build step -- see
  // its package.json), so it needs transpiling by Next's own toolchain
  // rather than being treated as pre-built node_modules code.
  transpilePackages: ["@washly/shared"],
};

export default nextConfig;
