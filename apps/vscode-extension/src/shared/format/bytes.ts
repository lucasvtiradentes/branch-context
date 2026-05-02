export function formatBytes(value: number, fractionDigits = 1) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${formatNumber(value / 1024, fractionDigits)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value: number, fractionDigits: number) {
  return fractionDigits === 0 ? String(Math.round(value)) : value.toFixed(fractionDigits);
}
