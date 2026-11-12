import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-input bg-card px-3.5 py-3 text-base text-navy shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/30 aria-[invalid=true]:border-destructive md:text-sm";

export function Field({
  id,
  label,
  error,
  hint,
  optional,
  optionalLabel,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  optional?: boolean | undefined;
  optionalLabel?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-navy">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({optionalLabel})</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
