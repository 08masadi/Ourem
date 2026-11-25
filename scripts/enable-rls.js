const { Pool } = require('pg');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const envConfig = fs.readFileSync('.env.local', 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      const val = values.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = val;
    }
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testRLS() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.reimbursement_requests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "profiles_access_policy" ON public.profiles;
      CREATE POLICY "profiles_access_policy" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "reimbursement_requests_access_policy" ON public.reimbursement_requests;
      CREATE POLICY "reimbursement_requests_access_policy" ON public.reimbursement_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "requests_access_policy" ON public.requests;
      CREATE POLICY "requests_access_policy" ON public.requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "request_logs_access_policy" ON public.request_logs;
      CREATE POLICY "request_logs_access_policy" ON public.request_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    `);

    const tables = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);
    console.log('Tables and RLS status:');
    console.table(tables.rows);

    const pols = await client.query(`
      SELECT schemaname, tablename, policyname, cmd, roles 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `);
    console.log('Current policies:');
    console.table(pols.rows);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}
testRLS();
