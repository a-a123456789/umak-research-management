import {AsyncLocalStorage} from 'node:async_hooks';
export function scopedDatabase(pool){
  const storage=new AsyncLocalStorage();
  async function context(c){
    const s=storage.getStore()??{};
    await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.request_id',$2,true),set_config('app.ip',$3,true)",[String(s.user?.id??''),s.requestId??'',s.ip??'']);
  }
  const db={
    async connect(){
      const c=await pool.connect();
      return {release:()=>c.release(),async query(sql,params){
        const result=await c.query(sql,params);
        if(/^BEGIN\b/i.test(sql))await context(c);
        return result;
      }};
    },
    async query(sql,params){
      const c=await db.connect();
      try{await c.query('BEGIN');const r=await c.query(sql,params);await c.query('COMMIT');return r;}
      catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    }
  };
  return {db,storage};
}
