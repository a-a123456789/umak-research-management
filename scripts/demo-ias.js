import pg from 'pg';
import request from 'supertest';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app.js';
import {hashPassword} from '../src/crypto.js';
if(process.env.ALLOW_SYNTHETIC_SETUP!=='yes'||process.env.ALLOW_ISOLATED_DEMO!=='yes')throw Error('Explicit isolated synthetic demo required');
const admin=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL}),pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=createApp(pool),users=[],label=randomUUID();let study;
try{
 const tokens=[];
 for(const [name,role] of [['owner','student'],['assigned','staff'],['unassigned','staff']]){
  const email=`${name}-${label}@example.test`;
  const user=await admin.query('INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id',[email,await hashPassword(process.env.DEMO_PASSWORD),role]);users.push(user.rows[0].id);
  const login=await request(app).post('/api/v1/auth/login').send({email,password:process.env.DEMO_PASSWORD}).expect(200);tokens.push(login.body.access_token);
 }
 const auth=(r,i)=>r.set('Authorization',`Bearer ${tokens[i]}`);
 const created=await auth(request(app).post('/api/v1/research'),0).send({title:'Synthetic IAS defense study'}).expect(201);study=created.body.id;
 await admin.query('INSERT INTO review_assignments VALUES($1,$2)',[study,users[1]]);
 for(const [name,i,status] of [['owner',0,200],['assigned staff',1,200],['unassigned staff',2,404]]){
  await auth(request(app).get(`/api/v1/research/${study}`),i).expect(status);console.log(`${name}: private study HTTP ${status}`);
 }
 const path=`/api/v1/research/${study}/feedback`;
 await auth(request(app).put(path),1).send({researcher_visible_feedback:'Please clarify methods',internal_staff_notes:'SYNTHETIC INTERNAL CANARY'}).expect(204);
 const visible=await auth(request(app).get(path),0).expect(200);assert.ok(!Object.hasOwn(visible.body,'internal_staff_notes'));console.log('Researcher feedback contains internal notes: false');
 assert.equal((await pool.query('SELECT * FROM research_records')).rowCount,0);console.log('Unscoped runtime SQL rows visible: 0 (RLS)');
 await assert.rejects(pool.query('DELETE FROM audit_history'),{code:'42501'});console.log('Runtime audit deletion: denied (42501)');
 console.log('PASS — real PostgreSQL/API authorization and feedback demo. Cloud and Android are separate deployment checks.');
}finally{
 if(study)await admin.query('DELETE FROM research_records WHERE id=$1',[study]);if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::int[])',[users]);await pool.end();await admin.end();
}
