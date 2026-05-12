import type { Metadata } from "next";
import { History } from "lucide-react";
import { PlaceholderPage } from "@/app/_components/placeholder-page";

export const metadata: Metadata = {
  title: "Records",
};

export default function RecordsPage() {
  return (
    <PlaceholderPage
      icon={History}
      title="Records"
      description="All your past meter readings and their history will appear here."
    />
  );
}
