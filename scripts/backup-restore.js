import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import assert from 'node:assert/strict';
if(process.env.ALLOW_SYNTHETIC_SETUP!=='yes') throw Error('Synthetic database only');
const url=new URL(process.env.ADMIN_DATABASE_URL);
const env={...process.env,PGHOST:url.searchParams.get('host')??url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1)};
const name='crm_restore_'+Date.now();const dir=mkdtempSync(join(tmpdir(),'crm-backup-'));
const admin=new pg.Client({connectionString:url.href});await admin.connect();let target;
async function snapshot(db){
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);const out={};
 for(const table of tables){const quoted='"'+table.replaceAll('"','""')+'"';const r=await db.query(`SELECT to_jsonb(t) AS row FROM public.${quoted} t ORDER BY to_jsonb(t)::text`);out[table]=JSON.stringify(r.rows);}
 out.policies=JSON.stringify((await db.query("SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows);
 out.rls=JSON.stringify((await db.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY relname")).rows);
 out.grants=JSON.stringify((await db.query("SELECT table_name,grantee,privilege_type FROM information_schema.table_privileges WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type")).rows);
 out.sequences=JSON.stringify((await db.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows);
 return out;
}
try {
 const before=await snapshot(admin);
 execFileSync('pg_dump',['--format=custom','--no-owner','--file',join(dir,'backup.dump')],{env,stdio:'pipe'});
 await admin.query(`CREATE DATABASE ${name}`);const restored=new URL(url);restored.pathname='/'+name;
 execFileSync('pg_restore',['--no-owner','--dbname',name,join(dir,'backup.dump')],{env,stdio:'pipe'});
 target=new pg.Client({connectionString:restored.href});await target.connect();assert.deepEqual(await snapshot(target),before);
 console.log(JSON.stringify({result:'PASS',tables_compared:Object.keys(before),method:'All public table rows, policies, RLS flags, table grants and sequence values after pg_dump/pg_restore',limitations:'Quiescent synthetic database; not a production RPO/RTO, encrypted backup, or deletion replay proof.'},null,2));
} finally {
 if(target)await target.end();await admin.query(`DROP DATABASE IF EXISTS ${name}`);await admin.end();rmSync(dir,{recursive:true,force:true});
}
