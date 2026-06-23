const mbpsUnits = new Set([
  "m",
  "mb",
  "mbit",
  "mbits",
  "mbps",
  "mb/s",
  "mps",
]);

const gbpsUnits = new Set([
  "g",
  "gb",
  "gbit",
  "gbits",
  "gbps",
  "gb/s",
  "gps",
]);

const kbpsUnits = new Set([
  "k",
  "kb",
  "kbit",
  "kbits",
  "kbps",
  "kb/s",
  "kps",
]);

function formatCapacityMbps(value: number) {
  return Number(value.toFixed(6)).toString();
}

function capacityMbpsValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = value.replaceAll(",", "").trim().match(/^(\d+(?:\.\d+)?)\s*([a-z/]+)?$/i);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  const unit = match[2]?.toLowerCase() ?? "mbps";
  if (mbpsUnits.has(unit)) {
    return numericValue;
  }

  if (gbpsUnits.has(unit)) {
    return numericValue * 1000;
  }

  if (kbpsUnits.has(unit)) {
    return numericValue / 1000;
  }

  return null;
}

export function capacityMbpsInputValue(value?: string | null) {
  const capacity = capacityMbpsValue(value);

  return capacity == null ? "" : formatCapacityMbps(capacity);
}

export function capacityMbpsNumber(value?: string | null) {
  return capacityMbpsValue(value) ?? 0;
}

export function normalizeCapacityMbpsInput(value?: string | null) {
  const capacity = capacityMbpsValue(value);

  return capacity == null ? null : `${formatCapacityMbps(capacity)} Mbps`;
}
