import {databaseConfig} from '../src/security/database-config.js';
import pg from 'pg';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {S3Client,PutObjectCommand} from '@aws-sdk/client-s3';
import {backupKey,encryptFile} from './backup-crypto.js';
import {configuredStore} from '../src/storage/s3.js';
const store=configuredStore();
if(!store||!process.env.BACKUP_KEY_FILE||!process.env.BACKUP_S3_BUCKET)throw Error('Storage and separate deletion ledger bucket/key required');
if(process.env.BACKUP_S3_BUCKET===process.env.S3_BUCKET)throw Error('Deletion ledger must be independent of manuscript bucket');
const db=new pg.Client(databaseConfig({...process.env,DATABASE_URL:process.env.ADMIN_DATABASE_URL})),s3=new S3Client({region:process.env.AWS_REGION??'auto'}),dir=await mkdtemp(join(tmpdir(),'crm-privacy-'));
try{
 await db.connect();const key=await backupKey(process.env.BACKUP_KEY_FILE);
 await db.query('BEGIN');
 const events=await db.query('SELECT event_id,subject_ref,requested_at FROM privacy_deletions WHERE exported_at IS NULL ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 100');
 for(const event of events.rows){
  const input=join(dir,event.event_id+'.json'),output=input+'.enc';
  await writeFile(input,JSON.stringify({format:1,...event}),{mode:0o600});await encryptFile(input,output,key);
  await s3.send(new PutObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:`deletions/${event.event_id}.crmenc`,Body:await readFile(output),ServerSideEncryption:'AES256'}),{abortSignal:AbortSignal.timeout(60000)});
  await db.query('UPDATE privacy_deletions SET exported_at=clock_timestamp() WHERE event_id=$1',[event.event_id]);
 }
 // Export the durable deletion events before removing the corresponding objects.
 const objects=await db.query('SELECT document_id,object_key FROM object_cleanup WHERE completed_at IS NULL ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 100');
 for(const object of objects.rows){await store.remove(object.object_key);await db.query("UPDATE object_cleanup SET completed_at=clock_timestamp(),object_key='' WHERE document_id=$1",[object.document_id]);}
 await db.query("DELETE FROM login_attempts WHERE attempted_at<clock_timestamp()-interval '15 minutes'");
 await db.query("DELETE FROM rate_buckets WHERE updated_at<clock_timestamp()-interval '1 day'");
 await db.query("DELETE FROM sessions WHERE expires_at<clock_timestamp()");
 await db.query('COMMIT');console.log(JSON.stringify({result:'PASS',deletions_exported:events.rowCount,objects_removed:objects.rowCount}));
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();s3.destroy();await rm(dir,{recursive:true,force:true});}
