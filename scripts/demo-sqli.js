import pg from 'pg';
import request from 'supertest';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {vulnerableApp} from '../demo/vulnerable-app.js';
import {createApp} from '../src/app.js';
if(process.env.ALLOW_ISOLATED_DEMO!=='yes') throw Error('Requires ALLOW_ISOLATED_DEMO=yes');
const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
const schema='demo_'+randomBytes(6).toString('hex');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema},public`});
try {
 await admin.query(`CREATE SCHEMA ${schema} AUTHORIZATION crm_app`);
 // Clone the migrated column definitions so this fixture follows the real search contract.
 // Public supplies the migrated normalizer and pg_trgm operators; local fixture tables shadow operational tables.
 await admin.query(`CREATE TABLE ${schema}.research_records (LIKE public.research_records INCLUDING GENERATED); CREATE TABLE ${schema}.users(id integer,email text,password_hash text,role text)`);
 await admin.query(`INSERT INTO ${schema}.research_records(id,author_id,title,abstract,status) VALUES(1,1,'Public synthetic record','Public abstract','Approved')`);
 await admin.query(`INSERT INTO ${schema}.users VALUES(99,'synthetic@example.test','FAKE_HASH_NOT_A_CREDENTIAL','student')`);
 await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO crm_app`);
 const payload={keyword:"' UNION SELECT id, email, password_hash, role FROM users--"};
 const before=await request(vulnerableApp(db)).post('/api/v1/research/search').send(payload);
 const secure=createApp(db);
 const normal=await request(secure).post('/api/v1/research/search').send({keyword:'Public synthetic record'});
 assert.equal(normal.status,200);assert.equal(normal.body.length,1);assert.equal(normal.body[0].id,1);
 const after=await request(secure).post('/api/v1/research/search').send(payload);
 assert.equal(before.status,200);assert.ok(before.body.some(r=>r.title==='synthetic@example.test'));
 assert.equal(after.status,200);assert.deepEqual(after.body,[]);
 console.log(JSON.stringify({scenario:'Isolated synthetic SQL injection',payload,normal_search:{status:normal.status,count:normal.body.length},before:{status:before.status,body:before.body},after:{status:after.status,body:after.body},result:'PASS'},null,2));
} finally {await db.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
