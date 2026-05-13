"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

export interface RangeOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: RangeOption[];
}

export function RecordsRangeSelect({ value, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.currentTarget.value;
    // Preserve other params (like `type=`) by starting from current state.
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "month") sp.delete("range");
    else sp.set("range", next);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={handleChange}
        aria-label="Time range"
        // appearance-none strips OS chrome; we draw our own chevron so the
        // control matches the rounded chip aesthetic. Mobile still pops the
        // OS picker on tap because it's a real <select>.
        className="cursor-pointer appearance-none rounded-full bg-secondary/15 py-1.5 pl-4 pr-9 text-xs font-semibold text-secondary outline-none transition-colors hover:bg-secondary/20 focus:ring-2 focus:ring-secondary/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-secondary"
        aria-hidden
      />
    </div>
  );
}
