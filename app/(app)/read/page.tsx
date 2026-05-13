import type { Metadata } from "next";
import { ReadPicker } from "@/app/_components/read-picker";
import { getReadingProgress } from "@/lib/data/reading";

export const metadata: Metadata = {
  title: "Pick a meter type",
};

export const dynamic = "force-dynamic";

export default async function ReadPage() {
  const progress = await getReadingProgress();

  if (!progress) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-neutral">
        <p className="text-lg font-semibold text-ink">No site assigned</p>
        <p className="text-sm">
          Reach out to the Harmony Communities team for an assignment.
        </p>
      </div>
    );
  }

  return <ReadPicker progress={progress} />;
}
