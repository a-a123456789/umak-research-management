import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { verifyPassword, hashPassword, tokenHash } from './crypto.js';
const dummyHash = hashPassword('dummy-unusable-account-password');
const isId = value => /^[1-9][0-9]*$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) <= 2147483647;
export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({limit:'16kb'}));
  app.use(rateLimit({windowMs:60_000,limit:100,standardHeaders:'draft-8',legacyHeaders:false}));
  app.get('/health', (_req,res) => res.json({status:'ok'}));
  const auth = async (req,res,next) => {
    const token = req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return res.status(401).json({error:'Authentication required'});
    const result = await db.query('SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()',[tokenHash(token)]);
    if (!result.rowCount) return res.status(401).json({error:'Authentication required'});
    req.user=result.rows[0];next();
  };
  const staff = (req,res,next) => req.user.role==='staff' ? next() : res.status(403).json({error:'Forbidden'});
  app.post('/api/v1/auth/login',rateLimit({windowMs:60_000,limit:10,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{
    const {email,password} = req.body ?? {};
    if (typeof email!=='string' || email.length>254 || typeof password!=='string' || password.length>128) return res.status(400).json({error:'Invalid credentials format'});
    const result = await db.query('SELECT id,password_hash FROM users WHERE email=$1',[email]);
    const valid = verifyPassword(password,result.rows[0]?.password_hash ?? dummyHash);
    if (!result.rowCount || !valid) return res.status(401).json({error:'Invalid credentials'});
    const token=randomBytes(32).toString('hex');
    await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[tokenHash(token),result.rows[0].id]);
    res.json({access_token:token,token_type:'Bearer',expires_in:3600});
  });
  app.post('/api/v1/auth/logout',auth,async(req,res)=>{
    await db.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(req.get('authorization').slice(7))]);res.sendStatus(204);
  });
  app.post('/api/v1/research/search',async(req,res)=>{
    const keyword=req.body?.keyword;
    if (typeof keyword!=='string' || keyword.length>200) return res.status(400).json({error:'keyword must be a string of at most 200 characters'});
    const result=await db.query("SELECT id,title,abstract,status FROM research_records WHERE status='Approved' AND title ILIKE $1",[`%${keyword}%`]);
    res.json(result.rows);
  });
  app.get('/api/v1/research/:id',auth,async(req,res)=>{
    if (!isId(req.params.id)) return res.status(400).json({error:'Invalid ID'});
    const result=await db.query("SELECT id,author_id,title,abstract,status FROM research_records WHERE id=$1 AND (author_id=$2 OR $3='staff')",[req.params.id,req.user.id,req.user.role]);
    if (!result.rowCount) return res.status(404).json({error:'Record not found'});
    res.json(result.rows[0]);
  });
  app.post('/api/v1/research',auth,async(req,res)=>{
    const {title,abstract=''}=req.body ?? {};
    if (typeof title!=='string'||!title.trim()||title.length>200||typeof abstract!=='string'||abstract.length>4000||Object.keys(req.body).some(k=>!['title','abstract'].includes(k))) return res.status(400).json({error:'Invalid record'});
    const client=await db.connect();
    try {
      await client.query('BEGIN');
      const r=await client.query("INSERT INTO research_records(author_id,title,abstract,status) VALUES($1,$2,$3,'Draft') RETURNING id,author_id,title,abstract,status",[req.user.id,title.trim(),abstract]);
      await client.query("INSERT INTO audit_logs(actor_id,action) VALUES($1,'research.created')",[req.user.id]);
      await client.query('COMMIT');res.status(201).json(r.rows[0]);
    } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
  });
  app.post('/api/v1/users/consent',auth,async(req,res)=>{
    const b=req.body ?? {};const c=b.choices;
    if(Object.keys(b).some(k=>!['policy_version','choices'].includes(k))||b.policy_version!=='2026-10-v1'||!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).sort().join(',')!=='email_notifications,institutional_analytics'||Object.values(c).some(v=>typeof v!=='boolean')) return res.status(400).json({error:'Provide policy_version 2026-10-v1 and two boolean choices: email_notifications, institutional_analytics'});
    const r=await db.query('INSERT INTO consents(user_id,policy_version,choices) VALUES($1,$2,$3) RETURNING id,user_id,policy_version,choices,recorded_at',[req.user.id,b.policy_version,c]);
    res.status(201).json(r.rows[0]);
  });
  app.post('/api/v1/users/deletion-requests',auth,async(req,res)=>{
    if(req.user.role!=='student') return res.status(403).json({error:'Staff deletion requires a separate administrative review'});
    if(Object.keys(req.body ?? {}).length) return res.status(400).json({error:'No personal data or user_id should be supplied'});
    const r=await db.query("INSERT INTO deletion_requests(user_id) VALUES($1) ON CONFLICT(user_id) WHERE status='pending' DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id,status,requested_at",[req.user.id]);res.status(202).json(r.rows[0]);
  });
  app.post('/api/v1/admin/deletion-requests/:id/complete',auth,staff,async(req,res)=>{
    if(!isId(req.params.id)||req.body?.confirm_review!==true||Object.keys(req.body ?? {}).some(k=>k!=='confirm_review')) return res.status(400).json({error:'Valid ID and confirm_review=true required'});
    const client=await db.connect();
    try {
      await client.query('BEGIN');
      const r=await client.query('SELECT user_id,status FROM deletion_requests WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!r.rowCount||r.rows[0].status!=='pending') {await client.query('ROLLBACK');return res.status(404).json({error:'Pending request not found'});}
      await client.query("UPDATE deletion_requests SET status='completed',completed_at=now() WHERE id=$1",[req.params.id]);
      await client.query("DELETE FROM users WHERE id=$1 AND role='student'",[r.rows[0].user_id]);
      await client.query("INSERT INTO audit_logs(actor_id,action) VALUES($1,'deletion.completed')",[req.user.id]);
      await client.query('COMMIT');res.json({status:'completed',backup_erasure:'Not implemented; production retention procedure required'});
    } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
  });
  app.get('/api/v1/admin/audit-logs',auth,staff,async(_req,res)=>{
    const r=await db.query('SELECT id,action,recorded_at FROM audit_logs ORDER BY id DESC LIMIT 100');res.json(r.rows);
  });
  app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
  app.use((err,_req,res,_next)=>{
    if(err.type==='entity.parse.failed') return res.status(400).json({error:'Invalid JSON'});
    if(err.type==='entity.too.large') return res.status(413).json({error:'Request too large'});
    console.error('Request failed:',err.code ?? err.name);res.status(500).json({error:'Internal server error'});
  });
  return app;
}
