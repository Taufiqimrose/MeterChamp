import type { Metadata } from "next";
import { ScanCamera } from "@/app/_components/scan-camera";

export const metadata: Metadata = {
  title: "Scan meter",
};

export default function ScanPage() {
  return <ScanCamera />;
}
