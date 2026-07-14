export function normalizeKey(value?: string) {
  return (value || '').trim().toUpperCase();
}

export function parseOptionalDate(value?: string): Date | null {
  const normalized = (value || '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function parseBoolean(value?: string): boolean | null {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return null;
  }

  if (['TRUE', 'YES', '1'].includes(normalized)) {
    return true;
  }
  if (['FALSE', 'NO', '0'].includes(normalized)) {
    return false;
  }

  return null;
}

export function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase();
}

export function normalizeDateKey(value?: Date | string | null): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
}
