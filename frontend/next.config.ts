import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // StrictMode double-mounts every component in dev, which destroys and
  // recreates WebSocket connections on every page load. Disabling it here
  // prevents that noise. In production builds StrictMode has no effect anyway.
  reactStrictMode: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
