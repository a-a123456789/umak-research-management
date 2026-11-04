import {databaseConfig} from '../src/security/database-config.js';
import pg from 'pg';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm,copyFile} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {Agent} from 'node:https';
import {backupKey,encryptFile,pgEnvironment} from './backup-crypto.js';
const exec=promisify(execFile);
if(!process.env.ADMIN_DATABASE_URL||!process.env.BACKUP_KEY_FILE)throw Error('ADMIN_DATABASE_URL and BACKUP_KEY_FILE required');
const local=process.env.BACKUP_LOCAL_DIR;
if(local&&process.env.ALLOW_SYNTHETIC_SETUP!=='yes')throw Error('Local backup mode is synthetic-only');
if(!local&&(!process.env.BACKUP_S3_BUCKET||process.env.BACKUP_S3_BUCKET===process.env.S3_BUCKET))throw Error('Separate offsite backup bucket required');
const key=await backupKey(process.env.BACKUP_KEY_FILE),dir=await mkdtemp(join(tmpdir(),'crm-offsite-'));
const db=new pg.Client(databaseConfig({...process.env,DATABASE_URL:process.env.ADMIN_DATABASE_URL}));
const s3=new S3Client({region:process.env.AWS_REGION??'auto',requestHandler:new NodeHttpHandler({httpsAgent:new Agent({minVersion:'TLSv1.3'}),connectionTimeout:5000,requestTimeout:60000})});
try{
 await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const snapshot=(await db.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
 await exec('pg_dump',['--format=custom','--no-owner','--snapshot',snapshot,'--file',join(dir,'database.dump')],{env:pgEnvironment(process.env.ADMIN_DATABASE_URL),timeout:600_000,maxBuffer:1024*1024});
 const documents=(await db.query('SELECT id,object_key,size_bytes,sha256 FROM documents ORDER BY id')).rows;
 await mkdir(join(dir,'objects'));
 for(const document of documents){
  if(!process.env.S3_BUCKET)throw Error('Source manuscript bucket required');
  const result=await s3.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:document.object_key}),{abortSignal:AbortSignal.timeout(60000)});
  const path=join(dir,'objects',document.id);await pipeline(result.Body,createWriteStream(path,{mode:0o600,flags:'wx'}));
  const bytes=await readFile(path);if(bytes.length!==document.size_bytes||createHash('sha256').update(bytes).digest('hex')!==document.sha256)throw Error('Manuscript snapshot mismatch');
 }
 await db.query('COMMIT');
 const manifest={format:1,created_at:new Date().toISOString(),documents,limitations:'Institutional retention/deletion replay and independent offsite access verification required before reopening any restore.'};
 await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest),{mode:0o600});
 await exec('tar',['-cf',join(dir,'archive.tar'),'-C',dir,'database.dump','manifest.json','objects'],{timeout:600_000});
 await encryptFile(join(dir,'archive.tar'),join(dir,'archive.enc'),key);
 const objectKey=`backups/${new Date().toISOString().replaceAll(':','-')}.crmenc`,size=(await stat(join(dir,'archive.enc'))).size;
 if(local){await mkdir(local,{recursive:true});await copyFile(join(dir,'archive.enc'),join(local,objectKey.split('/')[1]));}
 else await s3.send(new PutObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:objectKey,Body:createReadStream(join(dir,'archive.enc')),ContentLength:size,ServerSideEncryption:'AES256'}),{abortSignal:AbortSignal.timeout(600_000)});
 if(process.env.BACKUP_STATUS_FILE)await writeFile(process.env.BACKUP_STATUS_FILE,JSON.stringify({last_success:new Date().toISOString(),object_key:objectKey,bytes:size,documents:documents.length,offsite:!local}),{mode:0o600});
 console.log(JSON.stringify({result:'PASS',encrypted:true,offsite:!local,object_key:objectKey,bytes:size,documents:documents.length}));
}finally{await db.end();await rm(dir,{recursive:true,force:true});s3.destroy();}
