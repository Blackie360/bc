export const bcFormTabs = ["details", "links", "metrics"] as const;

export type BcFormTab = (typeof bcFormTabs)[number];

export function validateVisibleTabPanel(form: HTMLFormElement | null) {
  const panel = form?.querySelector('[role="tabpanel"]:not([hidden])');

  if (!panel) {
    return true;
  }

  const fields = panel.querySelectorAll("input, select, textarea");

  for (const field of fields) {
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    ) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
  }

  return true;
}
