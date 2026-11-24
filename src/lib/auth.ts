import { betterAuth } from 'better-auth';
import { dash } from '@better-auth/infra';
import { Pool } from 'pg';

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    dash({
      apiKey: process.env.BETTER_AUTH_API_KEY,
    }),
  ],
  advanced: {
    ipAddress: {
      // Prioritaskan header Vercel dan Cloudflare untuk mendeteksi IP asli pengguna
      ipAddressHeaders: ['x-vercel-forwarded-for', 'cf-connecting-ip', 'x-forwarded-for'],
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'employee',
        input: true,
      },
      department: {
        type: 'string',
        required: false,
        defaultValue: 'Staff Operasional',
        input: true,
      },
      phone: {
        type: 'string',
        required: false,
        input: true,
      },
      employee_id: {
        type: 'string',
        required: false,
        input: true,
      },
      bank_name: {
        type: 'string',
        required: false,
        input: true,
      },
      bank_account_number: {
        type: 'string',
        required: false,
        input: true,
      },
      bank_account_holder: {
        type: 'string',
        required: false,
        input: true,
      },
      signature_url: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },
});
