import { cn } from "@/lib/utils";

export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="grid size-10 place-items-center border border-gold font-display text-base font-semibold tracking-wider text-gold"
      >
        JG
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-lg font-semibold tracking-[0.18em]",
            tone === "light" ? "text-ivory" : "text-navy",
          )}
        >
          JERRY GROUP
        </span>
        <span
          className={cn(
            "mt-1 text-[0.6rem] font-medium uppercase tracking-[0.32em]",
            tone === "light" ? "text-ivory/60" : "text-muted-foreground",
          )}
        >
          London
        </span>
      </span>
    </span>
  );
}
