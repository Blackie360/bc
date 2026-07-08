export function DraftSavedNotice({
  savedAtLabel,
  saveError,
}: {
  savedAtLabel: string | null;
  saveError: string | null;
}) {
  if (!savedAtLabel && !saveError) {
    return null;
  }

  return (
    <p className="sr-only" role="status" aria-live="polite">
      {saveError ?? `Draft saved at ${savedAtLabel}.`}
    </p>
  );
}
