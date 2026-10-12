import type { NextConfig } from "next";

// Üretimde Cloudflare Worker /api/* isteklerini doğrudan API'ye yönlendirir.
// Worker yokken (yerelde veya doğrudan erişimde) Next.js aynı işi bu yönlendirmeyle yapar.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default config;
