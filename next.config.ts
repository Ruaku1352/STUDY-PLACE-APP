import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 参考書の表紙画像をbase64でServer Actionに渡すため上限を緩和
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
