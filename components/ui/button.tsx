import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--color-primary)] text-white hover:bg-[color:var(--color-primary-strong)] focus-visible:outline-[color:var(--color-primary)]",
        secondary:
          "border border-[color:var(--color-border)] bg-white text-[color:var(--color-muted-strong)] hover:bg-[color:var(--color-surface-soft)] focus-visible:outline-[color:var(--color-muted)]",
        ghost:
          "text-[color:var(--color-muted-strong)] hover:bg-[color:var(--color-surface-soft)] hover:text-[color:var(--color-primary)] focus-visible:outline-[color:var(--color-muted)]",
        warning:
          "border border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-surface)] text-[color:var(--color-warning-text)] hover:bg-[#ffeec1] focus-visible:outline-[color:var(--color-warning-border)]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-7 px-3 text-xs",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
