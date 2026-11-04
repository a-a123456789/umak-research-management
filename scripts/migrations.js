import {readFileSync,readdirSync} from 'node:fs';
export async function migrate(client) {
  // Caller owns a transaction: one lock protects schema history and changes together.
  await client.query("SELECT pg_advisory_xact_lock(73641029)");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of readdirSync(new URL('../db/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()) {
    if((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount) continue;
    await client.query(readFileSync(new URL(`../db/migrations/${name}`,import.meta.url),'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
  }
}
