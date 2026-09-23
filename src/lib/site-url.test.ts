import { describe, expect, it } from 'vitest';
import { siteUrl } from './site-url';

describe('siteUrl', () => {
  it('uses the configured production origin and removes its trailing slash', () => {
    expect(siteUrl('https://costed.example/', 'preview.vercel.app')).toBe('https://costed.example');
  });

  it('uses the current Vercel deployment for previews', () => {
    expect(siteUrl(undefined, 'costed-preview.vercel.app')).toBe(
      'https://costed-preview.vercel.app',
    );
  });

  it('uses localhost outside a deployment', () => {
    expect(siteUrl(undefined, undefined)).toBe('http://localhost:3000');
  });
});
