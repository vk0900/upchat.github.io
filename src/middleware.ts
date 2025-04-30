import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
// Removed: import db from '@/lib/db'; - Cannot use Node.js APIs like 'better-sqlite3' in Edge Runtime

// Simplified check: In Edge Runtime, just check if the session cookie exists.
// Actual validation against the database will happen in Server Components/Actions/API routes.
async function hasSessionCookie(request: NextRequest): Promise<boolean> {
    const sessionId = request.cookies.get('session_id')?.value;
    return !!sessionId; // Returns true if the cookie exists, false otherwise
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public paths that don't require authentication
  // Added /api/auth/login for the login action itself.
  const publicPaths = ['/login', '/api/auth/login'];

  // Check if the current path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Check if session cookie exists (basic check for Edge Runtime)
  const isAuthenticated = await hasSessionCookie(request);
   // console.log(`Middleware: Path=${pathname}, IsPublic=${isPublicPath}, IsAuthHint=${isAuthenticated}`);


  // If trying to access a protected route without a session cookie, redirect to login
  if (!isAuthenticated && !isPublicPath) {
    console.log(`Middleware: Redirecting user without session cookie from ${pathname} to /login`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access the login page *with* a session cookie, redirect to dashboard
  // Note: The session might be invalid, but backend routes will handle final verification.
  if (isAuthenticated && pathname === '/login') {
     console.log(`Middleware: Redirecting user with session cookie from /login to /dashboard`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Allow the request to proceed
  // console.log(`Middleware: Allowing access to ${pathname}`);
  return NextResponse.next();
}

// Specify the paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /api/files/ (allow file serving route, its own auth check applies)
     * - /api/auth/login (allow login action)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/files/|api/auth/login).*)',
     // Explicitly include /login to handle redirecting authenticated users
    '/login',
  ],
};
