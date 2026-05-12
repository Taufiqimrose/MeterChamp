import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function PlaceholderPage({ title, description, icon: Icon }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex size-24 items-center justify-center rounded-3xl bg-secondary/10 text-secondary">
        <Icon className="size-12" strokeWidth={2} aria-hidden />
      </div>
      <div className="flex max-w-xs flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="text-base leading-relaxed text-neutral">
          {description}
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral/70">
          Coming soon
        </p>
      </div>
    </div>
  );
}
