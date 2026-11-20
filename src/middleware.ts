import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { supabaseResponse, user, role } = await updateSession(request);

  const isAuthRoute = pathname.startsWith('/login');
  const isDashboardRoute =
    pathname.startsWith('/employee') ||
    pathname.startsWith('/director') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/profile');

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
