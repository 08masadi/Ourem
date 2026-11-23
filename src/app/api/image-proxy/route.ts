import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    // Security Fix (VULN-03): SSRF Protection
    // 1. Validasi URL dan protokol (wajib HTTPS)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return new NextResponse('Invalid URL format', { status: 400 });
    }

    if (parsedUrl.protocol !== 'https:') {
      return new NextResponse('Forbidden: Hanya protokol HTTPS yang diizinkan', { status: 400 });
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 2. Blokir alamat IP privat, loopback, dan cloud metadata service (169.254.169.254)
    const isPrivateHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '169.254.169.254' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local');

    if (isPrivateHost) {
      return new NextResponse('Forbidden: Akses ke jaringan internal/private dilarang', { status: 403 });
    }

    // 3. Whitelist Hostname: Hanya izinkan domain Supabase project resmi
    let configuredSupabaseHost = '';
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        configuredSupabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.toLowerCase();
      }
    } catch {}

    const isAllowedHost =
      (configuredSupabaseHost && hostname === configuredSupabaseHost) ||
      hostname.endsWith('.supabase.co') ||
      hostname.endsWith('.supabase.in');

    if (!isAllowedHost) {
      return new NextResponse('Forbidden: Hostname gambar tidak berada dalam daftar whitelist', { status: 403 });
    }

    // 4. Fetch dengan batas waktu (timeout) 10 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'image/jpeg,image/png,image/webp,image/gif',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return new NextResponse('Failed to fetch image', { status: res.status });
    }

    const contentType = (res.headers.get('content-type') || 'image/jpeg').toLowerCase();

    // 5. Verifikasi Content-Type: Hanya izinkan raster image (cegah SVG XSS & HTML)
    const isSafeImage =
      contentType.startsWith('image/') &&
      !contentType.includes('svg') &&
      !contentType.includes('html');

    if (!isSafeImage) {
      return new NextResponse('Forbidden: Format gambar tidak aman (SVG/HTML dilarang)', { status: 400 });
    }

    const arrayBuffer = await res.arrayBuffer();

    // 6. Batasi ukuran maksimal gambar (10 MB)
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
      return new NextResponse('Payload Too Large: Ukuran gambar melebihi 10MB', { status: 413 });
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || 'Error proxying image', { status: 500 });
  }
}
