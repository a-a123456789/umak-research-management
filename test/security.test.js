import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import {createApp} from '../src/app.js';
if(process.env.ALLOW_SYNTHETIC_SETUP!=='yes') throw Error('Tests require an isolated synthetic database');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const admin=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL});
const app=createApp(db);let a,b,s;
const bearer=t=>`Bearer ${t}`;
before(async()=>{
  for(const [email,assign] of [['student1@example.test',v=>a=v],['student2@example.test',v=>b=v],['staff@example.test',v=>s=v]]) {
    const r=await request(app).post('/api/v1/auth/login').send({email,password:process.env.DEMO_PASSWORD});assert.equal(r.status,200);assign(r.body.access_token);
  }
});
after(async()=>{await db.end();await admin.end();});
test('SEC-01 public search returns only approved records; exact SQL injection is neutralized',async()=>{
 const normal=await request(app).post('/api/v1/research/search').send({keyword:''});assert.equal(normal.status,200);assert.ok(normal.body.length);assert.ok(normal.body.every(r=>r.status==='Approved'));
 const r=await request(app).post('/api/v1/research/search').send({keyword:"' UNION SELECT id, email, password_hash, role FROM users--"});assert.equal(r.status,200);assert.deepEqual(r.body,[]);
 assert.equal((await request(app).post('/api/v1/research/search').send({keyword:{'$ne':null}})).status,400);
});
test('authentication rejects missing, invalid, expired and revoked tokens',async()=>{
 assert.equal((await request(app).get('/api/v1/research/2')).status,401);
 assert.equal((await request(app).get('/api/v1/research/2').set('Authorization',bearer('f'.repeat(64)))).status,401);
 const login=await request(app).post('/api/v1/auth/login').send({email:'student1@example.test',password:process.env.DEMO_PASSWORD});
 await request(app).post('/api/v1/auth/logout').set('Authorization',bearer(login.body.access_token)).expect(204);
 await request(app).get('/api/v1/research/2').set('Authorization',bearer(login.body.access_token)).expect(401);
 const login2=await request(app).post('/api/v1/auth/login').send({email:'student1@example.test',password:process.env.DEMO_PASSWORD});
 await admin.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=encode(sha256($1::bytea),'hex')",[Buffer.from(login2.body.access_token)]);
 await request(app).get('/api/v1/research/2').set('Authorization',bearer(login2.body.access_token)).expect(401);
});
test('SEC-02 own record succeeds; another student record hidden; staff allowed',async()=>{
 await request(app).get('/api/v1/research/2').set('Authorization',bearer(a)).expect(200);
 await request(app).get('/api/v1/research/3').set('Authorization',bearer(a)).expect(404);
 await request(app).get('/api/v1/research/3').set('Authorization',bearer(b)).expect(200);
 await request(app).get('/api/v1/research/3').set('Authorization',bearer(s)).expect(200);
 await request(app).get('/api/v1/research/not-an-id').set('Authorization',bearer(a)).expect(400);
});
test('record creation binds ownership; blocks privilege fields; logs changes',async()=>{
 const r=await request(app).post('/api/v1/research').set('Authorization',bearer(a)).send({title:'Created synthetic record'});assert.equal(r.status,201);assert.equal(r.body.author_id,1);assert.equal(r.body.status,'Draft');
 await request(app).post('/api/v1/research').set('Authorization',bearer(a)).send({title:'Invalid',author_id:2,status:'Approved'}).expect(400);
 await request(app).get('/api/v1/admin/audit-logs').set('Authorization',bearer(a)).expect(403);
 const logs=await request(app).get('/api/v1/admin/audit-logs').set('Authorization',bearer(s)).expect(200);assert.ok(logs.body.some(l=>l.action==='research.created'));
});
test('consent: optional choices can both be false; identity/time cannot be supplied',async()=>{
 const body={policy_version:'2026-10-v1',choices:{institutional_analytics:false,email_notifications:false}};
 const r=await request(app).post('/api/v1/users/consent').set('Authorization',bearer(a)).send(body);assert.equal(r.status,201);assert.equal(r.body.user_id,1);assert.ok(Number.isFinite(Date.parse(r.body.recorded_at)));assert.deepEqual(r.body.choices,body.choices);
 for(const bad of [{...body,user_id:2},{...body,recorded_at:'2020-01-01'},{...body,policy_version:'unknown'},{...body,choices:{institutional_analytics:'false',email_notifications:true}}]) await request(app).post('/api/v1/users/consent').set('Authorization',bearer(a)).send(bad).expect(400);
});
test('SEC-11 runtime database role cannot alter schema or modify audit history',async()=>{
 await assert.rejects(db.query("UPDATE audit_logs SET action='forged'"),{code:'42501'});
 await assert.rejects(db.query('DELETE FROM audit_logs'),{code:'42501'});
 await assert.rejects(db.query('DROP TABLE audit_logs'),{code:'42501'});
});
test('deletion requires staff review; cascades personal data and invalidates sessions',async()=>{
 const r=await request(app).post('/api/v1/users/deletion-requests').set('Authorization',bearer(b)).send({}).expect(202);
 const duplicate=await request(app).post('/api/v1/users/deletion-requests').set('Authorization',bearer(b)).send({}).expect(202);assert.equal(duplicate.body.id,r.body.id);
 const route=`/api/v1/admin/deletion-requests/${r.body.id}/complete`;
 await request(app).post(route).set('Authorization',bearer(a)).send({confirm_review:true}).expect(403);
 await request(app).post(route).set('Authorization',bearer(s)).send({}).expect(400);
 await request(app).post(route).set('Authorization',bearer(s)).send({confirm_review:true}).expect(200);
 await request(app).get('/api/v1/research/3').set('Authorization',bearer(b)).expect(401);
 for(const table of ['users','research_records','sessions','consents']) {
   const col=table==='users'?'id':table==='research_records'?'author_id':'user_id';
   const count=await admin.query(`SELECT count(*) FROM ${table} WHERE ${col}=2`);assert.equal(count.rows[0].count,'0');
 }
 const rr=await admin.query('SELECT user_id,status FROM deletion_requests WHERE id=$1',[r.body.id]);assert.equal(rr.rows[0].user_id,null);assert.equal(rr.rows[0].status,'completed');
});
test('unknown routes deny by default; malformed/oversized JSON handled',async()=>{
 await request(app).get('/api/v1/unimplemented').expect(404);
 await request(app).post('/api/v1/research/search').set('Content-Type','application/json').send('{broken').expect(400);
 await request(app).post('/api/v1/research/search').send({keyword:'x'.repeat(20000)}).expect(413);
});
test('login throttles repeated attempts with HTTP 429',async()=>{
 let r;for(let i=0;i<11;i++) r=await request(app).post('/api/v1/auth/login').send({email:'nobody@example.test',password:'incorrect'});
 assert.equal(r.status,429);
});

test('SEC-09 public search caps large synthetic result sets at 100',async()=>{
 const inserted=await admin.query("INSERT INTO research_records(author_id,title,abstract,status) SELECT 1,'cap-fixture-'||i,'Synthetic','Approved' FROM generate_series(1,105) i RETURNING id");
 try {const r=await request(app).post('/api/v1/research/search').send({keyword:'cap-fixture-'}).expect(200);assert.equal(r.body.length,100);assert.ok(r.body.every(x=>x.status==='Approved'));}
 finally {await admin.query('DELETE FROM research_records WHERE id=ANY($1::int[])',[inserted.rows.map(x=>x.id)]);}
});
