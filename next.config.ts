import type { NextConfig } from "next";
import { API_ORIGIN } from "./projects.config.js";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  trailingSlash: true,
  ...(isDev
    ? {
        // Avoid 308s on POST /api/* while proxying to API Gateway.
        skipTrailingSlashRedirect: true,
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${API_ORIGIN}/api/:path*`,
            },
          ];
        },
      }
    : { output: "export" }),
};

export default nextConfig;
