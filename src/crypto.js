import {scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {hash,verify,parseOptions,Algorithm} from '@node-rs/argon2';
const derive=promisify(scrypt);
export const PASSWORD_POLICY=Object.freeze({algorithm:Algorithm.Argon2id,memoryCost:19456,timeCost:2,parallelism:1,outputLen:32});
let active=0;
async function bounded(fn){
  if(active>=4)throw Object.assign(Error('Authentication capacity exceeded'),{httpStatus:503});
  active++;try{return await fn();}finally{active--;}
}
export const hashPassword=password=>bounded(()=>hash(password,PASSWORD_POLICY));
export function needsRehash(stored){
  try{const p=parseOptions(stored);return p.algorithm!==Algorithm.Argon2id||p.memoryCost<19456||p.timeCost<2||p.saltLen<16||p.outputLen<32;}catch{return true;}
}
export async function verifyPassword(password,stored){
  if(typeof stored!=='string')return false;
  return bounded(async()=>{
    try{
      if(stored.startsWith('$argon2id$')){
        const p=parseOptions(stored);
        if(p.memoryCost>262144||p.timeCost>10||p.parallelism>4)return false;
        return await verify(stored,password);
      }
      if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored))return false;
      const [salt,digest]=stored.split(':');
      return timingSafeEqual(await derive(password,salt,64,{N:16384,r:8,p:1}),Buffer.from(digest,'hex'));
    }catch{return false;}
  });
}
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
