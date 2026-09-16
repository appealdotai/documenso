import { formatPath } from '@documenso/lib/constants/app';
import { getAppBrandConfig } from '@documenso/lib/constants/brand';
import { PREFERRED_TEAM_URL_COOKIE } from '@documenso/lib/constants/cookies';
import { AppDebugger } from '@documenso/lib/utils/debugger';
import type { Context, Next } from 'hono';
import { setCookie } from 'hono/cookie';

import { handleRedirects } from './redirects';

const debug = new AppDebugger('Middleware');

/**
 * Middleware for initial page loads.
 *
 * You won't be able to easily handle sequential page loads because they will be
 * called under `path.data`
 *
 * Example an initial page load would be `/documents` then if the user click templates
 * the path here would be `/templates.data`.
 */
export const appMiddleware = async (c: Context, next: Next) => {
  const { req } = c;
  const { path } = req;

  if (path.startsWith('/.well-known/appspecific/')) {
    return c.body(null, 404);
  }

  const brandConfig = getAppBrandConfig();
  const legacyAssetRedirects: Record<string, string> = {
    '/site.webmanifest': brandConfig.manifestPath,
    '/favicon.ico': `${brandConfig.assetPath}/favicon.ico`,
    '/favicon-16x16.png': `${brandConfig.assetPath}/favicon-16x16.png`,
    '/favicon-32x32.png': `${brandConfig.assetPath}/favicon-32x32.png`,
    '/apple-touch-icon.png': `${brandConfig.assetPath}/apple-touch-icon.png`,
  };

  const legacyAssetPath = legacyAssetRedirects[path];

  if (legacyAssetPath) {
    return c.redirect(formatPath(legacyAssetPath), 308);
  }

  // Paths to ignore.
  if (nonPagePathRegex.test(path)) {
    return next();
  }

  // PRE-HANDLER CODE: Place code here to execute BEFORE the route handler runs.
  const redirectPath = handleRedirects(c);

  if (redirectPath) {
    debug.log('Redirecting from', path);
    debug.log('Redirecting to', redirectPath);

    return c.redirect(redirectPath);
  }

  await next();

  // POST-HANDLER CODE: Place code here to execute AFTER the route handler completes.
  // This is useful for:
  // - Setting cookies
  // - Any operations that should happen after all route handlers but before sending the response

  debug.log('Path', path);

  const pathname = path.replace('.data', '');

  // Set the preferred team url cookie if user accesses a team page.
  if (pathname.startsWith('/t/')) {
    debug.log('Setting preferred team url cookie');

    setCookie(c, PREFERRED_TEAM_URL_COOKIE, pathname.split('/')[2], {
      sameSite: 'lax',
    });

    return;
  }
};

// This regex matches any path that:
// 1. Starts with /api/, /ingest/, /__manifest/, or /assets/
// 2. Starts with /apple- (like /apple-touch-icon.png)
// 3. Starts with /favicon (like /favicon.ico)
// The ^ ensures matching from the beginning of the string
// The | acts as OR operator between different patterns
const nonPagePathRegex = /^(\/api\/|\/ingest\/|\/__manifest|\/assets\/|\/apple-.*|\/favicon.*|\/branding\/)/;
