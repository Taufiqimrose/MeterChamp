import type { Metadata } from "next";
import Link from "next/link";
import {
  Camera,
  Calendar,
  ClipboardList,
  MessageCircle,
} from "lucide-react";
import { ProgressRing } from "@/app/_components/progress-ring";
import { getDashboardSnapshot } from "@/lib/data/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  if (!snapshot) {
    return null; // unreachable — layout gates auth
  }

  const { fullName, parkName, totalMeters, readingsThisMonth, lastMeter } =
    snapshot;
  const firstName = fullName.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-neutral/15 px-6 py-4">
        <span className="text-base font-semibold text-ink">
          Hi, {firstName}
        </span>
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
            {parkName ?? "No site assigned"}
          </h1>
        </div>

        {parkName ? (
          <>
            <div className="relative flex items-center justify-center">
              <ProgressRing
                value={readingsThisMonth}
                max={Math.max(totalMeters, 1)}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-extrabold leading-none text-ink">
                  {readingsThisMonth}
                </span>
                <span className="mt-3 text-base text-neutral">
                  of {totalMeters}
                </span>
                <span className="text-sm text-neutral">meters read</span>
              </div>
            </div>

            <p className="text-sm text-neutral">
              {lastMeter ? (
                <>
                  Last reading:{" "}
                  <span className="font-medium text-ink">
                    {lastMeter.unitLabel}
                  </span>{" "}
                  · {lastMeter.meterType} ·{" "}
                  {formatRelative(lastMeter.capturedAt)}
                </>
              ) : (
                <>No readings yet this cycle</>
              )}
            </p>

            <Link
              href="/read"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-lg font-bold tracking-wide text-ink shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover"
            >
              <Camera className="size-6" aria-hidden />
              {readingsThisMonth > 0 ? "RESUME READING" : "START READING"}
            </Link>

            <div className="grid w-full grid-cols-2 gap-3">
              <Link
                href="/records?range=all"
                className="flex items-center justify-center gap-2 rounded-2xl border border-secondary bg-white py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/5"
              >
                <ClipboardList className="size-4" aria-hidden />
                See All Records
              </Link>
              <Link
                href="/records?range=month"
                className="flex items-center justify-center gap-2 rounded-2xl border border-secondary bg-white py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/5"
              >
                <Calendar className="size-4" aria-hidden />
                This Month
              </Link>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-neutral/20 bg-white px-6 py-8 text-sm leading-relaxed text-neutral">
            You haven&apos;t been assigned to a site yet. Reach out to the
            Harmony Communities team to get an assignment.
          </div>
        )}
      </main>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
