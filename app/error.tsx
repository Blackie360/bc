"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-xl rounded-lg border border-[color:var(--color-border)] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-warning-surface)] text-[color:var(--color-warning-text)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-[color:var(--color-primary)]">
              Workflow data is unavailable
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted-strong)]">
              Something went wrong while loading workflow data. Check the server logs,
              then try again.
            </p>
            {error.digest ? (
              <p className="mt-3 font-mono text-xs text-[color:var(--color-muted)]">
                Error digest: {error.digest}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => unstable_retry()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      </section>
    </main>
  );
}
