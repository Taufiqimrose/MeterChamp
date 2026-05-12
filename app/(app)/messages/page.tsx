import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { PlaceholderPage } from "@/app/_components/placeholder-page";

export const metadata: Metadata = {
  title: "Messages",
};

export default function MessagesPage() {
  return (
    <PlaceholderPage
      icon={MessageCircle}
      title="Messages"
      description="Conversations with the Harmony team will appear here."
    />
  );
}
