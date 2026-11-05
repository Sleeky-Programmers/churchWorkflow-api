/**
 * Escapes user input so it is matched literally inside a RegExp. Without
 * this, a search like "a.*(" either matches everything, throws, or (with
 * nested quantifiers) can make MongoDB backtrack for a long time.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive, literal "contains" match for a search box value. */
export function searchRegex(value: string, maxLength = 100) {
  return {
    $regex: escapeRegex(String(value ?? '').trim().slice(0, maxLength)),
    $options: 'i',
  };
}
