const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Finding and dropping all policies on tables...');
    const pols = await client.query(`
      SELECT schemaname, tablename, policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'reimbursement_requests', 'requests', 'request_logs');
    `);
    for (const p of pols.rows) {
      console.log(`Dropping policy ${p.policyname} on ${p.tablename}...`);
      await client.query(`DROP POLICY IF EXISTS "${p.policyname}" ON "${p.tablename}"`);
    }

    console.log('2. Dropping foreign key constraints...');
    await client.query(`
      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
      ALTER TABLE reimbursement_requests DROP CONSTRAINT IF EXISTS reimbursement_requests_user_id_fkey;
      ALTER TABLE reimbursement_requests DROP CONSTRAINT IF EXISTS reimbursement_requests_director_id_fkey;
      ALTER TABLE reimbursement_requests DROP CONSTRAINT IF EXISTS reimbursement_requests_finance_id_fkey;
      ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_employee_id_fkey;
      ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_director_id_fkey;
      ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_finance_id_fkey;
      ALTER TABLE request_logs DROP CONSTRAINT IF EXISTS request_logs_actor_id_fkey;
    `);

    console.log('3. Altering column types to text...');
    await client.query(`
      ALTER TABLE profiles ALTER COLUMN id TYPE text USING id::text;
      ALTER TABLE reimbursement_requests ALTER COLUMN user_id TYPE text USING user_id::text;
      ALTER TABLE reimbursement_requests ALTER COLUMN director_id TYPE text USING director_id::text;
      ALTER TABLE reimbursement_requests ALTER COLUMN finance_id TYPE text USING finance_id::text;
      ALTER TABLE requests ALTER COLUMN employee_id TYPE text USING employee_id::text;
      ALTER TABLE requests ALTER COLUMN director_id TYPE text USING director_id::text;
      ALTER TABLE requests ALTER COLUMN finance_id TYPE text USING finance_id::text;
      ALTER TABLE request_logs ALTER COLUMN actor_id TYPE text USING actor_id::text;
    `);

    console.log('4. Re-creating foreign key constraints to profiles(id)...');
    await client.query(`
      ALTER TABLE reimbursement_requests 
        ADD CONSTRAINT reimbursement_requests_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
      ALTER TABLE reimbursement_requests 
        ADD CONSTRAINT reimbursement_requests_director_id_fkey 
        FOREIGN KEY (director_id) REFERENCES profiles(id) ON DELETE SET NULL;
      ALTER TABLE reimbursement_requests 
        ADD CONSTRAINT reimbursement_requests_finance_id_fkey 
        FOREIGN KEY (finance_id) REFERENCES profiles(id) ON DELETE SET NULL;

      ALTER TABLE requests 
        ADD CONSTRAINT requests_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
      ALTER TABLE requests 
        ADD CONSTRAINT requests_director_id_fkey 
        FOREIGN KEY (director_id) REFERENCES profiles(id) ON DELETE SET NULL;
      ALTER TABLE requests 
        ADD CONSTRAINT requests_finance_id_fkey 
        FOREIGN KEY (finance_id) REFERENCES profiles(id) ON DELETE SET NULL;

      ALTER TABLE request_logs 
        ADD CONSTRAINT request_logs_actor_id_fkey 
        FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
    `);

    console.log('5. Syncing all users from public.user to public.profiles...');
    await client.query(`
      INSERT INTO profiles (id, email, full_name, role, department, bank_name, bank_account_number, bank_account_holder, created_at, updated_at)
      SELECT 
        u.id, 
        u.email, 
        COALESCE(u.name, split_part(u.email, '@', 1)), 
        COALESCE(u.role, 'employee')::user_role, 
        COALESCE(u.department, 'Staff Operasional'),
        u.bank_name,
        u.bank_account_number,
        u.bank_account_holder,
        u."createdAt", 
        u."updatedAt"
      FROM "user" u
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        bank_name = COALESCE(EXCLUDED.bank_name, profiles.bank_name),
        bank_account_number = COALESCE(EXCLUDED.bank_account_number, profiles.bank_account_number),
        bank_account_holder = COALESCE(EXCLUDED.bank_account_holder, profiles.bank_account_holder),
        updated_at = NOW();
    `);

    console.log('6. Disabling RLS on tables...');
    await client.query(`
      ALTER TABLE reimbursement_requests DISABLE ROW LEVEL SECURITY;
      ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
      ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
      ALTER TABLE request_logs DISABLE ROW LEVEL SECURITY;
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
