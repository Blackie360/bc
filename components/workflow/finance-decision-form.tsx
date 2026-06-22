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

type FinanceDecision = "approve" | "reject" | "escalate-cfo" | "escalate-ceo" | "question-architect";

export function FinanceDecisionForm({
  action,
  description,
  decision,
  label,
  notesLabel,
  notesPlaceholder,
  variant = "secondary",
  projectId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  description: string;
  decision: FinanceDecision;
  label: string;
  notesLabel: string;
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
      className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-4"
      onSubmit={() => clearDraft()}
    >
      <input type="hidden" name="decision" value={decision} />
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--color-primary)]">{label}</h3>
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">{description}</p>
      </div>
      <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />
      <label className="grid gap-2 text-xs font-medium text-[color:var(--color-muted-strong)]">
        <span>{notesLabel}</span>
        <Textarea
          name="notes"
          placeholder={notesPlaceholder}
          defaultValue={restoredDraft?.notesByDecision?.[decision] ?? ""}
          minLength={3}
          required
        />
      </label>
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
