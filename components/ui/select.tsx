import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white px-3 text-sm text-foreground outline-none transition-colors focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}
