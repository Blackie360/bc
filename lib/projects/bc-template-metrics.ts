import { capacityMbpsNumber } from "@/lib/capacity";

type NumericInput = number | string | null | undefined;

export type BcTemplateLinkMetricsInput = {
  mrr?: NumericInput;
  mrc?: NumericInput;
  nrr?: NumericInput;
  newBuildCost?: NumericInput;
  provisioningCost?: NumericInput;
  materialCost?: NumericInput;
  wayleaveCost?: NumericInput;
  onnetOffnet?: string | null;
  onnetCapacity?: string | null;
  offnetCapacity?: string | null;
};

export type BcTemplateOtherExpenseInput = {
  monthlyCost?: NumericInput;
};

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

function numberOrZero(value?: NumericInput) {
  if (value == null || value === "") {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateIrrRate(cashFlows: number[]) {
  if (cashFlows.length < 2 || cashFlows.every((cashFlow) => cashFlow >= 0)) {
    return 0;
  }

  const npv = (rate: number) =>
    cashFlows.reduce((sum, cashFlow, period) => sum + cashFlow / (1 + rate) ** period, 0);
  let low = -0.9999;
  let high = 10;
  let mid = 0;

  for (let index = 0; index < 1000; index += 1) {
    mid = (low + high) / 2;
    const lowNpv = npv(low);
    const midNpv = npv(mid);

    if (Math.abs(midNpv) < 1e-7) {
      break;
    }

    if (lowNpv * midNpv < 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return mid;
}

function nrcTotalFromParts(parts: {
  newBuildCost?: NumericInput;
  provisioningCost?: NumericInput;
  materialCost?: NumericInput;
  wayleaveCost?: NumericInput;
}) {
  return (
    numberOrZero(parts.newBuildCost) +
    numberOrZero(parts.provisioningCost) +
    numberOrZero(parts.materialCost) +
    numberOrZero(parts.wayleaveCost)
  );
}

export function calculateBcTemplateMetrics({
  links,
  otherExpenses,
  contractTermMonths,
  exchangeRateKesUsd,
}: {
  links: BcTemplateLinkMetricsInput[];
  otherExpenses: BcTemplateOtherExpenseInput[];
  contractTermMonths: number;
  exchangeRateKesUsd: number;
}) {
  const monthlyMrr = links.reduce((total, link) => total + numberOrZero(link.mrr), 0);
  const monthlyMrc = links.reduce((total, link) => total + numberOrZero(link.mrc), 0);
  const clientNrr = links.reduce((total, link) => total + numberOrZero(link.nrr), 0);
  const nrc = links.reduce(
    (total, link) =>
      total +
      nrcTotalFromParts({
        newBuildCost: link.newBuildCost,
        provisioningCost: link.provisioningCost,
        materialCost: link.materialCost,
        wayleaveCost: link.wayleaveCost,
      }),
    0,
  );
  const capacityMbps = links.reduce((total, link) => {
    const capacity = link.onnetOffnet === "3rd Party" ? link.offnetCapacity : link.onnetCapacity;
    return total + capacityMbpsNumber(capacity);
  }, 0);
  const litInvestment = nrc - clientNrr;
  const monthlyRevenue = monthlyMrr;
  const monthlyCapacityCost =
    capacityMbps * bcTemplatePolicy.capacityCostPerMbps + monthlyMrc;
  const monthlySalesCommission = monthlyRevenue * bcTemplatePolicy.salesCommissionRate;
  const monthlyCogs = monthlyCapacityCost + monthlySalesCommission;
  const monthlyGrossMargin = monthlyRevenue - monthlyCogs;
  const monthlyAdminExpenses = monthlyRevenue * bcTemplatePolicy.adminExpenseRate;
  const monthlyNetworkOpex = monthlyRevenue * bcTemplatePolicy.networkOpexRate;
  const monthlyLicenseFee = monthlyRevenue * bcTemplatePolicy.licenseFeeRate;
  const monthlyMinimumTax = monthlyRevenue * bcTemplatePolicy.minimumTaxRate;
  const monthlyOtherExpenses = otherExpenses.reduce(
    (total, expense) => total + numberOrZero(expense.monthlyCost),
    0,
  );
  const monthlyEbitda =
    monthlyGrossMargin -
    monthlyNetworkOpex -
    monthlyAdminExpenses -
    monthlyLicenseFee -
    monthlyMinimumTax -
    monthlyOtherExpenses;
  const monthlyDepreciation =
    litInvestment > 0
      ? litInvestment / (bcTemplatePolicy.depreciationYears * 12)
      : 0;
  const monthlyEbt = monthlyEbitda - monthlyDepreciation;
  const monthlyTax = monthlyEbt < 0 ? 0 : -bcTemplatePolicy.taxRate * monthlyEbt;
  const monthlyPat = monthlyEbt + monthlyTax;
  const monthlyFreeCashFlow = monthlyPat + monthlyDepreciation - monthlyTax;
  const initialFreeCashFlow = -litInvestment;
  const monthlyDiscountRate = bcTemplatePolicy.costOfCapital / 12;
  const monthlyNpvs = Array.from({ length: contractTermMonths }, (_item, index) => {
    const month = index + 1;
    const discountedCashFlows = Array.from({ length: month }, (_cashFlow, cashFlowIndex) =>
      monthlyFreeCashFlow / (1 + monthlyDiscountRate) ** (cashFlowIndex + 1),
    );

    return initialFreeCashFlow + discountedCashFlows.reduce((total, value) => total + value, 0);
  });
  const negativeMonths = monthlyNpvs.filter((npv) => npv < 0).length;
  const paybackMonths =
    negativeMonths >= contractTermMonths || monthlyFreeCashFlow <= 0
      ? Number.POSITIVE_INFINITY
      : negativeMonths === 0
        ? 0
        : negativeMonths +
          -monthlyNpvs[negativeMonths - 1] / monthlyFreeCashFlow;
  const yearlyCashFlows = [
    initialFreeCashFlow,
    ...Array.from({ length: Math.ceil(contractTermMonths / 12) }, (_item, index) => {
      const monthsInYear = Math.min(12, contractTermMonths - index * 12);
      return monthlyFreeCashFlow * monthsInYear;
    }),
  ];
  const yearlyIrrs = yearlyCashFlows
    .slice(1)
    .map((_cashFlow, index) => calculateIrrRate(yearlyCashFlows.slice(0, index + 2)));
  const irr = Math.max(0, ...yearlyIrrs) * 100;
  const nrv = monthlyNpvs[contractTermMonths - 1] ?? initialFreeCashFlow;
  const tcv = (monthlyMrr - monthlyMrc) * contractTermMonths + clientNrr;
  const firstMonthNpv = monthlyNpvs[0] ?? initialFreeCashFlow;
  const guidance1 =
    firstMonthNpv > 0 ||
    (litInvestment <= bcTemplatePolicy.litInvestmentThresholdUsd &&
      irr >= bcTemplatePolicy.guidedIrrPercent &&
      litInvestment <= monthlyMrr * bcTemplatePolicy.subsidyMultiple &&
      paybackMonths <= bcTemplatePolicy.autoProceedPaybackMonths)
      ? "Proceed"
      : "Seek Finance Approval";
  const requiresSubsidyDisclosure =
    litInvestment > bcTemplatePolicy.subsidyDisclosureThresholdUsd;
  const guidance2 = requiresSubsidyDisclosure
    ? "Disclosure of subsidised amount required"
    : "No subsidy disclosure required";
  const subsidyKes =
    litInvestment > 0 && exchangeRateKesUsd > 0 ? litInvestment * exchangeRateKesUsd : 0;

  return {
    monthlyMrr,
    monthlyMrc,
    clientNrr,
    nrc,
    litInvestment,
    capacityMbps,
    monthlyOtherExpenses,
    monthlyFreeCashFlow,
    firstMonthNpv,
    nrv,
    tcv,
    paybackMonths,
    submittedPaybackMonths: Number.isFinite(paybackMonths)
      ? Math.max(1, Math.ceil(paybackMonths))
      : contractTermMonths + 1,
    irr,
    guidance1,
    guidance2,
    requiresSubsidyDisclosure,
    subsidyKes,
  };
}
