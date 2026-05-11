import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-none rounded-md border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}
