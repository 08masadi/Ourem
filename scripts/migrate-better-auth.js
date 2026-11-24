const { Pool } = require('pg');
const fs = require('fs');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (match) databaseUrl = match[1];
}

const pool = new Pool({
  connectionString: databaseUrl,
});

async function migrate() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = await pool.connect();

  try {
    console.log('Creating Better Auth tables if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public."user" (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
          image TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          role TEXT DEFAULT 'employee',
          department TEXT DEFAULT 'Staff Operasional',
          phone TEXT,
          employee_id TEXT,
          bank_name TEXT,
          bank_account_number TEXT,
          bank_account_holder TEXT,
          signature_url TEXT
      );

      CREATE TABLE IF NOT EXISTS public."session" (
          id TEXT PRIMARY KEY,
          "expiresAt" TIMESTAMPTZ NOT NULL,
          token TEXT NOT NULL UNIQUE,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "userId" TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS public."account" (
          id TEXT PRIMARY KEY,
          "accountId" TEXT NOT NULL,
          "providerId" TEXT NOT NULL,
          "userId" TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
          "accessToken" TEXT,
          "refreshToken" TEXT,
          "idToken" TEXT,
          "accessTokenExpiresAt" TIMESTAMPTZ,
          "refreshTokenExpiresAt" TIMESTAMPTZ,
          scope TEXT,
          password TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public."verification" (
          id TEXT PRIMARY KEY,
          identifier TEXT NOT NULL,
          value TEXT NOT NULL,
          "expiresAt" TIMESTAMPTZ NOT NULL,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_session_userId ON public."session"("userId");
      CREATE INDEX IF NOT EXISTS idx_account_userId ON public."account"("userId");
    `);
    console.log('Better Auth tables created successfully!');

    console.log('Checking columns of public.profiles...');
    const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'");
    const cols = colRes.rows.map(r => r.column_name);
    console.log('Columns in profiles:', cols);

    console.log('Syncing existing users from public.profiles to public.user...');
    const result = await client.query(`
      INSERT INTO public."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, department, bank_name, bank_account_number, bank_account_holder)
      SELECT 
          p.id::text,
          p.full_name,
          p.email,
          true,
          COALESCE(p.created_at, NOW()),
          COALESCE(p.updated_at, NOW()),
          p.role,
          p.department,
          p.bank_name,
          p.bank_account_number,
          p.bank_account_holder
      FROM public.profiles p
      ON CONFLICT (id) DO UPDATE
      SET 
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          department = EXCLUDED.department,
          bank_name = EXCLUDED.bank_name,
          bank_account_number = EXCLUDED.bank_account_number,
          bank_account_holder = EXCLUDED.bank_account_holder;
    `);
    console.log('User synchronization completed:', result.rowCount, 'users synchronized!');

    const userCount = await client.query('SELECT COUNT(*) FROM public."user"');
    console.log('Total users in Better Auth table:', userCount.rows[0].count);

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
