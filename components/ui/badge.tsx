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
        success:
          "border-[color:var(--color-success-border)] bg-[color:var(--color-success-surface)] text-[color:var(--color-success-text)]",
        warning:
          "border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-surface)] text-[color:var(--color-warning-text)]",
        danger:
          "border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-surface)] text-[color:var(--color-danger-text)]",
        info:
          "border-[color:var(--color-primary-soft-strong)] bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]",
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
