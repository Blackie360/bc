import { toast } from "sonner";

export function notifyDraftSaved(savedAtLabel: string) {
  toast.success("Draft saved", {
    id: "lifecycle-draft-saved",
    description: savedAtLabel,
  });
}

export function notifyDraftSaveError(message = "Your changes are still in the form, but autosave failed.") {
  toast.error("Draft could not be saved", {
    id: "lifecycle-draft-error",
    description: message,
  });
}

export function notifyFormValidationError(
  title = "Complete required fields",
  description = "Fill in all required fields before continuing.",
) {
  toast.error(title, { description });
}

export function notifyDraftRestored(savedAtLabel: string) {
  toast.info("Draft restored", {
    id: "lifecycle-draft-restored",
    description: `Continuing from ${savedAtLabel}.`,
  });
}
