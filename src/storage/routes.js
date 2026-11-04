import {Router,raw} from 'express';
import {randomUUID,createHash} from 'node:crypto';
import {MAX_DOCUMENT_BYTES} from './validate.js';
import {validateIsolated} from './isolated-validation.js';
import {z,id,validate} from '../security/validation.js';
import {requestLimiter} from '../security/limiter.js';
let uploads=0;
export function documentRouter(db,auth,{objectStore,scanner}){
  const r=Router({mergeParams:true});r.use(auth);
  r.use(validate(z.strictObject({studyId:id}), 'params'));
  r.post('/',requestLimiter(db,{capacity:5,perSecond:1/180,scope:'uploads'}),validate(z.strictObject({filename:z.string().min(1).max(185)}),'query'),async(req,res,next)=>{
    if(!objectStore||!scanner)return res.status(503).json({error:'Document service unavailable'});
    if(!['student','faculty'].includes(req.user.role))return res.status(403).json({error:'Forbidden'});
    const access=await db.query('SELECT id FROM research_records WHERE id=$1 AND crm_member(id)',[req.params.studyId]);
    if(!access.rowCount)return res.status(404).json({error:'Record not found'});
    if(uploads>=2)return res.status(503).json({error:'Document capacity exceeded'});
    if(req.get('content-type')!=='application/octet-stream')return res.status(415).json({error:'Send application/octet-stream'});
    uploads++;let done=false;
    const release=()=>{if(!done){done=true;uploads--;}};
    req.releaseUpload=release;
    next();
  },(req,res,next)=>raw({type:'application/octet-stream',limit:MAX_DOCUMENT_BYTES})(req,res,error=>{
    if(error)req.releaseUpload();next(error);
  }),async(req,res)=>{
    try{
    const filename=req.validated.query.filename;
    const mediaType=await validateIsolated(req.body,filename);
    if(!await scanner(req.body))return res.status(400).json({error:'Document rejected'});
    const documentId=randomUUID(),key=`manuscripts/${randomUUID()}`,digest=createHash('sha256').update(req.body).digest('hex');
    await objectStore.put(key,req.body,mediaType,digest);
    try{
      const row=await db.query('INSERT INTO documents(id,study_id,object_key,filename,size_bytes,sha256,media_type) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,study_id,filename,size_bytes,media_type,created_at',[documentId,req.params.studyId,key,filename,req.body.length,digest,mediaType]);
      res.status(201).json(row.rows[0]);
    }catch(e){try{await objectStore.remove(key);}catch{console.error(JSON.stringify({request_id:req.requestId,code:'ORPHAN_OBJECT_CLEANUP_REQUIRED',key}));}throw e;}
    }finally{req.releaseUpload();}
  });
  r.get('/:documentId/url',validate(z.strictObject({studyId:id,documentId:z.uuid()}),'params'),async(req,res)=>{
    if(!objectStore)return res.status(503).json({error:'Document service unavailable'});
    const row=await db.query('SELECT object_key FROM documents WHERE id=$1 AND study_id=$2',[req.params.documentId,req.params.studyId]);
    if(!row.rowCount)return res.status(404).json({error:'Document not found'});
    res.set('Cache-Control','no-store');res.json({url:await objectStore.download(row.rows[0].object_key),expires_in:600});
  });
  return r;
}
