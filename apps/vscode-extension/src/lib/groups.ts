type LabelGroup<T> = {
  label: string;
  items: T[];
};

export function createOrderedGroups<T>(
  items: T[],
  labels: string[],
  getLabel: (item: T) => string,
): LabelGroup<T>[] {
  return labels
    .map((label) => ({
      label,
      items: items.filter((item) => getLabel(item) === label),
    }))
    .filter((group) => group.items.length > 0);
}
