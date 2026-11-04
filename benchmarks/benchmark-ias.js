import pg from 'pg';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,PASSWORD_POLICY} from '../src/crypto.js';
import {scopedDatabase} from '../src/security/context.js';
if(process.env.ALLOW_BENCHMARK!=='yes'||process.env.ALLOW_SYNTHETIC_SETUP!=='yes')throw Error('Explicit disposable synthetic benchmark required');
const reps=Number(process.env.IAS_BENCH_REPS??30),sizes=(process.env.IAS_BENCH_SIZES??'1000,10000').split(',').map(Number);
if(!Number.isInteger(reps)||reps<30||sizes.some(n=>![1000,10000,100000].includes(n)))throw Error('Use >=30 reps and supported sizes 1000/10000/100000');
const runId=new Date().toISOString().replaceAll(':','-'),out=new URL(`./results/ias-${runId}/`,import.meta.url);await mkdir(out);
const samples=[],summary=[];
const admin=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL}),pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),{db,storage}=scopedDatabase(pool);
const prefix=`ias-benchmark-${randomBytes(8).toString('hex')}-`;
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)];
async function measure(name,size,method){
 const delay=monitorEventLoopDelay({resolution:10});delay.enable();
 let peakRss=process.memoryUsage().rss;const timer=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss);},5);
 try{
  for(let i=0;i<5;i++)await method();
  const times=[];
  for(let i=0;i<reps;i++){const start=performance.now();await method();const ms=performance.now()-start;times.push(ms);samples.push({name,size,rep:i,ms});}
  await new Promise(r=>setTimeout(r,20));
  summary.push({name,size,reps,p50_ms:percentile(times,.5),p95_ms:percentile(times,.95),p99_ms:percentile(times,.99),peak_rss_bytes:peakRss,event_loop_p95_ms:delay.percentile(95)/1e6});
 }finally{clearInterval(timer);delay.disable();}
}
try{
 const password='synthetic benchmark credential',salt=randomBytes(16).toString('hex'),legacy=scryptSync(password,salt,64),argon=await hashPassword(password);
 await measure('legacy_sync_scrypt_verify',1,()=>assert.ok(timingSafeEqual(scryptSync(password,salt,64),legacy)));
 await measure('async_argon2id_verify',1,async()=>assert.ok(await verifyPassword(password,argon)));
 await measure('async_argon2id_hash',1,()=>hashPassword(password));
 // Actual deployed controls and queries, not a surrogate RLS implementation.
 for(const n of sizes){
  await admin.query("INSERT INTO research_records(author_id,title,status) SELECT 1,$1||i,'Draft' FROM generate_series(1,$2) i",[prefix,n]);
  const query='SELECT id,title FROM research_records WHERE author_id=$1 AND title LIKE $2 ORDER BY id LIMIT 100',args=[1,prefix+'%'];
  const expected=(await admin.query(query,args)).rows;
  await measure('app_predicate_owner_admin_baseline',n,async()=>{
    const c=await admin.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.user_id','1',true)");assert.deepEqual((await c.query(query,args)).rows,expected);await c.query('COMMIT');}finally{c.release();}
  });
  await measure('app_predicate_plus_real_rls_owner',n,()=>storage.run({user:{id:1}},async()=>assert.deepEqual((await db.query(query,args)).rows,expected)));
  const target=expected[0].id;
  await measure('audited_research_update',n,()=>storage.run({user:{id:1}},()=>db.query('UPDATE research_records SET title=title WHERE id=$1',[target])));
  await admin.query('DELETE FROM research_records WHERE title LIKE $1',[prefix+'%']);
 }
 const sourceFiles=['src/crypto.js','src/security/context.js','db/migrations/002_ias_controls.sql','db/migrations/003_identity_isolation.sql'];
 const hashes={};for(const f of sourceFiles)hashes[f]=createHash('sha256').update(await readFile(new URL('../'+f,import.meta.url))).digest('hex');
 const metadata={run_id:runId,node:process.version,os:os.platform(),arch:os.arch(),cpu:os.cpus()[0].model,ram_bytes:os.totalmem(),postgres:(await admin.query('SHOW server_version')).rows[0].server_version,
   commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty_files:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim().split('\n'),source_hashes:hashes,password_policy:PASSWORD_POLICY,
   limitations:'Sequential owner-access query calibration and standalone crypto only. Method blocks are not randomized and no seeded multi-role corpus or HTTP load is measured. Event-loop/memory observations are instrumented process samples. No audit chain, cloud or Android performance claim.'};
 await writeFile(new URL('metadata.json',out),JSON.stringify(metadata,null,2));await writeFile(new URL('samples.json',out),JSON.stringify(samples,null,2));await writeFile(new URL('summary.json',out),JSON.stringify(summary,null,2));
 await writeFile(new URL('samples.csv',out),'method,size,rep,ms\n'+samples.map(x=>`${x.name},${x.size},${x.rep},${x.ms}`).join('\n')+'\n');
 const report=['# IAS security calibration', '',metadata.limitations,'','| Method | Size | p50 ms | p95 ms | p99 ms |','| --- | ---: | ---: | ---: | ---: |',...summary.map(x=>`| ${x.name} | ${x.size} | ${x.p50_ms.toFixed(3)} | ${x.p95_ms.toFixed(3)} | ${x.p99_ms.toFixed(3)} |`),'','Audit update timings include the business UPDATE, RLS, transaction context and trigger; they are not isolated audit overhead. Lower crypto latency is not a security-strength comparison.'];
 await writeFile(new URL('report.md',out),report.join('\n')+'\n');console.log(out.pathname);
}finally{await admin.query('DELETE FROM research_records WHERE title LIKE $1',[prefix+'%']);await pool.end();await admin.end();}
