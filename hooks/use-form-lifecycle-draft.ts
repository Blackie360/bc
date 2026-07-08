"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLifecycleStage,
  formatDraftSavedAt,
  mergeProjectLifecycleStage,
  readLifecycleStage,
  type LifecycleStage,
  type LifecycleStageDraftMap,
} from "@/lib/project-lifecycle-storage";
import { notifyDraftRestored, notifyDraftSaved, notifyDraftSaveError } from "@/lib/toast";

type UseFormLifecycleDraftOptions<S extends LifecycleStage> = {
  scopeKey: string;
  stage: S;
  enabled?: boolean;
  debounceMs?: number;
  buildDraft: () => LifecycleStageDraftMap[S];
  deps?: unknown[];
};

function readInitialDraft<S extends LifecycleStage>(
  scopeKey: string,
  stage: S,
  enabled: boolean,
): LifecycleStageDraftMap[S] | null {
  if (!enabled || typeof window === "undefined") {
    return null;
  }

  return readLifecycleStage(scopeKey, stage);
}

export function useFormLifecycleDraft<S extends LifecycleStage>({
  scopeKey,
  stage,
  enabled = true,
  debounceMs = 800,
  buildDraft,
  deps = [],
}: UseFormLifecycleDraftOptions<S>) {
  const [isReady, setIsReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState<LifecycleStageDraftMap[S] | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasNotifiedRestoreRef = useRef(false);
  const persistCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (!enabled) {
        setIsReady(true);
        return;
      }

      const draft = readInitialDraft(scopeKey, stage, enabled);
      setRestoredDraft(draft);
      setSavedAt(draft?.savedAt ?? null);
      setIsReady(true);

      if (draft?.savedAt && !hasNotifiedRestoreRef.current) {
        hasNotifiedRestoreRef.current = true;
        notifyDraftRestored(formatDraftSavedAt(draft.savedAt));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, scopeKey, stage]);

  const persistDraft = useCallback(() => {
    try {
      const draft = buildDraft();
      mergeProjectLifecycleStage(scopeKey, stage, draft);
      setSavedAt(draft.savedAt);
      setSaveError(null);
      persistCountRef.current += 1;
      if (persistCountRef.current > 1) {
        notifyDraftSaved(formatDraftSavedAt(draft.savedAt));
      }
    } catch {
      const message = "Draft could not be saved.";
      setSaveError(message);
      notifyDraftSaveError(message);
    }
  }, [buildDraft, scopeKey, stage]);

  useEffect(() => {
    if (!enabled || !isReady) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    function scheduleSave() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(persistDraft, debounceMs);
    }

    scheduleSave();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [debounceMs, enabled, isReady, persistDraft, ...deps]);

  const bindFormAutoSave = useCallback(
    (form: HTMLFormElement | null) => {
      if (!enabled || !form) return () => {};

      let timeout: ReturnType<typeof setTimeout> | undefined;

      function scheduleSave() {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(persistDraft, debounceMs);
      }

      form.addEventListener("input", scheduleSave);
      form.addEventListener("change", scheduleSave);
      scheduleSave();

      return () => {
        if (timeout) clearTimeout(timeout);
        form.removeEventListener("input", scheduleSave);
        form.removeEventListener("change", scheduleSave);
      };
    },
    [debounceMs, enabled, persistDraft],
  );

  function clearDraft() {
    clearLifecycleStage(scopeKey, stage);
    setSavedAt(null);
    setSaveError(null);
  }

  return {
    isReady,
    savedAt,
    savedAtLabel: savedAt ? formatDraftSavedAt(savedAt) : null,
    saveError,
    restoredDraft,
    clearDraft,
    bindFormAutoSave,
  };
}
