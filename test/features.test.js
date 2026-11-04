import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {migrate} from '../scripts/migrations.js';
import {searchResearch} from '../src/research/search.js';
if(process.env.ALLOW_SYNTHETIC_SETUP!=='yes')throw Error('Requires isolated synthetic database');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:16});
const admin=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL});
// Isolated apps avoid sharing throttling windows with other test files.
const app=createApp(db);let student,staff,other,staff2;const ids=[],users=[];
const auth=(req,token)=>req.set('Authorization',`Bearer ${token}`);
before(async()=>{
 const seeds=await admin.query("SELECT password_hash FROM users WHERE id=1");
 for(const [email,role] of [['queue-other@example.test','student'],['queue-staff@example.test','staff']]){
  const r=await admin.query('INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id',[email,seeds.rows[0].password_hash,role]);users.push(r.rows[0].id);
 }
 const tokens=[];
 for(const email of ['student1@example.test','staff@example.test','queue-other@example.test','queue-staff@example.test']){
  const r=await request(app).post('/api/v1/auth/login').send({email,password:process.env.DEMO_PASSWORD}).expect(200);tokens.push(r.body.access_token);
 }
 [student,staff,other,staff2]=tokens;
});
after(async()=>{
 await admin.query('DELETE FROM consultation_tickets WHERE requester_id=1 OR requester_id=ANY($1::int[])',[users]);
 await admin.query('DELETE FROM research_records WHERE id=ANY($1::int[])',[ids]);
 await admin.query('DELETE FROM users WHERE id=ANY($1::int[])',[users]);await db.end();await admin.end();
});
test('trigram typo retrieval, normalization, metadata filters and draft privacy',async()=>{
 for(const [title,status] of [['IoT-Based Waste Management for Campus','Approved'],['IoT-Based Waste Management Private Study','Draft']]){
  const r=await admin.query('INSERT INTO research_records(author_id,title,status,research_year,department) VALUES(1,$1,$2,2026,$3) RETURNING id',[title,status,'Computing']);ids.push(r.rows[0].id);
 }
 const r=await request(app).post('/api/v1/research/search').send({keyword:'IoT Waste Managemnt',year:2026,department:'Computing'}).expect(200);
 assert.ok(r.body.some(x=>x.id===ids[0]));assert.ok(r.body.every(x=>x.status==='Approved'));assert.ok(!r.body.some(x=>x.id===ids[1]));
 const no=await request(app).post('/api/v1/research/search').send({keyword:'IoT Waste Managemnt',year:2025}).expect(200);assert.deepEqual(no.body,[]);
 await request(app).post('/api/v1/research/duplicates').send({keyword:'IoT Waste Managemnt'}).expect(401);
 await auth(request(app).post('/api/v1/research/duplicates'),student).send({keyword:'IoT Waste Managemnt'}).expect(403);
 const duplicates=await auth(request(app).post('/api/v1/research/duplicates'),staff).send({keyword:'IoT Waste Managemnt'}).expect(200);assert.ok(duplicates.body.some(x=>x.id===ids[1]));
 const norm=await admin.query("SELECT crm_normalize_title(' ＩｏＴ---WASTE  Management ') AS title");assert.equal(norm.rows[0].title,'iot waste management');
 for(const keyword of ['IoT Waste Managemnt','IoT','i','',"%'_ OR 1=1 --"]){
  const args=[keyword,null,null,100,0];assert.deepEqual(await searchResearch(db,args),await searchResearch(db,args,{exhaustive:true}));
 }
 for(const body of [{keyword:'x',limit:101},{keyword:'x',year:'2026'},{keyword:[]},{keyword:'x',offset:-1}])await request(app).post('/api/v1/research/search').send(body).expect(400);
});
const create=async(deadline,token=student)=> (await auth(request(app).post('/api/v1/consultations'),token).send({service_type:'Research consultation',deadline_at:deadline}).expect(201)).body;
test('EDF queue uses deadline, submission and ID ties; claim is durable and audited',async()=>{
 const no=await create(null),late=await create('2026-12-10T00:00:00Z'),early=await create('2026-12-01T00:00:00Z');
 await admin.query('UPDATE consultation_tickets SET submitted_at=$1 WHERE id=ANY($2::int[])',['2026-01-01',[late.id,early.id]]);
 const q=await auth(request(app).get('/api/v1/consultations/queue'),staff).expect(200);assert.deepEqual(q.body.map(t=>t.id),[early.id,late.id,no.id]);
 await auth(request(app).get('/api/v1/consultations/queue'),student).expect(403);
 const claimed=await auth(request(app).post('/api/v1/consultations/claim-next'),staff).send({}).expect(200);assert.equal(claimed.body.id,early.id);assert.equal(claimed.body.status,'claimed');
 const fresh=createApp(db);const listed=await auth(request(fresh).get('/api/v1/consultations'),student).expect(200);assert.equal(listed.body.find(t=>t.id===early.id).status,'claimed');
 const logs=await admin.query("SELECT 1 FROM audit_logs WHERE action='consultation.claimed'");assert.ok(logs.rowCount);
 await admin.query('DELETE FROM consultation_tickets WHERE requester_id=1');
});
test('ticket scope, version conflicts, reschedule, cancel and resolve permissions',async()=>{
 const t=await create(null);
 const hidden=await auth(request(app).get('/api/v1/consultations'),other).expect(200);assert.ok(!hidden.body.some(x=>x.id===t.id));
 await auth(request(app).post(`/api/v1/consultations/${t.id}/cancel`),other).send({expected_version:1}).expect(404);
 await auth(request(app).patch(`/api/v1/consultations/${t.id}/deadline`),student).send({deadline_at:null,expected_version:1}).expect(403);
 const updated=await auth(request(app).patch(`/api/v1/consultations/${t.id}/deadline`),staff).send({deadline_at:'2026-11-01T00:00:00Z',expected_version:1}).expect(200);assert.equal(updated.body.version,2);
 await auth(request(app).patch(`/api/v1/consultations/${t.id}/deadline`),staff).send({deadline_at:null,expected_version:1}).expect(409);
 await auth(request(app).post('/api/v1/consultations/claim-next'),staff).send({}).expect(200);
 await auth(request(app).post(`/api/v1/consultations/${t.id}/resolve`),student).send({expected_version:3}).expect(403);
 await auth(request(app).post(`/api/v1/consultations/${t.id}/resolve`),staff2).send({expected_version:3}).expect(409);
 await auth(request(app).post(`/api/v1/consultations/${t.id}/resolve`),staff).send({expected_version:3}).expect(200);
 await auth(request(app).post(`/api/v1/consultations/${t.id}/cancel`),staff).send({expected_version:4}).expect(409);
 const cancel=await create(null);await auth(request(app).post(`/api/v1/consultations/${cancel.id}/cancel`),student).send({expected_version:1}).expect(200);
 for(const body of [{service_type:'x',requester_id:2},{service_type:'x',deadline_at:'2026-02-30T00:00:00Z'},{service_type:''}])await auth(request(app).post('/api/v1/consultations'),student).send(body).expect(400);
 await admin.query('DELETE FROM consultation_tickets WHERE requester_id=1');
});
test('16 concurrent claimers never assign a ticket twice; empty queue returns 204',async()=>{
 await admin.query("INSERT INTO consultation_tickets(requester_id,service_type,deadline_at) SELECT 1,'Concurrent',now()+i*interval '1 minute' FROM generate_series(1,16) i");
 const responses=await Promise.all(Array.from({length:16},()=>auth(request(app).post('/api/v1/consultations/claim-next'),staff).send({})));
 assert.ok(responses.every(r=>r.status===200));assert.equal(new Set(responses.map(r=>r.body.id)).size,16);
 await auth(request(app).post('/api/v1/consultations/claim-next'),staff).send({}).expect(204);
});
test('ticket mutation rolls back if audit insertion fails',async()=>{
 const wrapped={query:(...args)=>db.query(...args),connect:async()=>{
  const c=await db.connect();return {release:()=>c.release(),query:(sql,args)=>sql.startsWith('INSERT INTO audit_logs')?Promise.reject(Error('Synthetic audit failure')):c.query(sql,args)};
 }};
 const failing=createApp(wrapped);const count=await admin.query('SELECT count(*) FROM consultation_tickets');
 await auth(request(failing).post('/api/v1/consultations'),student).send({service_type:'Rollback'}).expect(500);
 assert.equal((await admin.query('SELECT count(*) FROM consultation_tickets')).rows[0].count,count.rows[0].count);
});

