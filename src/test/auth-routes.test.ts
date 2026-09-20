import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_PATHS, isPublicPath, safeRedirectPath } from '@/lib/auth-routes';

const APP_DIR = join(process.cwd(), 'src', 'app');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      acc.push(full);
      walk(full, acc);
    }
  }
  return acc;
}

describe('there is no public sign-up route', () => {
  // S1's done-when says it plainly. This is a private system: accounts are
  // created by the owner, and the sign-in screen says so in as many words.
  it('has no route directory that offers one', () => {
    const offenders = walk(APP_DIR)
      .map((d) => d.slice(APP_DIR.length))
      .filter((d) => /sign-?up|register|create-account|join/i.test(d));
    expect(offenders).toEqual([]);
  });

  it('does not list one as public', () => {
    const offenders = PUBLIC_PATHS.filter((p) => /sign-?up|register|create-account|join/i.test(p));
    expect(offenders).toEqual([]);
  });

  it('never calls supabase signUp anywhere in the source', () => {
    const files: string[] = [];
    const collect = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full);
        else if (/\.tsx?$/.test(entry)) files.push(full);
      }
    };
    collect(join(process.cwd(), 'src'));

    const offenders = files.filter((f) => /auth\s*\.\s*signUp\s*\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('public paths', () => {
  it('covers exactly the four screens a signed-out visitor needs', () => {
    expect([...PUBLIC_PATHS]).toEqual([
      '/sign-in',
      '/forgot-password',
      '/reset-password',
      '/auth/callback',
    ]);
  });

  it('treats everything else as private', () => {
    for (const path of [
      '/',
      '/dashboard',
      '/items',
      '/items/new',
      '/settings/people',
      '/permission-denied',
    ]) {
      expect(isPublicPath(path), `${path} should be private`).toBe(false);
    }
  });

  it('matches a public path and its children', () => {
    expect(isPublicPath('/sign-in')).toBe(true);
    expect(isPublicPath('/auth/callback')).toBe(true);
    expect(isPublicPath('/auth/callback/extra')).toBe(true);
  });

  it('does not let a lookalike through', () => {
    expect(isPublicPath('/sign-in-please')).toBe(false);
    expect(isPublicPath('/x/sign-in')).toBe(false);
  });
});

describe('the ?next= parameter cannot be used as an open redirect', () => {
  it('keeps a genuine in-app path', () => {
    expect(safeRedirectPath('/items')).toBe('/items');
    expect(safeRedirectPath('/products/abc?tab=cost')).toBe('/products/abc?tab=cost');
  });

  it('refuses anything that leaves the site', () => {
    for (const hostile of [
      '//evil.example',
      '//evil.example/steal',
      'https://evil.example',
      'http://evil.example',
      'evil.example',
      '/\\evil.example',
      '/items\\..\\..',
      '',
      null,
      undefined,
    ]) {
      expect(safeRedirectPath(hostile), `${String(hostile)} should be refused`).toBe('/dashboard');
    }
  });
});

describe('every route under the app group is behind the layout guard', () => {
  it('has a layout that checks for a user', () => {
    const layout = readFileSync(join(APP_DIR, '(app)', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/getUser\(\)/);
    expect(layout).toMatch(/redirect\('\/sign-in'\)/);
  });

  it('marks the recovery session before letting it near the app', () => {
    const callback = readFileSync(join(APP_DIR, 'auth', 'callback', 'route.ts'), 'utf8');
    expect(callback).toMatch(/RECOVERY_COOKIE/);
    expect(callback).toMatch(/reset-password/);
  });
});
