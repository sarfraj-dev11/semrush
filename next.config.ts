import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libsql ships native bindings that must not be bundled by Turbopack.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
