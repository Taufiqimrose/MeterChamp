import type { Metadata } from "next";
import Link from "next/link";
import {
  Camera,
  Calendar,
  ClipboardList,
  MessageCircle,
} from "lucide-react";
import { ProgressRing } from "@/app/_components/progress-ring";

export const metadata: Metadata = {
  title: "Dashboard",
};

const TOTAL_METERS = 100;
const METERS_READ = 12;
const LAST_METER_ID = "047";
const LAST_METER_AGO = "2 hours ago";
const SITE_NAME = "Meadow Pointe";

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-neutral/15 px-6 py-4">
        <span className="text-base font-semibold text-ink">Hi, John</span>
        <Link
          href="/messages"
          aria-label="Messages"
          className="flex size-10 items-center justify-center rounded-full bg-secondary text-cream transition-colors hover:bg-secondary-hover"
        >
          <MessageCircle className="size-5" aria-hidden />
        </Link>
      </header>

      <main className="flex flex-col items-center gap-8 px-6 py-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral">
            Assigned Site
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">
            {SITE_NAME}
          </h1>
        </div>

        <div className="relative flex items-center justify-center">
          <ProgressRing value={METERS_READ} max={TOTAL_METERS} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl font-extrabold leading-none text-ink">
              {METERS_READ}
            </span>
            <span className="mt-3 text-base text-neutral">
              of {TOTAL_METERS}
            </span>
            <span className="text-sm text-neutral">meters read</span>
          </div>
        </div>

        <p className="text-sm text-neutral">
          Last meter:{" "}
          <span className="font-medium text-ink">#{LAST_METER_ID}</span>{" "}
          · {LAST_METER_AGO}
        </p>

        <Link
          href="/scan"
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-lg font-bold tracking-wide text-ink shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover"
        >
          <Camera className="size-6" aria-hidden />
          RESUME READING
        </Link>

        <div className="grid w-full grid-cols-2 gap-3">
          <Link
            href="/records"
            className="flex items-center justify-center gap-2 rounded-2xl border border-secondary bg-white py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/5"
          >
            <ClipboardList className="size-4" aria-hidden />
            See All Meters
          </Link>
          <Link
            href="/records?range=month"
            className="flex items-center justify-center gap-2 rounded-2xl border border-secondary bg-white py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/5"
          >
            <Calendar className="size-4" aria-hidden />
            This Month
          </Link>
        </div>
      </main>
    </div>
  );
}
