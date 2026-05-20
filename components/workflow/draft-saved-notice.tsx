export function DraftSavedNotice({
  savedAtLabel,
  saveError,
}: {
  savedAtLabel: string | null;
  saveError: string | null;
}) {
  return (
    <>
      {savedAtLabel ? (
        <p className="text-xs text-[color:var(--color-muted)]">Draft saved at {savedAtLabel}.</p>
      ) : null}
      {saveError ? (
        <p className="text-xs text-[color:var(--color-danger-text)]" role="alert">
          {saveError}
        </p>
      ) : null}
    </>
  );
}
