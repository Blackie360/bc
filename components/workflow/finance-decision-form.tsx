"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { DraftSavedNotice } from "@/components/workflow/draft-saved-notice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormLifecycleDraft } from "@/hooks/use-form-lifecycle-draft";
import {
  readFormFieldValue,
  readLifecycleStage,
  type FinanceDecisionDraft,
} from "@/lib/project-lifecycle-storage";

export function FinanceDecisionForm({
  action,
  decision,
  label,
  notesPlaceholder,
  variant = "secondary",
  projectId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  decision: string;
  label: string;
  notesPlaceholder: string;
  variant?: "default" | "secondary" | "warning";
  projectId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { isReady, savedAtLabel, saveError, restoredDraft, clearDraft, bindFormAutoSave } =
    useFormLifecycleDraft({
      scopeKey: projectId,
      stage: "financeDecision",
      buildDraft: () => buildFinanceDecisionDraft(formRef.current, decision, projectId),
      deps: [decision, projectId],
    });

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady]);

  function buildFinanceDecisionDraft(
    form: HTMLFormElement | null,
    draftDecision: string,
    scopeKey: string,
  ): FinanceDecisionDraft {
    const currentDraft = readLifecycleStage(scopeKey, "financeDecision");
    const notes = form
      ? readFormFieldValue(form, "notes")
      : currentDraft?.notesByDecision?.[draftDecision];

    return {
      savedAt: new Date().toISOString(),
      notesByDecision: {
        ...currentDraft?.notesByDecision,
        [draftDecision]: notes ?? "",
      },
    };
  }

  if (!isReady) {
    return null;
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-3"
      onSubmit={() => clearDraft()}
    >
      <input type="hidden" name="decision" value={decision} />
      <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />
      <Textarea
        name="notes"
        placeholder={notesPlaceholder}
        defaultValue={restoredDraft?.notesByDecision?.[decision] ?? ""}
      />
      <Button type="submit" variant={variant} size="sm">
        {decision === "approve" ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        {label}
      </Button>
    </form>
  );
}
