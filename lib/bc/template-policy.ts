export const bcTemplateGuidanceFileName = "ordinary-bc-template-guidance.txt";

export const bcTemplatePolicy = {
  costOfCapital: 0.143,
  salesCommissionRate: 0.05,
  adminExpenseRate: 0.03,
  networkOpexRate: 0.05,
  licenseFeeRate: 0.01,
  minimumTaxRate: 0,
  taxRate: 0.3,
  capacityCostPerMbps: 1.4,
  depreciationYears: 8,
  guidedIrrPercent: 22,
  subsidyDisclosureThresholdUsd: 300,
  litInvestmentThresholdUsd: 5000,
  subsidyMultiple: 3,
  autoProceedPaybackMonths: 6,
  defaultExchangeRateKesUsd: 130,
} as const;
