import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Accounts spec R1. The session deliberately carries three profile fields and
 * nothing else: name, email and avatar. Google returns far more (locale, sub,
 * hd, email_verified) and none of it is needed on the client.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.name = profile.name ?? null;
        token.email = profile.email ?? null;
        token.picture = typeof profile.picture === 'string' ? profile.picture : null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.name = typeof token.name === 'string' ? token.name : '';
      session.user.email = typeof token.email === 'string' ? token.email : '';
      session.user.image = typeof token.picture === 'string' ? token.picture : '';
      return session;
    },
    /**
     * Runs for every matched request (see src/middleware.ts). `/api/*` is let
     * through so route handlers can answer with JSON — `/api/recommend` returns
     * 401 itself rather than an HTML redirect the fetcher cannot parse.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith('/api/')) return true;
      if (pathname === '/login') return true;
      return Boolean(auth?.user);
    },
  },
});
