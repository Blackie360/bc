export const salesOperationsSubsidyThresholdUsd = 3000;

export function shouldRouteSubsidyToSalesOperations(subsidyUsd: number) {
  return Number.isFinite(subsidyUsd) && subsidyUsd < salesOperationsSubsidyThresholdUsd;
}