test('migration backfills existing titles, preserves visibility and is repeatable',async()=>{
 const c=await admin.connect();
 try{
  await c.query('BEGIN');await c.query('CREATE SCHEMA migration_feature_test');await c.query('SET LOCAL search_path TO migration_feature_test,public');
  await c.query('CREATE TABLE users(id integer PRIMARY KEY)');
  await c.query("CREATE TABLE research_records(id integer PRIMARY KEY,author_id integer REFERENCES users,title text,abstract text,status text)");
  await c.query('INSERT INTO users VALUES(1)');
  await c.query("INSERT INTO research_records VALUES(1,1,'IoT-Based Waste Management','','Approved')");
  await migrate(c);await migrate(c);
  const r=await c.query('SELECT * FROM research_records');assert.equal(r.rows[0].normalized_title,'iot based waste management');assert.equal(r.rows[0].status,'Approved');
  assert.equal((await c.query('SELECT count(*) FROM schema_migrations')).rows[0].count,'1');
 }finally{await c.query('ROLLBACK');c.release();}
});
test('locked earliest ticket is skipped and becomes eligible again after rollback',async()=>{
 await admin.query('DELETE FROM consultation_tickets WHERE requester_id=1');
 const first=await create('2026-01-01T00:00:00Z'),second=await create('2026-02-01T00:00:00Z');
 const c=await db.connect();
 try{
  await c.query('BEGIN');await c.query('SELECT id FROM consultation_tickets WHERE id=$1 FOR UPDATE',[first.id]);
  const r=await auth(request(app).post('/api/v1/consultations/claim-next'),staff).send({}).expect(200);assert.equal(r.body.id,second.id);
 }finally{await c.query('ROLLBACK');c.release();}
 const r=await auth(request(app).post('/api/v1/consultations/claim-next'),staff).send({}).expect(200);assert.equal(r.body.id,first.id);
});
test('search threshold is transaction-local and does not leak pooled session settings',async()=>{
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
 try{
  await pool.query("SET pg_trgm.similarity_threshold=0.9");
  const results=await searchResearch(pool,['IoT Waste Managemnt',null,null,100,0]);
  assert.ok(results.some(x=>x.id===ids[0]));
  assert.equal((await pool.query('SHOW pg_trgm.similarity_threshold')).rows[0]['pg_trgm.similarity_threshold'],'0.9');
 }finally{await pool.end();}
});
