"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function FileUploadField({
  id,
  name,
  required,
  accept,
  defaultFileName,
  className,
  multiple = false,
}: {
  id: string;
  name: string;
  required?: boolean;
  accept?: string;
  defaultFileName?: string;
  className?: string;
  multiple?: boolean;
}) {
  const [fileName, setFileName] = useState(defaultFileName ?? "No file selected");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);

    if (files.length === 0) {
      setFileName("No file selected");
      return;
    }

    setFileName(files.map((file) => file.name).join(", "));
  }

  return (
    <div className={cn(
        "flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-white px-2.5 py-1",
        className,
      )}
    >
      <label
        htmlFor={id}
        className="inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md bg-[color:var(--color-surface-soft)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-muted-strong)] outline-none ring-inset hover:bg-[color:var(--color-primary-soft)] hover:text-[color:var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
      >
        Choose file
      </label>
      <span
        className="min-w-0 flex-1 truncate text-left text-xs text-[color:var(--color-muted-strong)]"
        title={fileName}
      >
        {fileName}
      </span>
      <input
        id={id}
        name={name}
        type="file"
        required={required}
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
      />
    </div>
  );
}
