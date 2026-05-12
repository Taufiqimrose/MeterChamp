import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/app/_components/placeholder-page";

export const metadata: Metadata = {
  title: "Insights",
};

export default function InsightsPage() {
  return (
    <PlaceholderPage
      icon={BarChart3}
      title="Insights"
      description="Trends and analytics across your readings will appear here."
    />
  );
}
