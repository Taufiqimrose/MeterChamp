import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meters Made Easy",
    short_name: "Meters Made Easy",
    description:
      "Meters Made Easy — meter reading PWA by Harmony Communities Inc.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf3e8",
    theme_color: "#008080",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
