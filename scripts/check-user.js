const { Pool } = require('pg');
const fs = require('fs');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (match) databaseUrl = match[1];
}

const pool = new Pool({ connectionString: databaseUrl });

async function check() {
  const users = await pool.query('SELECT id, name, email, "emailVerified", "createdAt" FROM public."user" ORDER BY "createdAt" DESC LIMIT 10');
  console.log('--- RECENT USERS IN public.user ---');
  console.table(users.rows);

  const accounts = await pool.query('SELECT id, "userId", "accountId", "providerId", password IS NOT NULL as has_password, "createdAt" FROM public."account" ORDER BY "createdAt" DESC LIMIT 10');
  console.log('\n--- RECENT ACCOUNTS IN public.account ---');
  console.table(accounts.rows);

  const sessions = await pool.query('SELECT id, "userId", "expiresAt", "createdAt" FROM public."session" ORDER BY "createdAt" DESC LIMIT 10');
  console.log('\n--- RECENT SESSIONS IN public.session ---');
  console.table(sessions.rows);

  await pool.end();
}

check().catch(console.error);
