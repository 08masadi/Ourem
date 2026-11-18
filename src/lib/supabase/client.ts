import { createBrowserClient } from '@supabase/ssr';

function cleanUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export function createClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const validUrl = cleanUrl(rawUrl) || 'https://placeholder.supabase.co';
  const validKey = supabaseKey || 'placeholder-key';

  return createBrowserClient(validUrl, validKey);
}
