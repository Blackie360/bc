"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type FormSubmitButtonProps = Omit<ButtonProps, "type" | "children"> & {
  children: React.ReactNode;
  pendingLabel?: string;
};

export function FormSubmitButton({
  children,
  pendingLabel = "Saving…",
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Spinner className="size-4" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
