import type { ReactNode } from "react";

export function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--color-muted-strong)]">
      <span>
        {label}
        {required ? (
          <span className="text-[color:var(--color-danger-text)]" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export function RequiredFieldLegend() {
  return (
    <p className="text-xs text-[color:var(--color-muted)]">
      <span className="text-[color:var(--color-danger-text)]" aria-hidden="true">
        *
      </span>{" "}
      Required field
    </p>
  );
}
