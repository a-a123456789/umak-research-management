import {createHash} from 'node:crypto';
const key=x=>createHash('sha256').update(x).digest('hex');
export function requestLimiter(db,{capacity=300,perSecond=5,scope='requests'}={}){
  return async(req,res,next)=>{
    try{
      const r=await db.query('SELECT crm_take_token($1,$2,$3) AS allowed',[key(`${scope}:${req.user?.id??req.ip}`),capacity,perSecond]);
      if(!r.rows[0]?.allowed){res.set('Retry-After','15');return res.status(429).json({error:'Too many requests',request_id:req.requestId});}
      next();
    }catch{res.set('Retry-After','15');res.status(503).json({error:'Service temporarily unavailable',request_id:req.requestId});}
  };
}
export async function reserveLogin(db,email,ip,requestId){
  const r=await db.query('SELECT crm_reserve_login($1,$2,$3) AS allowed',[key(`account:${email}`),key(`ip:${ip}`),requestId]);
  return r.rows[0].allowed;
}
