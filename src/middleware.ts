import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getSessionCookie } from 'better-auth/cookies';
import { betterFetch } from '@better-fetch/fetch';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith('/login');
  const isDashboardRoute =
    pathname.startsWith('/employee') ||
    pathname.startsWith('/director') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/profile');

  // 1. Cek sesi Better Auth melalui cookie token jika ada
  const hasBetterAuthCookie = !!getSessionCookie(request);
  let betterAuthUser: any = null;
  let betterAuthRole: string = 'employee';

  if (hasBetterAuthCookie) {
    try {
      const { data: sessionData } = await betterFetch<any>('/api/auth/get-session', {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });
      if (sessionData?.user) {
        betterAuthUser = sessionData.user;
        betterAuthRole = sessionData.user.role || 'employee';
      }
    } catch {}
  }

  // 2. Jika sesi Better Auth aktif, tangani navigasi & proteksi rute
  if (betterAuthUser) {
    if (isAuthRoute) {
      const targetDashboard =
        betterAuthRole === 'director' ? '/director' : betterAuthRole === 'finance' ? '/finance' : '/employee';
      return NextResponse.redirect(new URL(targetDashboard, request.url));
    }

    if (pathname === '/') {
      const targetDashboard =
        betterAuthRole === 'director' ? '/director' : betterAuthRole === 'finance' ? '/finance' : '/employee';
      return NextResponse.redirect(new URL(targetDashboard, request.url));
    }

    if (isDashboardRoute) {
      if (pathname.startsWith('/director') && betterAuthRole !== 'director') {
        const targetDashboard = betterAuthRole === 'finance' ? '/finance' : '/employee';
        return NextResponse.redirect(new URL(targetDashboard, request.url));
      }

      if (pathname.startsWith('/finance') && betterAuthRole !== 'finance') {
        const targetDashboard = betterAuthRole === 'director' ? '/director' : '/employee';
        return NextResponse.redirect(new URL(targetDashboard, request.url));
      }

      if (pathname.startsWith('/employee') && !pathname.startsWith('/employee/new') && betterAuthRole !== 'employee') {
        const targetDashboard = betterAuthRole === 'director' ? '/director' : '/finance';
        return NextResponse.redirect(new URL(targetDashboard, request.url));
      }
    }

    return NextResponse.next();
  }

  // 3. Fallback: Sesi Supabase (untuk akun yang masih aktif dengan sesi lama)
  const { supabaseResponse, user, role } = await updateSession(request);

  // If user is logged in and visits login page, redirect to their role dashboard
  if (user && isAuthRoute) {
    const targetDashboard = role === 'director' ? '/director' : role === 'finance' ? '/finance' : '/employee';
    return NextResponse.redirect(new URL(targetDashboard, request.url));
  }

  // If root page is visited
  if (pathname === '/') {
    if (user) {
      const targetDashboard = role === 'director' ? '/director' : role === 'finance' ? '/finance' : '/employee';
      return NextResponse.redirect(new URL(targetDashboard, request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protected dashboard routes
  if (isDashboardRoute) {
    if (!user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Role-based route guarding
    if (pathname.startsWith('/director') && role !== 'director') {
      const targetDashboard = role === 'finance' ? '/finance' : '/employee';
      return NextResponse.redirect(new URL(targetDashboard, request.url));
    }

    if (pathname.startsWith('/finance') && role !== 'finance') {
      const targetDashboard = role === 'director' ? '/director' : '/employee';
      return NextResponse.redirect(new URL(targetDashboard, request.url));
    }

    // Allow all roles (employee, director, finance) to access /employee/new for reimbursement creation
    if (pathname.startsWith('/employee') && !pathname.startsWith('/employee/new') && role !== 'employee') {
      const targetDashboard = role === 'director' ? '/director' : '/finance';
      return NextResponse.redirect(new URL(targetDashboard, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
