"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearLifecycleStage,
  formatDraftSavedAt,
  mergeProjectLifecycleStage,
  readLifecycleStage,
  type LifecycleStage,
  type LifecycleStageDraftMap,
} from "@/lib/project-lifecycle-storage";

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
  const [restoredDraft] = useState(() => readInitialDraft(scopeKey, stage, enabled));
  const [savedAt, setSavedAt] = useState<string | null>(() => restoredDraft?.savedAt ?? null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isReady = typeof window !== "undefined";

  useEffect(() => {
    if (!enabled || !isReady) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    function persistDraft() {
      try {
        const draft = buildDraft();
        mergeProjectLifecycleStage(scopeKey, stage, draft);
        setSavedAt(draft.savedAt);
        setSaveError(null);
      } catch {
        setSaveError("Draft could not be saved.");
      }
    }

    function scheduleSave() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(persistDraft, debounceMs);
    }

    scheduleSave();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls draft rebuild inputs
  }, [buildDraft, debounceMs, enabled, isReady, scopeKey, stage, ...deps]);

  const bindFormAutoSave = useCallback(
    (form: HTMLFormElement | null) => {
      if (!enabled || !form) return () => {};

      let timeout: ReturnType<typeof setTimeout> | undefined;

      function persistDraft() {
        try {
          const draft = buildDraft();
          mergeProjectLifecycleStage(scopeKey, stage, draft);
          setSavedAt(draft.savedAt);
          setSaveError(null);
        } catch {
          setSaveError("Draft could not be saved.");
        }
      }

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
    [buildDraft, debounceMs, enabled, scopeKey, stage],
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
