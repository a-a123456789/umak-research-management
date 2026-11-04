import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import {PDFDocument} from 'pdf-lib';
import {createApp} from '../src/app.js';
import {scopedDatabase} from '../src/security/context.js';
import {hashPassword,verifyPassword,needsRehash} from '../src/crypto.js';
import {reserveLogin} from '../src/security/limiter.js';
import {validateDocument,MAX_DOCUMENT_BYTES} from '../src/storage/validate.js';
if(process.env.ALLOW_SYNTHETIC_SETUP!=='yes')throw Error('Disposable synthetic DB required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2});
const admin=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL});
const scoped=scopedDatabase(pool),objects=new Map(),users=[],studies=[];
const store={async put(key,body){objects.set(key,body);},async remove(key){objects.delete(key);},async download(){return 'https://storage.example.test/signed';}};
const app=createApp(pool,{objectStore:store,scanner:async()=>true});
const tokens={};let faculty,unassigned,ownerStudy,pdf;
const auth=(r,who='owner')=>r.set('Authorization',`Bearer ${tokens[who]}`);
const runAs=(user,fn)=>scoped.storage.run({user:{id:user},requestId:randomUUID(),ip:'192.0.2.1'},()=>fn(scoped.db));
before(async()=>{
  await admin.query('TRUNCATE rate_buckets,login_attempts');
  const password=await hashPassword(process.env.DEMO_PASSWORD);
  for(const [label,role] of [['faculty','faculty'],['unassigned','staff']]){
    const r=await admin.query('INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id',[`ias-${label}@example.test`,password,role]);users.push(r.rows[0].id);
    if(label==='faculty')faculty=r.rows[0].id;else unassigned=r.rows[0].id;
  }
  for(const [label,email] of [['owner','student1@example.test'],['reviewer','staff@example.test'],['faculty','ias-faculty@example.test'],['unassigned','ias-unassigned@example.test']]){
    const r=await request(app).post('/api/v1/auth/login').send({email,password:process.env.DEMO_PASSWORD}).expect(200);tokens[label]=r.body.access_token;assert.equal(r.body.expires_in,900);
  }
  const r=await auth(request(app).post('/api/v1/research')).send({title:'IAS private study'}).expect(201);ownerStudy=r.body.id;studies.push(ownerStudy);
  await admin.query('INSERT INTO review_assignments VALUES($1,3)',[ownerStudy]);
  const doc=await PDFDocument.create();doc.addPage();pdf=Buffer.from(await doc.save());
});
after(async()=>{
  await admin.query('DELETE FROM research_records WHERE id=ANY($1::int[])',[studies]);
  await admin.query('DELETE FROM users WHERE id=ANY($1::int[])',[users]);
  await admin.query('TRUNCATE rate_buckets,login_attempts');await pool.end();await admin.end();
});
test('native RLS fails closed, isolates profiles and prevents pooled identity leaks',async()=>{
  assert.equal((await pool.query('SELECT * FROM research_records')).rowCount,0);
  assert.equal((await pool.query('SELECT * FROM users')).rowCount,0);
  await assert.rejects(pool.query("INSERT INTO research_records(author_id,title,status) VALUES(1,'Forbidden','Draft')"),{code:'42501'});
  await assert.rejects(runAs(1,db=>db.query('UPDATE research_records SET author_id=$1 WHERE id=$2',[faculty,ownerStudy])),{code:'42501'});
  for(let i=0;i<8;i++){
    const rows=await Promise.all([runAs(1,db=>db.query('SELECT id FROM research_records WHERE id=$1',[ownerStudy])),runAs(faculty,db=>db.query('SELECT id FROM research_records WHERE id=$1',[ownerStudy]))]);
    assert.equal(rows[0].rowCount,1);assert.equal(rows[1].rowCount,0);
  }
  assert.equal((await pool.query('SELECT * FROM research_records')).rowCount,0);
  assert.equal((await runAs(1,db=>db.query('SELECT id FROM users'))).rows[0].id,1);
});
test('assigned reviewer allowed, unrelated staff/faculty denied; membership grants and revokes access',async()=>{
  await auth(request(app).get(`/api/v1/research/${ownerStudy}`),'reviewer').expect(200);
  for(const who of ['faculty','unassigned'])await auth(request(app).get(`/api/v1/research/${ownerStudy}`),who).expect(404);
  await auth(request(app).post(`/api/v1/research/${ownerStudy}/members`)).send({user_id:faculty}).expect(204);
  await auth(request(app).get(`/api/v1/research/${ownerStudy}`),'faculty').expect(200);
  await auth(request(app).delete(`/api/v1/research/${ownerStudy}/members/${faculty}`)).expect(204);
  await auth(request(app).get(`/api/v1/research/${ownerStudy}`),'faculty').expect(404);
  const created=await auth(request(app).post('/api/v1/research'),'faculty').send({title:'Faculty private study'}).expect(201);studies.push(created.body.id);
  await auth(request(app).patch('/api/v1/users/me')).send({email:'safe@example.test',role:'staff'}).expect(400);
  await auth(request(app).post('/api/v1/research'),'reviewer').send({title:'Staff impersonation'}).expect(403);
});
test('internal feedback cannot cross researcher/API/database boundaries',async()=>{
  const path=`/api/v1/research/${ownerStudy}/feedback`,body={researcher_visible_feedback:'Please revise methodology',internal_staff_notes:'PRIVATE_CANARY_83'};
  await auth(request(app).put(path),'unassigned').send(body).expect(404);
  await auth(request(app).put(path),'reviewer').send(body).expect(204);
  const researcher=await auth(request(app).get(path)).expect(200);assert.equal(researcher.body.researcher_visible_feedback,body.researcher_visible_feedback);assert.ok(!researcher.text.includes('PRIVATE_CANARY'));assert.ok(!Object.hasOwn(researcher.body,'internal_staff_notes'));
  const staff=await auth(request(app).get(path),'reviewer').expect(200);assert.equal(staff.body.internal_staff_notes,body.internal_staff_notes);
  assert.equal((await runAs(1,db=>db.query('SELECT * FROM staff_notes'))).rowCount,0);
  const catalogue=await request(app).post('/api/v1/research/search').send({keyword:'IAS'}).expect(200);assert.ok(!catalogue.text.includes('PRIVATE_CANARY'));assert.ok(!catalogue.body.some(x=>x.id===ownerStudy));
});
test('audit history is append-only with actor/target/IP and no private content',async()=>{
  await auth(request(app).patch(`/api/v1/research/${ownerStudy}`)).send({title:'IAS revised study',abstract:'PRIVATE_ABSTRACT'}).expect(200);
  const r=await admin.query("SELECT * FROM audit_history WHERE target_table='research_records' AND target_record_id=$1 AND action_type='UPDATE' ORDER BY id DESC LIMIT 1",[String(ownerStudy)]);
  assert.equal(r.rows[0].actor_ref,'1');assert.equal(r.rows[0].old_value.title,'IAS private study');assert.equal(r.rows[0].new_value.title,'IAS revised study');assert.ok(r.rows[0].request_id);assert.ok(r.rows[0].ip_address);
  assert.ok(!JSON.stringify(r.rows).includes('PRIVATE_ABSTRACT'));
  for(const sql of ['DELETE FROM audit_history',"UPDATE audit_history SET actor_ref='forged'","INSERT INTO audit_history(actor_ref,target_table,target_record_id,action_type) VALUES('fake','x','x','x')"])
    await assert.rejects(pool.query(sql),{code:'42501'});
  await admin.query("CREATE FUNCTION ias_break_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit failure'; END $$");
  await admin.query('CREATE TRIGGER ias_break BEFORE INSERT ON audit_history FOR EACH ROW EXECUTE FUNCTION ias_break_audit()');
  try{await auth(request(app).patch(`/api/v1/research/${ownerStudy}`)).send({title:'Must rollback'}).expect(500);}
  finally{await admin.query('DROP TRIGGER ias_break ON audit_history');await admin.query('DROP FUNCTION ias_break_audit()');}
  assert.equal((await admin.query('SELECT title FROM research_records WHERE id=$1',[ownerStudy])).rows[0].title,'IAS revised study');
});
test('Argon2id salts, malformed hashes, Unicode, legacy verification and upgrade',async()=>{
  const a=await hashPassword('研究🔒password'),b=await hashPassword('研究🔒password');assert.notEqual(a,b);assert.ok(a.startsWith('$argon2id$'));assert.equal(needsRehash(a),false);
  assert.equal(await verifyPassword('研究🔒password',a),true);assert.equal(await verifyPassword('wrong',a),false);assert.equal(await verifyPassword('x','bad:hash'),false);
  const salt=randomBytes(16).toString('hex'),old=`${salt}:${scryptSync(process.env.DEMO_PASSWORD,salt,64).toString('hex')}`;
  await admin.query('UPDATE users SET password_hash=$1 WHERE id=$2',[old,faculty]);
  await request(app).post('/api/v1/auth/login').send({email:'ias-faculty@example.test',password:process.env.DEMO_PASSWORD}).expect(200);
  assert.ok((await admin.query('SELECT password_hash FROM users WHERE id=$1',[faculty])).rows[0].password_hash.startsWith('$argon2id$'));
});
test('temporary activation is staff-provisioned, expiring, hashed and single-use',async()=>{
  const email=`invite-${randomUUID()}@example.test`;
  await auth(request(app).post('/api/v1/admin/invitations')).send({email,role:'faculty'}).expect(403);
  const invitation=await auth(request(app).post('/api/v1/admin/invitations'),'reviewer').send({email,role:'faculty'}).expect(201);
  users.push(invitation.body.user_id);const token=invitation.body.activation_token;
  const stored=await admin.query('SELECT token_hash FROM account_activations WHERE user_id=$1',[invitation.body.user_id]);assert.notEqual(stored.rows[0].token_hash,token);
  await request(app).post('/api/v1/auth/login').send({email,password:process.env.DEMO_PASSWORD}).expect(401);
  await request(app).post('/api/v1/auth/activate').send({token,password:process.env.DEMO_PASSWORD}).expect(204);
  await request(app).post('/api/v1/auth/activate').send({token,password:process.env.DEMO_PASSWORD}).expect(400);
  await request(app).post('/api/v1/auth/login').send({email,password:process.env.DEMO_PASSWORD}).expect(200);
  const expired=await auth(request(app).post('/api/v1/admin/invitations'),'reviewer').send({email:`expired-${randomUUID()}@example.test`,role:'student'}).expect(201);users.push(expired.body.user_id);
  await admin.query("UPDATE account_activations SET expires_at=now()-interval '1 second' WHERE user_id=$1",[expired.body.user_id]);
  await request(app).post('/api/v1/auth/activate').send({token:expired.body.activation_token,password:process.env.DEMO_PASSWORD}).expect(400);
  await admin.query('TRUNCATE login_attempts');
});
test('shared failed-login window is atomic across workers and expires individually',async()=>{
  const email=`${randomUUID()}@example.test`,ip='192.0.2.90',reservations=[];
  const r=await Promise.all(Array.from({length:10},async()=>{const id=randomUUID();reservations.push(id);return reserveLogin(pool,email,ip,id);}));assert.equal(r.filter(Boolean).length,5);
  await admin.query("UPDATE login_attempts SET attempted_at=clock_timestamp()-interval '901 seconds' WHERE request_id=ANY($1::uuid[])",[reservations]);
  assert.equal(await reserveLogin(pool,email,ip,randomUUID()),true);
  // Real HTTP clients in different app instances share the same account/IP window.
  await admin.query('TRUNCATE login_attempts');
  const second=createApp(pool);
  for(let i=0;i<5;i++)await request(i%2?second:app).post('/api/v1/auth/login').send({email:'missing-ias@example.test',password:'wrong'}).expect(401);
  await request(second).post('/api/v1/auth/login').send({email:'missing-ias@example.test',password:'wrong'}).expect(429);
  await admin.query('TRUNCATE login_attempts');
});
test('atomic token bucket cannot overshoot and refills elapsed capacity',async()=>{
  const key=randomUUID();const take=()=>pool.query('SELECT crm_take_token($1,3,1) AS allowed',[key]);
  const r=await Promise.all(Array.from({length:12},take));assert.equal(r.filter(x=>x.rows[0].allowed).length,3);
  await admin.query("UPDATE rate_buckets SET updated_at=clock_timestamp()-interval '2 seconds' WHERE key=$1",[key]);
  assert.equal((await take()).rows[0].allowed,true);
});
test('PDF/document validation rejects spoofing, encrypted archives and oversized buffers',async()=>{
  assert.equal(await validateDocument(pdf,'research.pdf'),'application/pdf');
  for(const [bytes,name] of [[Buffer.from('MZ fake executable'),'fake.pdf'],[pdf,'../escape.pdf'],[pdf,'research.docx'],[Buffer.alloc(MAX_DOCUMENT_BYTES+1),'large.pdf']])await assert.rejects(validateDocument(bytes,name));
});
test('private upload/download checks membership and assignment; failed scanner leaves no object',async()=>{
  await admin.query('TRUNCATE rate_buckets');
  const path=`/api/v1/research/${ownerStudy}/documents`;
  const upload=(application,who='owner',body=pdf,name='research.pdf')=>auth(request(application).post(path).query({filename:name}),who).set('Content-Type','application/octet-stream').send(body);
  await upload(app,'faculty').expect(404);
  const result=await upload(app).expect(201);assert.equal(objects.size,1);assert.ok(!Object.hasOwn(result.body,'object_key'));
  const url=`${path}/${result.body.id}/url`;
  await auth(request(app).get(url),'unassigned').expect(404);await auth(request(app).get(url),'faculty').expect(404);
  const allowed=await auth(request(app).get(url),'reviewer').expect(200);assert.equal(allowed.body.expires_in,600);
  await upload(app,'owner',Buffer.from('MZ fake'),'disguised.pdf').expect(400);
  const rejected=createApp(pool,{objectStore:store,scanner:async()=>false});await upload(rejected).expect(400);assert.equal(objects.size,1);
  const unavailable=createApp(pool,{objectStore:store});await upload(unavailable).expect(503);
  await admin.query('TRUNCATE rate_buckets');
  await upload(app,'owner',Buffer.alloc(MAX_DOCUMENT_BYTES+1)).expect(413);assert.equal(objects.size,1);
});
