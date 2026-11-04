import pg from 'pg';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {EdfHeap,compareTickets} from '../src/consultations/edf-heap.js';
import {searchSql} from '../src/research/search.js';
if(process.env.ALLOW_BENCHMARK!=='yes'||!process.env.ADMIN_DATABASE_URL)throw Error('Explicit ALLOW_BENCHMARK=yes and disposable ADMIN_DATABASE_URL required');
const out=new URL(`./results/features-${new Date().toISOString().replace(/[:.]/g,'-')}/`,import.meta.url);
mkdirSync(out,{recursive:true});
const samples=[],summaries=[],plans=[];
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
function rng(seed){let value=seed;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/2**32;};}
function corpus(n,seed){const r=rng(seed);return Array.from({length:n},(_,i)=>({id:i+1,deadline_at:r()<.1?null:Math.floor(r()*1000),submitted_at:Math.floor(r()*1000)}));}
function drain(tickets,heap){
 const queue=heap?new EdfHeap(tickets):tickets.map(t=>({...t}));
 // Updates and cancellations exercise the heap's position map before dispatch.
 for(let i=0;i<tickets.length;i+=10){const t={...tickets[i],deadline_at:-i};if(heap)queue.update(t);else queue[i]=t;}
 const ids=[];
 if(heap){for(let i=5;i<tickets.length;i+=10)queue.remove(tickets[i].id);while(queue.size)ids.push(queue.pop().id);}
 else {const cancelled=new Set(tickets.filter((_,i)=>i%10===5).map(t=>t.id));for(let i=queue.length-1;i>=0;i--)if(cancelled.has(queue[i].id))queue.splice(i,1);
 while(queue.length){let min=0;for(let i=1;i<queue.length;i++)if(compareTickets(queue[i],queue[min])<0)min=i;ids.push(queue.splice(min,1)[0].id);}}
 return ids;
}
async function measure(suite,size,seed,functions){
 for(const fn of Object.values(functions))for(let i=0;i<5;i++)await fn();
 const times=Object.fromEntries(Object.keys(functions).map(k=>[k,[]]));const random=rng(seed);
 for(let i=0;i<30;i++){
  const order=Object.keys(functions);if(random()<.5)order.reverse();
  for(const method of order){const start=performance.now();await functions[method]();const elapsed_ms=performance.now()-start;times[method].push(elapsed_ms);samples.push({suite,size,seed,method,repetition:i,elapsed_ms});}
 }
 const row={suite,size,seed,proposed_median_ms:median(times.proposed),baseline_median_ms:median(times.baseline)};
 row.speedup=row.baseline_median_ms/row.proposed_median_ms;summaries.push(row);return row;
}
const client=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await client.connect();
const schema=`bench_features_${process.pid}`;let created=false;
try{
 const version=(await client.query('SELECT version()')).rows[0].version;
 writeFileSync(new URL('metadata.json',out),JSON.stringify({measured_utc:new Date().toISOString(),node:process.version,postgres:version,platform:os.platform(),release:os.release(),cpus:os.cpus()[0]?.model,ram_bytes:os.totalmem(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty_status:execFileSync('git',['status','--short'],{encoding:'utf8'}),reps:30,warmups:5,seeds:[1,2,3,4,5],source_hashes:Object.fromEntries(['src/research/search.js','src/consultations/edf-heap.js','benchmarks/benchmark-features.js'].map(path=>[path,createHash('sha256').update(execFileSync('cat',[path])).digest('hex')])),scope:'Local PostgreSQL warm-cache query batches and Node heap; no API/load/SLA. Search seeds vary query sets, heap seeds vary inputs. Memory not profiled.'},null,2));
 for(const n of [100,1000,10000]){
  for(const seed of [1,2,3,4,5]){
   const tickets=corpus(n,seed);assert.deepEqual(drain(tickets,true),drain(tickets,false));
   await measure('edf_heap_vs_scan',n,seed,{proposed:()=>drain(tickets,true),baseline:()=>drain(tickets,false)});
  }console.log('heap',n,'complete');
 }
 await client.query(`CREATE SCHEMA ${schema}`);created=true;
 await client.query(`SET search_path TO ${schema},public`);
 await client.query("SELECT set_config('pg_trgm.similarity_threshold','0.3',false)");
 await client.query(`CREATE TABLE research_records(id integer PRIMARY KEY,title text NOT NULL,abstract text NOT NULL DEFAULT '',status text NOT NULL,research_year integer,department text,normalized_title text GENERATED ALWAYS AS (public.crm_normalize_title(title)) STORED)`);
 for(const n of [1000,10000,100000]){
  await client.query('TRUNCATE research_records');
  await client.query(`INSERT INTO research_records(id,title,status,research_year,department) SELECT i,
    CASE WHEN i%1000=0 THEN 'IoT Based Waste Management Campus '||i ELSE 'Study '||substr(md5(i::text),1,12)||' '||substr(md5((i+1)::text),1,12)||' '||substr(md5((i+2)::text),1,12) END,
    CASE WHEN i%7=0 THEN 'Draft' ELSE 'Approved' END,2026,'Computing' FROM generate_series(1,$1::int) i`,[n]);
  const start=performance.now();await client.query('CREATE INDEX bench_title_trgm ON research_records USING gin(normalized_title gin_trgm_ops)');const build_ms=performance.now()-start;
  await client.query('ANALYZE research_records');
  plans.push({size:n,build_ms,index_bytes:Number((await client.query("SELECT pg_relation_size('bench_title_trgm') AS bytes")).rows[0].bytes)});
  for(const seed of [1,2,3,4,5]){
   const selected=(await client.query('SELECT title FROM research_records WHERE id=$1',[seed*19])).rows[0].title;
   const queries=[selected,selected.replace('Study','Stdy'),'IoT Waste Managemnt','unrelated zzzzzzzzzzzzz','st','study'];
   for(const duplicate of [false,true]){
    const options={duplicates:duplicate};
    const args=queries.map(q=>[q,null,null,100,0]);
    const proposed=async()=>{const rows=[];for(const a of args)rows.push((await client.query(searchSql({...options,publicProjection:false}),a)).rows);return rows;};
    const baseline=async()=>{const rows=[];for(const a of args)rows.push((await client.query(searchSql({...options,exhaustive:true,publicProjection:false}),a)).rows);return rows;};
    assert.deepEqual(await proposed(),await baseline());
    const row=await measure(duplicate?'trigram_duplicates':'trigram_public',n,seed,{proposed,baseline});row.queries_per_batch=queries.length;
    if(seed===1)plans.push({size:n,suite:duplicate?'duplicates':'public',query:queries[2],plan:(await client.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+searchSql({...options,publicProjection:false}),args[2])).rows[0]['QUERY PLAN']});
   }
  }
  await client.query('DROP INDEX bench_title_trgm');console.log('trigram',n,'complete');
 }
}finally{
 if(created)await client.query(`DROP SCHEMA ${schema} CASCADE`);
 await client.end();
}
writeFileSync(new URL('samples.json',out),JSON.stringify(samples,null,2));
writeFileSync(new URL('summary.json',out),JSON.stringify(summaries,null,2));
writeFileSync(new URL('query-plans.json',out),JSON.stringify(plans,null,2));
const lines=['# Trigram search and EDF benchmark results','','Thirty timed samples per method after five warmups, five seeds. Median of seed medians below; speedup is median paired baseline/proposed. Search times cover six-query batches including selective, typo, common and short queries. All output comparisons passed before timing.','','| Suite | Size | Proposed ms | Baseline ms | Speedup |','| --- | ---: | ---: | ---: | ---: |'];
for(const suite of [...new Set(summaries.map(r=>r.suite))])for(const size of [...new Set(summaries.filter(r=>r.suite===suite).map(r=>r.size))]){const rows=summaries.filter(r=>r.suite===suite&&r.size===size);lines.push(`| ${suite} | ${size} | ${median(rows.map(r=>r.proposed_median_ms)).toFixed(3)} | ${median(rows.map(r=>r.baseline_median_ms)).toFixed(3)} | ${median(rows.map(r=>r.speedup)).toFixed(2)}x |`);}
lines.push('','## Meaning and limits','','Heap measurements include heapify, deadline changes, cancellation and complete drain. Baseline uses repeated linear minimum selection with identical ordering. Heap O(n log n) batch behavior differs from O(n²) repeated scans; a one-time sort is also O(n log n) and is not compared here. Runtime dispatch uses PostgreSQL atomic claims, not this in-memory benchmark.','','Search compares index-supported pg_trgm predicates against exhaustive similarity scoring with the same public/duplicate semantics and ranking. Planner selection is automatic; broad public substring matches can favor scans. Five query seeds share one deterministic synthetic corpus per size. Warmups do not prove every page is cached; no cold-cache or concurrent load claim. Local database network/query overhead is included, HTTP is excluded. No memory or p99 claim. Index build time/size and representative EXPLAIN ANALYZE BUFFERS plans are saved separately.','','These inputs test typo retrieval, not real-world duplicate precision or plagiarism detection. No guaranteed speedup for common/short queries. Query arrays, source and dataset generation are in the runner; metadata records source hashes/environment. Raw samples are retained.');
writeFileSync(new URL('report.md',out),lines.join('\n')+'\n');console.log(out.pathname);
