import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // Keep the 4.97 MB model out of the precache manifest — it's only needed
  // by /scan, and shipping it in the first SW install slows every cold load.
  // The SW's NetworkOnly rule (see app/sw.ts) handles fetching it.
  globPublicPatterns: ["**/!(*.onnx)"],
});

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Photo uploads via capturePhoto server action; phone photos can be a
    // few MB. Default 1 MB is too low.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default withSerwist(nextConfig);
