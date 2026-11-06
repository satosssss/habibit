import { auth } from '@/auth';

/**
 * Accounts spec R1: every page needs a session. The `authorized` callback in
 * src/auth.ts decides; NextAuth handles the redirect to `/login` and keeps the
 * original path as `callbackUrl`.
 *
 * Matcher skips Next internals and every static file (anything with a dot), so
 * the service worker, manifest, icons and fonts resolve before login.
 */
export default auth;

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
