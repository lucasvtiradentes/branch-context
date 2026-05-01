type DateGroup<T> = {
  label: string;
  items: T[];
};

type IndexedDateGroup<T> = DateGroup<T> & {
  sortValue: number;
};

export function groupByDate<T>(
  items: T[],
  getTimestamp: (item: T) => string | null | undefined,
): DateGroup<T>[] {
  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const groups = new Map<string, IndexedDateGroup<T>>();

  for (const item of items) {
    const date = parseDate(getTimestamp(item));
    const dateGroup = date ? getDateGroup(date, today, yesterday) : null;
    const label = dateGroup?.label ?? 'unknown';
    const sortValue = dateGroup?.sortValue ?? Number.NEGATIVE_INFINITY;
    const existingGroup = groups.get(label);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.set(label, { label, items: [item], sortValue });
    }
  }

  return Array.from(groups.values())
    .sort(
      (left, right) => right.sortValue - left.sortValue || left.label.localeCompare(right.label),
    )
    .map(({ label, items }) => ({ label, items }));
}

function getDateGroup(date: Date, today: Date, yesterday: Date) {
  const day = startOfLocalDay(date);
  if (day.getTime() === today.getTime()) {
    return { label: 'today', sortValue: Number.POSITIVE_INFINITY };
  }

  if (day.getTime() === yesterday.getTime()) {
    return { label: 'yesterday', sortValue: Number.MAX_SAFE_INTEGER };
  }

  return { label: formatLocalDate(day), sortValue: day.getTime() };
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatLocalDate(date: Date) {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
