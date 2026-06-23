"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DraftSavedNotice } from "@/components/workflow/draft-saved-notice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormLifecycleDraft } from "@/hooks/use-form-lifecycle-draft";
import {
  readFormFieldValue,
  readLifecycleStage,
  type FinanceDecisionDraft,
} from "@/lib/project-lifecycle-storage";

type FinanceDecision = "approve" | "reject" | "escalate-cfo" | "question-architect";

const financeDecisionOptions = [
  {
    value: "escalate-cfo",
    label: "Escalate",
    description: "Escalations move to the CFO queue for executive review.",
    notesLabel: "Escalation reason",
    notesPlaceholder: "Explain why CFO escalation is needed.",
  },
  {
    value: "question-architect",
    label: "Redirect with a question",
    description: "Redirects the project to Solutions Architecture for clarification.",
    notesLabel: "Question for Solutions Architecture",
    notesPlaceholder: "Write the question for Solutions Architecture.",
  },
  {
    value: "approve",
    label: "Approve",
    description: "Approved cases move to the Sales Operations validation queue.",
    notesLabel: "Approval reason",
    notesPlaceholder: "Explain why Finance approved this project.",
  },
  {
    value: "reject",
    label: "Reject",
    description: "Rejected cases remain in the current Finance queue for follow-up.",
    notesLabel: "Rejection reason",
    notesPlaceholder: "Explain why Finance rejected this project.",
  },
] satisfies Array<{
  value: FinanceDecision;
  label: string;
  description: string;
  notesLabel: string;
  notesPlaceholder: string;
}>;

export function FinanceDecisionForm({
  action,
  projectId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  projectId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedDecision, setSelectedDecision] = useState<FinanceDecision>("escalate-cfo");
  const [notesByDecision, setNotesByDecision] = useState<Record<string, string>>({});
  const { isReady, savedAtLabel, saveError, restoredDraft, clearDraft, bindFormAutoSave } =
    useFormLifecycleDraft({
      scopeKey: projectId,
      stage: "financeDecision",
      buildDraft: () => buildFinanceDecisionDraft(formRef.current, selectedDecision, projectId),
      deps: [projectId, selectedDecision],
    });
  const selectedOption =
    financeDecisionOptions.find((option) => option.value === selectedDecision) ??
    financeDecisionOptions[0];
  const restoredNotesByDecision = restoredDraft?.notesByDecision ?? {};
  const selectedNotes =
    notesByDecision[selectedDecision] ?? restoredNotesByDecision[selectedDecision] ?? "";
  const submitVariant = selectedDecision === "approve" ? "default" : "warning";

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
      : notesByDecision[draftDecision] ??
        restoredNotesByDecision[draftDecision] ??
        currentDraft?.notesByDecision?.[draftDecision];

    return {
      savedAt: new Date().toISOString(),
      notesByDecision: {
        ...currentDraft?.notesByDecision,
        ...restoredNotesByDecision,
        ...notesByDecision,
        [draftDecision]: notes ?? "",
      },
    };
  }

  function handleDecisionChange(value: string) {
    const nextDecision = value as FinanceDecision;
    const currentNotes = formRef.current
      ? readFormFieldValue(formRef.current, "notes")
      : notesByDecision[selectedDecision] ?? "";

    setNotesByDecision((current) => ({
      ...current,
      [selectedDecision]: currentNotes,
      [nextDecision]: current[nextDecision] ?? restoredNotesByDecision[nextDecision] ?? "",
    }));
    setSelectedDecision(nextDecision);
  }

  function handleNotesChange(value: string) {
    setNotesByDecision((current) => ({
      ...current,
      [selectedDecision]: value,
    }));
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
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--color-primary)]">
          BC Analyst Decision
        </h3>
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
          {selectedOption.description}
        </p>
      </div>
      <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />
      <label className="grid gap-2 text-xs font-medium text-[color:var(--color-muted-strong)]">
        <span>Decision</span>
        <Select
          name="decision"
          value={selectedDecision}
          onChange={(event) => handleDecisionChange(event.currentTarget.value)}
          required
        >
          {financeDecisionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-2 text-xs font-medium text-[color:var(--color-muted-strong)]">
        <span>{selectedOption.notesLabel}</span>
        <Textarea
          key={selectedDecision}
          name="notes"
          placeholder={selectedOption.notesPlaceholder}
          value={selectedNotes}
          onChange={(event) => handleNotesChange(event.currentTarget.value)}
          minLength={3}
          required
        />
      </label>
      <Button type="submit" variant={submitVariant} size="sm">
        {selectedDecision === "approve" ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        {selectedOption.label}
      </Button>
    </form>
  );
}
