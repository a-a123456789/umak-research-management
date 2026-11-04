import {databaseConfig} from '../src/security/database-config.js';
import pg from 'pg';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {S3Client,GetObjectCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';
import {backupKey,decryptFile,pgEnvironment} from './backup-crypto.js';
const exec=promisify(execFile),started=performance.now();
if(!process.env.ADMIN_DATABASE_URL||!process.env.BACKUP_KEY_FILE||!process.env.DATABASE_URL)throw Error('Database URLs and backup key required');
if(process.env.BACKUP_ARCHIVE_FILE&&process.env.ALLOW_SYNTHETIC_SETUP!=='yes')throw Error('Local archive drill is synthetic-only');
const dir=await mkdtemp(join(tmpdir(),'crm-restore-')),name='crm_restore_'+randomBytes(8).toString('hex');
const db=new pg.Client(databaseConfig({...process.env,DATABASE_URL:process.env.ADMIN_DATABASE_URL}));let created=false,target;
const s3=new S3Client({region:process.env.AWS_REGION??'auto'});
try{
 let archive=process.env.BACKUP_ARCHIVE_FILE;
 if(!archive){
  if(!process.env.BACKUP_S3_BUCKET)throw Error('Offsite bucket required');
  // The backup prefix is operationally bounded by the approved retention policy.
  let Key=process.env.BACKUP_OBJECT_KEY;
  if(!Key){let cursor,newest;do{const page=await s3.send(new ListObjectsV2Command({Bucket:process.env.BACKUP_S3_BUCKET,Prefix:'backups/',ContinuationToken:cursor}));for(const item of page.Contents??[])if(!newest||item.LastModified>newest.LastModified)newest=item;cursor=page.NextContinuationToken;}while(cursor);Key=newest?.Key;}
  if(!Key)throw Error('No offsite backup found');
  const response=await s3.send(new GetObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key}),{abortSignal:AbortSignal.timeout(600_000)});
  archive=join(dir,'download.enc');await pipeline(response.Body,createWriteStream(archive,{mode:0o600,flags:'wx'}));
 }
 await decryptFile(archive,join(dir,'archive.tar'),await backupKey(process.env.BACKUP_KEY_FILE));
 const listing=await exec('tar',['-tf',join(dir,'archive.tar')],{maxBuffer:16*1024*1024});
 for(const path of listing.stdout.trim().split('\n'))if(!/^(database\.dump|manifest\.json|objects\/?|objects\/[a-f0-9-]{36})$/.test(path))throw Error('Unexpected archive path');
 await exec('tar',['-xf',join(dir,'archive.tar'),'-C',dir],{timeout:600_000});
 const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
 if(manifest.format!==1||!Array.isArray(manifest.documents))throw Error('Unsupported backup manifest');
 for(const doc of manifest.documents){
  if(!/^[a-f0-9-]{36}$/.test(doc.id))throw Error('Invalid object ID');
  const bytes=await readFile(join(dir,'objects',doc.id));
  if(bytes.length!==doc.size_bytes||createHash('sha256').update(bytes).digest('hex')!==doc.sha256)throw Error('Restored object checksum mismatch');
 }
 await db.connect();await db.query(`CREATE DATABASE ${name}`);created=true;
 await exec('pg_restore',['--exit-on-error','--no-owner','--dbname',name,join(dir,'database.dump')],{env:pgEnvironment(process.env.ADMIN_DATABASE_URL),timeout:600_000,maxBuffer:1024*1024});
 const restored=new URL(process.env.ADMIN_DATABASE_URL);restored.pathname='/'+name;
 target=new pg.Client(databaseConfig({...process.env,DATABASE_URL:restored.href}));await target.connect();
 let replayed=0;
 if(!process.env.BACKUP_ARCHIVE_FILE){
  let cursor;
  do{
   const page=await s3.send(new ListObjectsV2Command({Bucket:process.env.BACKUP_S3_BUCKET,Prefix:'deletions/',ContinuationToken:cursor}));
   for(const item of page.Contents??[]){
    if(!/^deletions\/[a-f0-9-]{36}\.crmenc$/.test(item.Key))throw Error('Invalid deletion ledger key');
    const response=await s3.send(new GetObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:item.Key}),{abortSignal:AbortSignal.timeout(60000)});
    const encrypted=join(dir,'deletion.enc'),plain=join(dir,'deletion.json');
    await pipeline(response.Body,createWriteStream(encrypted,{mode:0o600}));
    await decryptFile(encrypted,plain,await backupKey(process.env.BACKUP_KEY_FILE));
    const event=JSON.parse(await readFile(plain,'utf8'));
    if(event.format!==1||!/^[a-f0-9-]{36}$/.test(event.subject_ref))throw Error('Invalid deletion event');
    await target.query('DELETE FROM users WHERE subject_ref=$1',[event.subject_ref]);replayed++;
    await rm(encrypted);await rm(plain);
   }
   cursor=page.NextContinuationToken;
  }while(cursor);
 }
 const constraints=await target.query("SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT convalidated");
 if(constraints.rowCount)throw Error('Unvalidated restored constraints');
 await target.query("INSERT INTO research_records(author_id,title,status) SELECT id,'Restore smoke test','Draft' FROM users WHERE role IN ('student','faculty') LIMIT 1");
 const runtimeUrl=new URL(process.env.DATABASE_URL);runtimeUrl.pathname='/'+name;
 const runtime=new pg.Client(databaseConfig({...process.env,DATABASE_URL:runtimeUrl.href}));await runtime.connect();
 try{
  if((await runtime.query('SELECT * FROM research_records')).rowCount)throw Error('Restored RLS failed closed check');
  try{await runtime.query('DELETE FROM audit_history');throw Error('Restored audit grants failed');}catch(e){if(e.code!=='42501')throw e;}
 }finally{await runtime.end();}
 console.log(JSON.stringify({result:'PASS',authenticated_decryption:true,documents_verified:manifest.documents.length,deletion_events_replayed:replayed,deletion_replay_source:process.env.BACKUP_ARCHIVE_FILE?'not configured (synthetic local drill)':'independent offsite deletion prefix',rto_seconds:(performance.now()-started)/1000,backup_age_hours:(Date.now()-Date.parse(manifest.created_at))/3600000,
   limitations:'Quarantined disposable drill only. Object checksums verified; objects not published. Institutional deletion replay and full application recovery approval required before serving a restore.'}));
}finally{
 if(target)await target.end();if(created)await db.query(`DROP DATABASE ${name}`);await db.end();await rm(dir,{recursive:true,force:true});s3.destroy();
}
