import pg from 'pg';
import {migrate} from './migrations.js';
import { readFileSync } from 'node:fs';
import { hashPassword } from '../src/crypto.js';
if (process.env.ALLOW_SYNTHETIC_SETUP !== 'yes') throw Error('Requires ALLOW_SYNTHETIC_SETUP=yes on a synthetic database');
const pass = process.env.APP_DB_PASSWORD;
const demo = process.env.DEMO_PASSWORD;
if (!pass || pass.length < 16 || !/^[A-Za-z0-9_-]+$/.test(pass)) throw Error('APP_DB_PASSWORD must have 16+ URL-safe alphanumeric characters');
if (!demo || demo.length < 12) throw Error('DEMO_PASSWORD must have 12+ characters');
const db = new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});
await db.connect();
try {
  await db.query('BEGIN');
  const role = await db.query("SELECT 1 FROM pg_roles WHERE rolname='crm_app'");
  if (!role.rowCount) await db.query('CREATE ROLE crm_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
  // PostgreSQL utility statements cannot bind passwords; pass is restricted above.
  await db.query(`ALTER ROLE crm_app PASSWORD '${pass}'`);
  await db.query(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
  await migrate(db);
  for (const [id,email,role] of [[1,'student1@example.test','student'],[2,'student2@example.test','student'],[3,'staff@example.test','staff']]) {
    await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET password_hash=EXCLUDED.password_hash',[id,email,hashPassword(demo),role]);
  }
  for (const r of [[1,1,'Published research','Synthetic public abstract','Approved'],[2,1,'Private research A','Synthetic confidential draft A','Draft'],[3,2,'Private research B','Synthetic confidential draft B','Draft']]) {
    await db.query('INSERT INTO research_records(id,author_id,title,abstract,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',r);
  }
  await db.query("SELECT setval(pg_get_serial_sequence('users','id'),GREATEST((SELECT MAX(id) FROM users),1))");
  await db.query("SELECT setval(pg_get_serial_sequence('research_records','id'),GREATEST((SELECT MAX(id) FROM research_records),1))");
  await db.query('COMMIT');
  console.log('Synthetic schema and three demo accounts prepared; API uses non-owner crm_app.');
} catch(e) {await db.query('ROLLBACK');throw e;} finally {await db.end();}
