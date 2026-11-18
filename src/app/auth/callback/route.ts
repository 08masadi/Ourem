import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let targetPath = nextParam;
      if (!targetPath) {
        // Cek role user untuk menentukan dashboard tujuan
        const user = data?.user;
        const role = user?.user_metadata?.role || 'employee';
        targetPath = role === 'director' ? '/director' : role === 'finance' ? '/finance' : '/employee';
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(new URL(targetPath, request.url));
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${targetPath}`);
      } else {
        return NextResponse.redirect(new URL(targetPath, request.url));
      }
    }
  }

  // Redirect to login with error parameter if code is invalid or expired
  return NextResponse.redirect(
    new URL('/login?error=Tautan+konfirmasi+atau+reset+tidak+valid+atau+telah+kedaluwarsa', request.url)
  );
}
