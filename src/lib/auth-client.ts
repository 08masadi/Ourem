import { createAuthClient } from 'better-auth/react';
import { dashClient } from '@better-auth/infra/client';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  plugins: [dashClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
