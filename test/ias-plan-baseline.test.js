// Safe API-contract baseline: synthetic mocked dependencies, no database/cloud access.
// This is not evidence for RLS, Argon2id, uploads, Android or production TLS.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app.js';

function fixture({role='student', fail=false}={}) {
  const calls=[];
  const db={async query(sql,params) {
    calls.push({sql,params});
    if(sql.includes('crm_take_token'))return {rowCount:1,rows:[{allowed:true}]};
    if(fail&&sql.includes('crm_session_user')) throw Object.assign(new Error('SECRET_CANARY /private/database.sql SELECT password_hash'),{code:'XX000'});
    if(sql.includes('crm_session_user'))return {rowCount:1,rows:[{id:1,role}]};
    if(sql.includes('FROM research_records'))return {rowCount:0,rows:[]};
    return {rowCount:0,rows:[]};
  }};
  db.connect=async()=>({query:db.query,release(){}});
  return {app:createApp(db,{algorithmRunner:async()=>({status:'OK'})}),calls};
}
const auth='Bearer '+'a'.repeat(64);

test('baseline: anonymous private research denied before record access',async()=>{
  const {app,calls}=fixture();
  await request(app).get('/api/v1/research/2').expect(401);
  assert.ok(!calls.some(c=>c.sql.includes('research_records')));
});

test('baseline: researcher denied staff audit endpoint',async()=>{
  const {app,calls}=fixture();
  await request(app).get('/api/v1/admin/audit-logs').set('Authorization',auth).expect(403);
  assert.ok(!calls.some(c=>c.sql.includes('audit_logs')));
});

test('baseline: private research lookup binds identity in parameterized API predicate',async()=>{
  const {app,calls}=fixture();
  await request(app).get('/api/v1/research/2').set('Authorization',auth).expect(404);
  const query=calls.find(x=>x.sql.includes('FROM research_records'));
  assert.deepEqual(query.params,['2',1]);
  assert.match(query.sql,/author_id=\$2/);
  assert.doesNotMatch(query.sql,/SELECT \*/);
});

test('baseline: dependency failure returns sanitized JSON',async()=>{
  const {app}=fixture({fail:true});
  const result=await request(app).get('/api/v1/research/2').set('Authorization',auth).expect(500);
  assert.equal(result.body.error,'Internal server error');
  assert.equal(result.body.request_id,result.headers['x-request-id']);
  assert.doesNotMatch(result.text,/SECRET_CANARY|private\/database|SELECT|password_hash|stack/i);
});

test('baseline: malformed and oversized JSON rejected',async()=>{
  const {app,calls}=fixture();
  await request(app).post('/api/v1/research/search').set('Content-Type','application/json').send('{broken').expect(400);
  await request(app).post('/api/v1/research/search').send({keyword:'x'.repeat(20_000)}).expect(413);
  assert.equal(calls.length,0);
});
