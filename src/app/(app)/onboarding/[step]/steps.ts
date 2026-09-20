/**
 * The six steps, in their own module because a Next page may only export a
 * fixed set of names and `STEPS` is not one of them.
 */
export const STEPS = [
  { slug: 'business', title: 'Your business', of: 1 },
  { slug: 'electricity', title: 'Electricity rate', of: 2 },
  { slug: 'equipment', title: 'Your equipment', of: 3 },
  { slug: 'labour', title: 'What your time is worth', of: 4 },
  { slug: 'overhead', title: 'Monthly running costs', of: 5 },
  { slug: 'channels', title: 'Where you sell', of: 6 },
] as const;
