import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma Client の生成先をデフォルトの node_modules 外（src/generated/prisma）に
  // しているため、Next.js のファイルトレーシングだけではサーバーレス関数バンドルに
  // クエリエンジンのバイナリが含まれない。明示的に含める。
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
