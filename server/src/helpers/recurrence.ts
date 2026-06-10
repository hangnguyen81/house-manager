export function nextDueDate(from: string | undefined, recurrence: string): string {
  const base = from ? new Date(from) : new Date();
  switch (recurrence) {
    case 'daily':
      base.setDate(base.getDate() + 1);
      break;
    case 'weekly':
      base.setDate(base.getDate() + 7);
      break;
    case 'monthly':
      base.setMonth(base.getMonth() + 1);
      break;
  }
  return base.toISOString().slice(0, 10);
}
