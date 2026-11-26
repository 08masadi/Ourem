import { betterAuth } from 'better-auth';
import { dash } from '@better-auth/infra';
import { admin } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { nextCookies } from 'better-auth/next-js';
import { Pool } from 'pg';

const statement = {
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'impersonate-admins',
    'delete',
    'set-password',
    'set-email',
    'set-phone',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
} as const;

const ac = createAccessControl(statement);

const fullAdminRole = ac.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'impersonate-admins',
    'delete',
    'set-password',
    'set-email',
    'set-phone',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
});

const standardRole = ac.newRole({
  user: [],
  session: [],
});

export const auth = betterAuth({
  appName: 'Ourem Gen 2',
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
    admin({
      ac,
      roles: {
        'super-admin': fullAdminRole,
        admin: fullAdminRole,
        director: fullAdminRole,
        finance: standardRole,
        employee: standardRole,
        user: standardRole,
      },
      defaultRole: 'employee',
      adminRoles: ['super-admin', 'admin', 'director'],
      adminUserIds: ['adab5979-a3c8-40df-90b2-370a993ff47d'],
      impersonationSessionDuration: 3600,
    }),
    nextCookies(),
  ],
  advanced: {
    database: {
      joins: true, // Enable database joins for better performance
    },
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
