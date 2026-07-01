import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { capacityMbpsInputValue } from "@/lib/capacity";
import { cn } from "@/lib/utils";

type CapacityMbpsInputProps = {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
  className?: string;
};

export function CapacityMbpsInput({
  name,
  defaultValue,
  value,
  onChange,
  required = false,
  placeholder = "1",
  step = "0.01",
  min = "0.01",
  className,
}: CapacityMbpsInputProps) {
  const inputValueProps =
    value == null
      ? { defaultValue: capacityMbpsInputValue(defaultValue) }
      : {
          value,
          onChange: (event: ChangeEvent<HTMLInputElement>) =>
            onChange?.(event.currentTarget.value),
        };

  return (
    <div className="flex h-10 min-w-[9rem] items-center overflow-hidden rounded-md border border-[color:var(--color-border)] bg-white">
      <Input
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        placeholder={placeholder}
        required={required}
        className={cn(
          "h-full min-w-0 flex-1 border-0 px-2 text-right tabular-nums focus-visible:ring-0",
          className,
        )}
        {...inputValueProps}
      />
      <span className="shrink-0 border-l border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-2 text-xs font-medium text-[color:var(--color-muted-strong)]">
        Mbps
      </span>
    </div>
  );
}
