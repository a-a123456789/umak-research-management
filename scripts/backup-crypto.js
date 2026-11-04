import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {readFile,writeFile,appendFile,stat,open} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
const magic=Buffer.from('CRMBAK01');
export async function backupKey(path){
  const info=await stat(path);
  if((info.mode&0o077)!==0)throw Error('Backup key file must be owner-only');
  const text=(await readFile(path,'utf8')).trim();if(!/^[a-f0-9]{64}$/i.test(text))throw Error('Backup key requires 32 random bytes as hex');return Buffer.from(text,'hex');
}
export async function encryptFile(input,output,key){
  const iv=randomBytes(12),header=Buffer.concat([magic,iv]),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(header);await writeFile(output,header,{mode:0o600,flag:'wx'});
  await pipeline(createReadStream(input),cipher,createWriteStream(output,{flags:'a'}));await appendFile(output,cipher.getAuthTag());
}
export async function decryptFile(input,output,key){
  const info=await stat(input);if(info.size<36)throw Error('Invalid encrypted backup');
  const fd=await open(input,'r'),header=Buffer.alloc(20),tag=Buffer.alloc(16);
  try{await fd.read(header,0,20,0);await fd.read(tag,0,16,info.size-16);}finally{await fd.close();}
  if(!header.subarray(0,8).equals(magic))throw Error('Invalid backup format');
  const cipher=createDecipheriv('aes-256-gcm',key,header.subarray(8));cipher.setAAD(header);cipher.setAuthTag(tag);
  // Caller must not read/extract plaintext until authentication finishes successfully.
  await pipeline(createReadStream(input,{start:20,end:info.size-17}),cipher,createWriteStream(output,{mode:0o600,flags:'wx'}));
}
export function pgEnvironment(connection){
  const u=new URL(connection);
  const tls=process.env.NODE_ENV==='production'?{PGSSLMODE:'verify-full',PGSSLROOTCERT:process.env.DB_TLS_CA_FILE,PGSSLMINPROTOCOLVERSION:'TLSv1.3'}:{};
  return {...process.env,PGHOST:u.searchParams.get('host')??u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),...tls};
}
