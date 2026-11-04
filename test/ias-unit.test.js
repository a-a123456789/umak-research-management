import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import yazl from 'yazl';
import request from 'supertest';
import express from 'express';
import {validateDocument} from '../src/storage/validate.js';
import {clamScanner} from '../src/storage/scanner.js';
import {publicContentRouter} from '../src/public-content.js';
import {backupKey,encryptFile,decryptFile} from '../scripts/backup-crypto.js';
import {databaseConfig} from '../src/security/database-config.js';
import {configuredStore} from '../src/storage/s3.js';

async function docx({macro=false,missing=false,bomb=false}={}){
  const archive=new yazl.ZipFile(),chunks=[];
  archive.addBuffer(Buffer.from(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="${macro?'application/vnd.ms-word.document.macroEnabled.main+xml':'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'}"/></Types>`),'[Content_Types].xml');
  archive.addBuffer(Buffer.from('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'_rels/.rels');
  if(!missing)archive.addBuffer(Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'),'word/document.xml');
  if(bomb)archive.addBuffer(Buffer.alloc(21_000_000),'large.bin');
  archive.end();for await(const chunk of archive.outputStream)chunks.push(chunk);return Buffer.concat(chunks);
}
test('DOCX validates container and rejects macros, missing parts and expansion limits',async()=>{
  assert.equal(await validateDocument(await docx(),'valid.docx'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  for(const options of [{macro:true},{missing:true},{bomb:true}])await assert.rejects(validateDocument(await docx(options),'invalid.docx'));
});
test('ClamAV scanner protocol accepts clean response and rejects malware',async()=>{
  for(const [response,expected] of [['stream: OK\0',true],['stream: Test-Signature FOUND\0',false]]){
    const server=net.createServer(socket=>{let bytes=Buffer.alloc(0);socket.on('data',chunk=>{bytes=Buffer.concat([bytes,chunk]);if(bytes.length>=19)socket.end(response);});});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{assert.equal(await clamScanner({host:'127.0.0.1',port:server.address().port})(Buffer.from('ab')),expected);}
    finally{await new Promise(resolve=>server.close(resolve));}
  }
});
test('encrypted backups roundtrip; modified bytes/wrong key and weak key-file permissions fail',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crm-crypto-test-')),key=randomBytes(32);
  try{
    await writeFile(join(dir,'input'),'synthetic backup payload');
    await encryptFile(join(dir,'input'),join(dir,'encrypted'),key);
    assert.ok(!(await readFile(join(dir,'encrypted'))).includes(Buffer.from('synthetic backup payload')));
    await decryptFile(join(dir,'encrypted'),join(dir,'output'),key);assert.equal(await readFile(join(dir,'output'),'utf8'),'synthetic backup payload');
    await assert.rejects(decryptFile(join(dir,'encrypted'),join(dir,'wrong'),randomBytes(32)));
    const bytes=await readFile(join(dir,'encrypted'));bytes[22]^=1;await writeFile(join(dir,'tampered'),bytes);
    await assert.rejects(decryptFile(join(dir,'tampered'),join(dir,'invalid'),key));
    await writeFile(join(dir,'key'),key.toString('hex'),{mode:0o644});await assert.rejects(backupKey(join(dir,'key')));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('public cache catalogue has stable ETag and checksummed blank template',async()=>{
  const app=express();app.use('/api/v1/public',publicContentRouter());
  const r=await request(app).get('/api/v1/public/content').expect(200);assert.equal(r.body.items.length,4);
  await request(app).get('/api/v1/public/content').set('If-None-Match',r.headers.etag).expect(304);
  const template=await request(app).get(r.body.items.find(x=>x.kind==='template').url).expect(200);assert.ok(template.text.includes('SYNTHETIC DEMO'));
});
test('production database refuses plaintext/unverified configuration',()=>{
  assert.throws(()=>databaseConfig({NODE_ENV:'production',DATABASE_URL:'postgresql://example.test/db'}));
  assert.throws(()=>databaseConfig({NODE_ENV:'production',DATABASE_URL:'postgresql://example.test/db?sslmode=no-verify',DB_TLS_CA_FILE:'unused'}));
});
test('real SDK presigner binds private key and ten-minute expiry without cloud calls',async()=>{
  const store=configuredStore({S3_BUCKET:'synthetic-private',S3_ENDPOINT:'https://objects.example.test',AWS_REGION:'auto'},
    {credentials:{accessKeyId:'synthetic-access',secretAccessKey:'synthetic-signing-material'}});
  const url=new URL(await store.download('manuscripts/synthetic-id'));
  assert.equal(url.protocol,'https:');assert.equal(url.searchParams.get('X-Amz-Expires'),'600');
  assert.ok(url.pathname.endsWith('/manuscripts/synthetic-id'));assert.ok(url.searchParams.get('X-Amz-Signature'));
  assert.throws(()=>configuredStore({S3_BUCKET:'test',S3_ENDPOINT:'http://objects.example.test'}));
});
