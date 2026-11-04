import {Router} from 'express';
import {z,id,validate,ticket,empty,version,deadline} from '../security/validation.js';
export const CLAIM_SQL=`WITH next AS (
  SELECT id FROM consultation_tickets WHERE status='queued'
  ORDER BY deadline_at ASC NULLS LAST,submitted_at,id
  FOR UPDATE SKIP LOCKED LIMIT 1
) UPDATE consultation_tickets t SET status='claimed',assigned_staff_id=$1,
  claimed_at=clock_timestamp(),version=version+1 FROM next WHERE t.id=next.id RETURNING t.*`;
const validId=x=>/^[1-9][0-9]*$/.test(String(x))&&Number.isSafeInteger(Number(x))&&Number(x)<=2147483647;
const object=b=>b&&typeof b==='object'&&!Array.isArray(b);
const keys=(b,allowed)=>object(b)&&Object.keys(b).every(k=>allowed.includes(k));
export function validDeadline(value){
  if(value===null)return true;
  if(typeof value!=='string'||value.startsWith('0000-')||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value))return false;
  const date=new Date(value);
  return Number.isFinite(date.getTime())&&date.toISOString()===value.replace(/(?<=:\d{2})Z$/,'.000Z');
}
async function transaction(db,actor,action,operation){
  const client=await db.connect();
  try{
    await client.query('BEGIN');const row=await operation(client);
    if(row?.id)await client.query('INSERT INTO audit_logs(actor_id,action) VALUES($1,$2)',[actor,action]);
    await client.query('COMMIT');return row;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export function consultationRouter(db,auth,staff){
  const router=Router();router.use(auth);
  router.post('/',validate(ticket),async(req,res)=>{
    const b=req.body;
    if(!keys(b,['service_type','deadline_at'])||typeof b.service_type!=='string'||!b.service_type.trim()||b.service_type.length>100||!validDeadline(b.deadline_at??null))return res.status(400).json({error:'Provide service_type and optional UTC deadline_at'});
    const row=await transaction(db,req.user.id,'consultation.created',async c=>(await c.query('INSERT INTO consultation_tickets(requester_id,service_type,deadline_at) VALUES($1,$2,$3) RETURNING *',[req.user.id,b.service_type.trim(),b.deadline_at??null])).rows[0]);
    res.status(201).json(row);
  });
  router.get('/queue',staff,validate(z.strictObject({limit:z.coerce.number().int().min(1).max(100).optional()}),'query'),async(req,res)=>{
    const limit=req.query.limit===undefined?100:Number(req.query.limit);
    if(!Number.isInteger(limit)||limit<1||limit>100)return res.status(400).json({error:'limit must be 1..100'});
    const r=await db.query("SELECT * FROM consultation_tickets WHERE status='queued' ORDER BY deadline_at ASC NULLS LAST,submitted_at,id LIMIT $1",[limit]);res.json(r.rows);
  });
  router.get('/',validate(z.strictObject({before:id.optional()}),'query'),async(req,res)=>{
    const before=req.query.before===undefined?2147483647:req.query.before;
    if(!validId(before))return res.status(400).json({error:'Invalid before cursor'});
    const r=await db.query("SELECT * FROM consultation_tickets WHERE (requester_id=$1 OR $2='staff') AND id<$3 ORDER BY id DESC LIMIT 100",[req.user.id,req.user.role,before]);res.json(r.rows);
  });
  router.post('/claim-next',staff,validate(empty),async(req,res)=>{
    if(!keys(req.body??{},[]) )return res.status(400).json({error:'No claim fields accepted'});
    const row=await transaction(db,req.user.id,'consultation.claimed',async c=>(await c.query(CLAIM_SQL,[req.user.id])).rows[0]);
    if(!row)return res.sendStatus(204);res.json(row);
  });
  router.patch('/:id/deadline',staff,validate(z.strictObject({deadline_at:deadline,expected_version:version.shape.expected_version})),async(req,res)=>{
    const b=req.body;
    if(!validId(req.params.id)||!keys(b,['deadline_at','expected_version'])||!Object.hasOwn(b,'deadline_at')||!validDeadline(b.deadline_at)||!validId(b.expected_version)||typeof b.expected_version!=='number')return res.status(400).json({error:'Valid ID, UTC deadline_at (or null) and expected_version required'});
    const row=await transaction(db,req.user.id,'consultation.rescheduled',async c=>(await c.query("UPDATE consultation_tickets SET deadline_at=$1,version=version+1 WHERE id=$2 AND status='queued' AND version=$3 RETURNING *",[b.deadline_at,req.params.id,b.expected_version])).rows[0]);
    if(!row)return res.status(409).json({error:'Ticket unavailable or version changed'});res.json(row);
  });
  for(const action of ['resolve','cancel'])router.post(`/:id/${action}`,validate(version),async(req,res)=>{
    const b=req.body;
    if(!validId(req.params.id)||!keys(b,['expected_version'])||!validId(b.expected_version)||typeof b.expected_version!=='number')return res.status(400).json({error:'Valid ID and expected_version required'});
    if(action==='resolve'&&req.user.role!=='staff')return res.status(403).json({error:'Forbidden'});
    const row=await transaction(db,req.user.id,`consultation.${action==='resolve'?'resolved':'cancelled'}`,async c=>{
      // Visibility check under lock avoids exposing another student's ticket existence.
      const r=await c.query("SELECT * FROM consultation_tickets WHERE id=$1 AND (requester_id=$2 OR $3='staff') FOR UPDATE",[req.params.id,req.user.id,req.user.role]);
      if(!r.rowCount)return {missing:true};
      const t=r.rows[0];
      if(t.version!==b.expected_version||
        (action==='resolve'&&(t.status!=='claimed'||t.assigned_staff_id!==req.user.id))||
        (action==='cancel'&&!(t.status==='queued'||(t.status==='claimed'&&req.user.role==='staff'))))return {conflict:true};
      return (await c.query('UPDATE consultation_tickets SET status=$1,version=version+1 WHERE id=$2 RETURNING *',[action==='resolve'?'resolved':'cancelled',t.id])).rows[0];
    });
    if(row?.missing)return res.status(404).json({error:'Ticket not found'});
    if(row?.conflict)return res.status(409).json({error:'Ticket unavailable or version changed'});
    res.json(row);
  });
  return router;
}
