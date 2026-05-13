"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, History, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/records", label: "Records", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-10 border-t border-neutral/15 bg-cream px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="grid grid-cols-3 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-ink"
                    : "text-neutral hover:text-ink"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
