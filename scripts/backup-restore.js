import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import assert from 'node:assert/strict';
if(process.env.ALLOW_SYNTHETIC_SETUP!=='yes') throw Error('Synthetic database only');
const url=new URL(process.env.ADMIN_DATABASE_URL);
const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1)};
const name='crm_restore_'+Date.now();const dir=mkdtempSync(join(tmpdir(),'crm-backup-'));
const admin=new pg.Client({connectionString:url.href});await admin.connect();let target;
async function snapshot(db){
 const tables=['users','research_records','sessions','consents','deletion_requests','audit_logs','consultation_tickets','schema_migrations'];const out={};
 for(const table of tables){const r=await db.query(`SELECT * FROM ${table} ORDER BY 1`);out[table]=JSON.stringify(r.rows);}
 return out;
}
try {
 const before=await snapshot(admin);
 execFileSync('pg_dump',['--format=custom','--no-owner','--file',join(dir,'backup.dump')],{env,stdio:'pipe'});
 await admin.query(`CREATE DATABASE ${name}`);const restored=new URL(url);restored.pathname='/'+name;
 execFileSync('pg_restore',['--no-owner','--dbname',name,join(dir,'backup.dump')],{env,stdio:'pipe'});
 target=new pg.Client({connectionString:restored.href});await target.connect();assert.deepEqual(await snapshot(target),before);
 console.log(JSON.stringify({result:'PASS',tables_compared:Object.keys(before),method:'Full ordered row comparison after pg_dump/pg_restore',limitations:'Quiescent synthetic database; not a production RPO/RTO, encrypted backup, or deletion replay proof.'},null,2));
} finally {
 if(target)await target.end();await admin.query(`DROP DATABASE IF EXISTS ${name}`);await admin.end();rmSync(dir,{recursive:true,force:true});
}
