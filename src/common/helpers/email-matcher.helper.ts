export const emailMatcher = (email: string) => ({
  $regex: `^${email
    .toLowerCase()
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
  $options: 'i',
});
