import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white px-3 text-sm text-foreground outline-none transition-colors placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-surface-soft)]",
        className,
      )}
      {...props}
    />
  );
}
