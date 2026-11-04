import {parseSearch,searchResearch} from './research/search.js';
import {consultationRouter} from './consultations/routes.js';
import {createAlgorithmRunner} from './algorithm.js';
import express from 'express';
import helmet from 'helmet';
import { randomBytes,randomUUID } from 'node:crypto';
import {verifyPassword,hashPassword,needsRehash,tokenHash} from './crypto.js';
import {scopedDatabase} from './security/context.js';
import {requestLimiter,reserveLogin} from './security/limiter.js';
import {z,id,login,research,feedback,member,validate,search,consent,empty,algorithm} from './security/validation.js';
import {documentRouter} from './storage/routes.js';
import {publicContentRouter} from './public-content.js';
const dummyHash = await hashPassword('dummy-unusable-account-password');
const isId=value=>id.safeParse(value).success;
export function createApp(pool,{algorithmRunner=createAlgorithmRunner(),objectStore=null,scanner=null}={}) {
  const {db,storage}=scopedDatabase(pool);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req,res,next)=>{
    req.requestId=randomUUID();res.set('X-Request-ID',req.requestId);
    storage.run({requestId:req.requestId,ip:req.ip},next);
  });
  const smallBody=express.json({limit:'16kb'});
  app.use((req,res,next)=>req.path==='/api/v1/algorithm/solve'?next():smallBody(req,res,next));
  app.use((req,res,next)=>req.path==='/health'?next():requestLimiter(db)(req,res,next));
  app.get('/health', (_req,res) => res.json({status:'ok'}));
  app.use('/api/v1/public',publicContentRouter());
  const auth = async (req,res,next) => {
    const token = req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return res.status(401).json({error:'Authentication required'});
    const result = await db.query('SELECT id,role FROM crm_session_user($1)',[tokenHash(token)]);
    if (!result.rowCount) return res.status(401).json({error:'Authentication required'});
    req.user=result.rows[0];storage.getStore().user=req.user;next();
  };
  const staff = (req,res,next) => req.user.role==='staff' ? next() : res.status(403).json({error:'Forbidden'});
  const solve=algorithmRunner;
  app.post('/api/v1/algorithm/solve',auth,staff,express.json({limit:'2mb'}),validate(algorithm),async(req,res)=>{
    const abort=new AbortController();
    const closed=()=>{if(!res.writableEnded)abort.abort();};
    res.on('close',closed);
    try {const result=await solve(req.body??{},abort.signal);res.status(result.status==='ERROR'?400:200).json(result);}
    catch(e){if(!res.destroyed)res.status(e.httpStatus||500).json({status:'ERROR',error_type:e.code||'WORKER_FAILED',message:'Algorithm job could not complete'});}
    finally {res.removeListener('close',closed);}
  });
  app.post('/api/v1/auth/login',validate(login),async(req,res)=>{
    const {email,password}=req.validated.body;
    if(!await reserveLogin(db,email,req.ip,req.requestId)){
      res.set('Retry-After','900');return res.status(429).json({error:'Too many failed login attempts',request_id:req.requestId});
    }
    const result=await db.query('SELECT id,password_hash FROM crm_login_user($1)',[email]);
    let valid;
    try{valid=await verifyPassword(password,result.rows[0]?.password_hash??dummyHash);}
    catch(e){await db.query('SELECT crm_finish_login($1)',[req.requestId]);throw e;}
    if(!result.rowCount||!valid)return res.status(401).json({error:'Invalid credentials'});
    const user=result.rows[0];
    if(needsRehash(user.password_hash))await db.query('SELECT crm_rehash_password($1,$2,$3)',[user.id,user.password_hash,await hashPassword(password)]);
    await db.query('SELECT crm_finish_login($1)',[req.requestId]);
    const token=randomBytes(32).toString('hex');
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[tokenHash(token),user.id]);
    res.json({access_token:token,token_type:'Bearer',expires_in:900});
  });
  app.post('/api/v1/admin/invitations',auth,staff,validate(z.strictObject({email:z.email().max(254).transform(x=>x.toLowerCase()),role:z.enum(['student','faculty'])})),async(req,res)=>{
    const token=randomBytes(32).toString('hex'),b=req.validated.body;
    const r=await db.query('SELECT crm_invite($1,$2,$3) AS user_id',[b.email,b.role,tokenHash(token)]);
    res.set('Cache-Control','no-store');res.status(201).json({user_id:r.rows[0].user_id,activation_token:token,expires_in:900});
  });
  app.post('/api/v1/auth/activate',validate(z.strictObject({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).max(128)})),async(req,res)=>{
    const b=req.validated.body;
    if(!await reserveLogin(db,'activation',req.ip,req.requestId)){res.set('Retry-After','900');return res.status(429).json({error:'Too many attempts'});}
    const r=await db.query('SELECT crm_activate($1,$2) AS activated',[tokenHash(b.token),await hashPassword(b.password)]);
    if(!r.rows[0].activated)return res.status(400).json({error:'Invalid or expired activation'});
    await db.query('SELECT crm_finish_login($1)',[req.requestId]);res.sendStatus(204);
  });
  app.post('/api/v1/auth/logout',auth,validate(empty),async(req,res)=>{
    await db.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(req.get('authorization').slice(7))]);res.sendStatus(204);
  });
  app.get('/api/v1/users/me',auth,async(req,res)=>{
    const r=await db.query('SELECT id,email,role FROM users WHERE id=$1',[req.user.id]);res.json(r.rows[0]);
  });
  app.patch('/api/v1/users/me',auth,validate(z.strictObject({email:z.email().max(254).transform(x=>x.toLowerCase())})),async(req,res)=>{
    const r=await db.query('UPDATE users SET email=$1 WHERE id=$2 RETURNING id,email,role',[req.validated.body.email,req.user.id]);res.json(r.rows[0]);
  });
  app.patch('/api/v1/research/:id',auth,validate(research),async(req,res)=>{
    if(!isId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const b=req.validated.body;
    const r=await db.query('UPDATE research_records SET title=$1,abstract=$2,research_year=$3,department=$4 WHERE id=$5 AND crm_member(id) RETURNING id,author_id,title,abstract,status,research_year,department',[b.title,b.abstract,b.research_year,b.department,req.params.id]);
    if(!r.rowCount)return res.status(404).json({error:'Record not found'});res.json(r.rows[0]);
  });
  app.post('/api/v1/research/:id/members',auth,validate(member),async(req,res)=>{
    if(!isId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const r=await db.query('SELECT id FROM research_records WHERE id=$1 AND author_id=$2',[req.params.id,req.user.id]);
    if(!r.rowCount)return res.status(404).json({error:'Record not found'});
    const target=await db.query("SELECT 1 WHERE crm_researcher_user($1)",[req.validated.body.user_id]);
    if(!target.rowCount)return res.status(400).json({error:'Invalid member'});
    await db.query('INSERT INTO study_members VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.validated.body.user_id]);res.sendStatus(204);
  });
  app.delete('/api/v1/research/:id/members/:memberId',auth,async(req,res)=>{
    if(!isId(req.params.id)||!isId(req.params.memberId))return res.status(400).json({error:'Invalid ID'});
    const r=await db.query('DELETE FROM study_members WHERE study_id=$1 AND user_id=$2 AND crm_owns_study(study_id) RETURNING user_id',[req.params.id,req.params.memberId]);
    if(!r.rowCount)return res.status(404).json({error:'Member not found'});res.sendStatus(204);
  });
  app.get('/api/v1/research/:id/feedback',auth,async(req,res)=>{
    if(!isId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const access=await db.query('SELECT id FROM research_records WHERE id=$1',[req.params.id]);
    if(!access.rowCount)return res.status(404).json({error:'Record not found'});
    const r=await db.query('SELECT researcher_visible_feedback,updated_at FROM research_feedback WHERE study_id=$1',[req.params.id]);
    const output=r.rows[0]??{researcher_visible_feedback:'',updated_at:null};
    if(req.user.role==='staff'){
      const notes=await db.query('SELECT internal_staff_notes FROM staff_notes WHERE study_id=$1',[req.params.id]);output.internal_staff_notes=notes.rows[0]?.internal_staff_notes??'';
    }
    res.json(output);
  });
  app.put('/api/v1/research/:id/feedback',auth,staff,validate(feedback),async(req,res)=>{
    if(!isId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const c=await db.connect();
    try{
      await c.query('BEGIN');
      const access=await c.query('SELECT id FROM research_records WHERE id=$1 AND crm_assigned(id)',[req.params.id]);
      if(!access.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Record not found'});}
      const b=req.validated.body;
      await c.query('INSERT INTO research_feedback(study_id,researcher_visible_feedback) VALUES($1,$2) ON CONFLICT(study_id) DO UPDATE SET researcher_visible_feedback=EXCLUDED.researcher_visible_feedback,updated_at=clock_timestamp()',[req.params.id,b.researcher_visible_feedback]);
      await c.query('INSERT INTO staff_notes(study_id,internal_staff_notes) VALUES($1,$2) ON CONFLICT(study_id) DO UPDATE SET internal_staff_notes=EXCLUDED.internal_staff_notes',[req.params.id,b.internal_staff_notes]);
      await c.query('COMMIT');res.sendStatus(204);
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  });
  app.get('/api/v1/admin/audit-history',auth,staff,async(_req,res)=>{
    res.json((await db.query('SELECT id,actor_ref,target_table,target_record_id,action_type,old_value,new_value,recorded_at,request_id,ip_address FROM audit_history ORDER BY id DESC LIMIT 100')).rows);
  });
  app.use('/api/v1/consultations',consultationRouter(db,auth,staff));
  app.use('/api/v1/research/:studyId/documents',documentRouter(db,auth,{objectStore,scanner}));
  app.post('/api/v1/research/search',validate(search),async(req,res)=>{
    const args=parseSearch(req.body);
    if(!args)return res.status(400).json({error:'Invalid search parameters'});
    res.json(await searchResearch(db,args));
  });
  app.post('/api/v1/research/duplicates',auth,staff,validate(search),async(req,res)=>{
    const args=parseSearch(req.body,{duplicates:true});
    if(!args)return res.status(400).json({error:'Invalid duplicate search parameters'});
    res.json(await searchResearch(db,args,{duplicates:true}));
  });
  app.get('/api/v1/research/:id',auth,async(req,res)=>{
    if (!isId(req.params.id)) return res.status(400).json({error:'Invalid ID'});
    const result=await db.query("SELECT id,author_id,title,abstract,status,research_year,department FROM research_records WHERE id=$1 AND (author_id=$2 OR crm_can_access(id))",[req.params.id,req.user.id]);
    if (!result.rowCount) return res.status(404).json({error:'Record not found'});
    res.json(result.rows[0]);
  });
  app.post('/api/v1/research',auth,validate(research),async(req,res)=>{
    if(!['student','faculty'].includes(req.user.role))return res.status(403).json({error:'Forbidden'});
    const {title,abstract,research_year,department}=req.validated.body;
    const client=await db.connect();
    try {
      await client.query('BEGIN');
      const r=await client.query("INSERT INTO research_records(author_id,title,abstract,status,research_year,department) VALUES($1,$2,$3,'Draft',$4,$5) RETURNING id,author_id,title,abstract,status,research_year,department",[req.user.id,title.trim(),abstract,research_year,department]);
      await client.query('INSERT INTO study_members(study_id,user_id) VALUES($1,$2)',[r.rows[0].id,req.user.id]);
      await client.query("INSERT INTO audit_logs(actor_id,action) VALUES($1,'research.created')",[req.user.id]);
      await client.query('COMMIT');res.status(201).json(r.rows[0]);
    } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
  });
  app.post('/api/v1/users/consent',auth,validate(consent),async(req,res)=>{
    const b=req.body ?? {};const c=b.choices;
    if(Object.keys(b).some(k=>!['policy_version','choices'].includes(k))||b.policy_version!=='2026-10-v1'||!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).sort().join(',')!=='email_notifications,institutional_analytics'||Object.values(c).some(v=>typeof v!=='boolean')) return res.status(400).json({error:'Provide policy_version 2026-10-v1 and two boolean choices: email_notifications, institutional_analytics'});
    const r=await db.query('INSERT INTO consents(user_id,policy_version,choices) VALUES($1,$2,$3) RETURNING id,user_id,policy_version,choices,recorded_at',[req.user.id,b.policy_version,c]);
    res.status(201).json(r.rows[0]);
  });
  app.post('/api/v1/users/deletion-requests',auth,validate(empty),async(req,res)=>{
    if(!['student','faculty'].includes(req.user.role)) return res.status(403).json({error:'Staff deletion requires a separate administrative review'});
    if(Object.keys(req.body ?? {}).length) return res.status(400).json({error:'No personal data or user_id should be supplied'});
    const r=await db.query("INSERT INTO deletion_requests(user_id) VALUES($1) ON CONFLICT(user_id) WHERE status='pending' DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id,status,requested_at",[req.user.id]);res.status(202).json(r.rows[0]);
  });
  app.post('/api/v1/admin/deletion-requests/:id/complete',auth,staff,validate(z.strictObject({confirm_review:z.literal(true)})),async(req,res)=>{
    if(!isId(req.params.id)||req.body?.confirm_review!==true||Object.keys(req.body ?? {}).some(k=>k!=='confirm_review')) return res.status(400).json({error:'Valid ID and confirm_review=true required'});
    const r=await db.query('SELECT crm_complete_deletion($1) AS completed',[req.params.id]);
    if(!r.rows[0].completed)return res.status(404).json({error:'Pending request not found'});
    res.json({status:'completed',backup_erasure:'Requires approved retention and deletion replay on restore'});
  });
  app.get('/api/v1/admin/audit-logs',auth,staff,async(_req,res)=>{
    const r=await db.query('SELECT id,action,recorded_at FROM audit_logs ORDER BY id DESC LIMIT 100');res.json(r.rows);
  });
  app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
  app.use((err,_req,res,_next)=>{
    if(err.type==='entity.parse.failed') return res.status(400).json({error:'Invalid JSON'});
    if(err.type==='entity.too.large') return res.status(413).json({error:'Request too large'});
    console.error(JSON.stringify({request_id:_req.requestId,code:err.code??err.name}));
    const status=err.code==='23505'?409:[400,413,415,503].includes(err.httpStatus)?err.httpStatus:500;
    const message={400:'Invalid document',409:'Record conflicts with an existing record',413:'Request too large',415:'Unsupported media type',503:'Service temporarily unavailable'}[status]??'Internal server error';
    res.status(status).json({error:message,request_id:_req.requestId});
  });
  return app;
}
