export const emailMatcher = (email: string) => {
  return {
    $regex: `^${email
      .toLowerCase()
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    $options: 'i',
  };
};
