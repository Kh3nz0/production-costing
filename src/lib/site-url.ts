/**
 * Public origin used in links that leave the browser, such as password-recovery
 * emails. Production gets an explicit stable URL; a Vercel preview uses that
 * deployment's generated URL; local development keeps localhost.
 */
export function siteUrl(
  configured = process.env.NEXT_PUBLIC_SITE_URL,
  vercelDeployment = process.env.VERCEL_URL,
): string {
  const value =
    configured?.trim() ||
    (vercelDeployment?.trim() ? `https://${vercelDeployment.trim()}` : 'http://localhost:3000');

  return value.replace(/\/+$/, '');
}
