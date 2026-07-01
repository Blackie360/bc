import { capacityMbpsNumber } from "@/lib/capacity";
import { isThirdPartyLink } from "@/lib/projects-types";
import { bcTemplatePolicy } from "@/lib/bc/template-policy";
import type { LinkRowState, OtherExpenseRowState } from "@/lib/bc/prepared-bc-rows";

export function numberOrZero(value?: string) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function nrcTotalFromParts(parts: {
  newBuildCost?: string;
  provisioningCost?: string;
  materialCost?: string;
  wayleaveCost?: string;
}) {
  return (
    numberOrZero(parts.newBuildCost) +
    numberOrZero(parts.provisioningCost) +
    numberOrZero(parts.materialCost) +
    numberOrZero(parts.wayleaveCost)
  );
}

export function formatMetricInput(value: number, decimalPlaces = 2) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return String(Number(value.toFixed(decimalPlaces)));
}

export function formatMetricDisplay(value: number, decimalPlaces = 2) {
  if (!Number.isFinite(value)) {
    return "Not recoverable";
  }

  return Number(value.toFixed(decimalPlaces)).toLocaleString("en-US");
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

export function calculateExcelTemplateMetrics({
  rows,
  otherExpenseRows,
  contractTermMonths,
  exchangeRateKesUsd,
}: {
  rows: LinkRowState[];
  otherExpenseRows: OtherExpenseRowState[];
  contractTermMonths: number;
  exchangeRateKesUsd: number;
}) {
  const monthlyMrr = rows.reduce((total, row) => total + numberOrZero(row.mrr), 0);
  const monthlyMrc = rows.reduce((total, row) => total + numberOrZero(row.mrc), 0);
  const clientNrr = rows.reduce((total, row) => total + numberOrZero(row.nrr), 0);
  const nrc = rows.reduce(
    (total, row) =>
      total +
      nrcTotalFromParts({
        newBuildCost: row.newBuildCost,
        provisioningCost: row.provisioningCost,
        materialCost: row.materialCost,
        wayleaveCost: row.wayleaveCost,
      }),
    0,
  );
  const capacityMbps = rows.reduce((total, row) => {
    const capacity = isThirdPartyLink(row.onnetOffnet) ? row.offnetCapacity : row.onnetCapacity;
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
  const monthlyOtherExpenses = otherExpenseRows.reduce(
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

export function buildBcTemplateGuidanceDownload(
  metrics: ReturnType<typeof calculateExcelTemplateMetrics>,
) {
  const lines = [
    "Ordinary BC Template Guidance",
    "",
    "Fields to capture:",
    "- Customer Name, Account Number, Opportunity Number, Account Manager",
    "- Solution Architecture, Engineering, Contract Term, Project Executive Summary",
    "- Per link: Link Name, Service, Technology, Onnet/3rd Party, NRC, MRC, MRR, NRR, Capacity",
    "- Attachments: LSO, BC template Excel, PBOQ/actual surveys, supplier quotes for 3rd Party links",
    "",
    "Template calculations:",
    `NRR (USD): ${formatMetricDisplay(metrics.clientNrr)}`,
    `NRC (USD): ${formatMetricDisplay(metrics.nrc)}`,
    `LIT upfront investment (USD): ${formatMetricDisplay(metrics.litInvestment)}`,
    `TCV (USD): ${formatMetricDisplay(metrics.tcv)}`,
    `Payback: ${formatMetricDisplay(metrics.paybackMonths)} months`,
    `IRR: ${formatMetricDisplay(metrics.irr)}%`,
    `NRV (USD): ${formatMetricDisplay(metrics.nrv)}`,
    "",
    "Guidance:",
    `Guidance 1: ${metrics.guidance1}`,
    `Guidance 2: ${metrics.guidance2}`,
  ];

  if (metrics.requiresSubsidyDisclosure) {
    lines.push(
      "",
      "LSO subsidy wording:",
      "By signing this Service Order Form, you acknowledge that:",
      `1. The installation charge has been discounted by an amount of KES ${formatMetricDisplay(metrics.subsidyKes, 0)}.`,
      "2. The discount is on condition that you will not downgrade and/or terminate the Order before expiry of the Contract Term.",
      "3. The discount amount shall be payable to Liquid immediately upon any such downgrade and/or early termination.",
    );
  }

  return lines.join("\n");
}
