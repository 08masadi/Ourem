import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function sanitizeRedirectPath(path: string | null): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  // Cegah open redirect: hanya izinkan path lokal yang diawali satu slash '/'
  // Tolak protocol-relative '//', backslash '\\', atau skema URL eksternal ':'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes(':')) {
    return null;
  }
  return trimmed;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let targetPath = sanitizeRedirectPath(nextParam);
      if (!targetPath) {
        // Cek role user untuk menentukan dashboard tujuan secara aman
        const user = data?.user;
        const role = user?.user_metadata?.role || 'employee';
        targetPath = role === 'director' ? '/director' : role === 'finance' ? '/finance' : '/employee';
      }

      // Gunakan origin request yang valid untuk mencegah Host Header Poisoning
      const redirectUrl = new URL(targetPath, requestUrl.origin);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect to login with error parameter if code is invalid or expired
  return NextResponse.redirect(
    new URL('/login?error=Tautan+konfirmasi+atau+reset+tidak+valid+atau+telah+kedaluwarsa', requestUrl.origin)
  );
}
