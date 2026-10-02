// Deployment URLs must never silently become the canonical search origin.
export function siteOrigin() {
  const value = process.env.CHRONO_SITE_ORIGIN || 'https://chrono-compass.app';
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('CHRONO_SITE_ORIGIN must be an HTTP(S) origin without a path, credentials, query or fragment');
  }
  return url.origin;
}
