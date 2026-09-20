import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'data-templates/**', 'docs/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // D-079. Postgres `numeric` arrives over PostgREST as a string. Coercing it
      // to a JS float drifts at the fourth decimal, and the cost breakdown
      // displays six. Parse through decimal.js instead: see src/lib/decimal.ts.
      //
      // The `Numeric` type already excludes `number`, so this rule exists to
      // catch the coercion happening before a value ever reaches that type.
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message: 'Banned by D-079. Use toDecimal() from @/lib/decimal.',
        },
        {
          name: 'parseInt',
          message: 'Banned by D-079. Use toDecimal() or fromInteger() from @/lib/decimal.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="Number"]',
          message: 'Banned by D-079. Use toDecimal() or fromInteger() from @/lib/decimal.',
        },
        {
          // The bare globals are caught by no-restricted-globals above, but
          // Number.parseFloat is a member expression and slipped straight
          // through it. Found by writing one myself.
          selector:
            'MemberExpression[object.name="Number"][property.name=/^(parseFloat|parseInt)$/]',
          message: 'Banned by D-079. Use toDecimal() or fromInteger() from @/lib/decimal.',
        },
      ],
    },
  },
  {
    // The money type is the one place allowed to reach for BigInt and to do the
    // rounding the rest of the codebase must not.
    files: ['src/lib/decimal.ts', 'src/lib/money.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];

export default config;
