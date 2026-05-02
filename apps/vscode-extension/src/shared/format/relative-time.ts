export function formatRelativeTime(value: string | null) {
  if (!value) {
    return 'unknown';
  }

  const updatedAt = Date.parse(value);
  if (Number.isNaN(updatedAt)) {
    return 'unknown';
  }

  const ageMs = Math.max(0, Date.now() - updatedAt);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (ageMs < minuteMs) {
    return 'now';
  }

  if (ageMs < hourMs) {
    return `${Math.floor(ageMs / minuteMs)}min ago`;
  }

  if (ageMs < dayMs) {
    return `${Math.floor(ageMs / hourMs)}h ago`;
  }

  if (ageMs < monthMs) {
    return `${Math.floor(ageMs / dayMs)}d ago`;
  }

  if (ageMs < yearMs) {
    const months = Math.floor(ageMs / monthMs);
    return `${months}month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.floor(ageMs / yearMs);
  return `${years}year${years === 1 ? '' : 's'} ago`;
}
