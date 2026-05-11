import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] text-[color:var(--color-muted-strong)]",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning:
          "border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-surface)] text-[color:var(--color-warning-text)]",
        danger: "border-rose-200 bg-rose-50 text-rose-700",
        info:
          "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] text-[color:var(--color-primary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
