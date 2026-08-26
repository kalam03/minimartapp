import { environment } from '../../environments/environment';

// Product images are stored on the API server (wwwroot/Products/xyz.png) and the DB only holds
// the relative path ("/Products/PRD00000066.png"). Rendered directly as an <img src>, a relative
// path like that resolves against *this Angular app's* origin, not the API's, so it never loads.
// environment.baseUrl is "http://host:port/api" (or the runtime config.json override — see
// AppConfigService), so stripping the trailing "/api" gives the API's origin to prepend.
// Already-absolute URLs (http:// or https://) are left alone. Same helper as
// minimartstore/src/app/shared/media-url.ts — kept as a separate copy since the two apps don't
// share a build/package boundary.
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = environment.baseUrl.replace(/\/api\/?$/, '');
  return origin + (path.startsWith('/') ? path : `/${path}`);
}
