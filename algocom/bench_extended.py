"""DAG extension benchmark. Old readiness-only results remain untouched."""
import csv,json,platform,os,random,time,gc,statistics,math
from datetime import datetime,timezone
from pathlib import Path
from bench import generate,median_ms,peak_kib,KINDS,SIZES
from engine import solve
from prototype import canonical

def payload(kind,n):
 steps,edges,completed,verified,reqs=generate(kind,n,'20261001')
 rng=random.Random(f'durations|{kind}|{n}')
 return {'steps':steps,'dependencies':[list(e)for e in edges],'completed_actions':list(completed),'requirements':{v:[{'id':q,'gate':'verified'}for q in sorted(items)]for v,items in reqs.items()},'evidence':[{'id':q,'state':'verified'}for q in sorted(verified)],'durations':{v:rng.randint(0,60)for v in steps}}

def equivalent(a,b):
 return canonical(a)==canonical(b) and all(a[k]==b[k] for k in ['earliest_finish_minutes','remaining_duration_minutes','critical_path'])

def performance_budget():
 rows=[]
 for kind in KINDS:
  p=payload(kind,5000);solve(p);times=[]
  for _ in range(10):
   gc.collect();start=time.perf_counter();r=solve(p);times.append((time.perf_counter()-start)*1000);assert r['status']=='SUCCESS'
  p95=sorted(times)[math.ceil(.95*len(times))-1]
  assert p95<1000,(kind,p95)
  rows.append({'kind':kind,'V':5000,'p95_ms':round(p95,4),'budget_ms':1000,'reps':10})
 return rows

def main():
 out=Path(__file__).parent;rows=[]
 for kind in KINDS:
  for n in SIZES:
   p=payload(kind,n);a,b=solve(p),solve(p,True);assert equivalent(a,b)
   sp,sb={},{};solve(p,stats=sp);solve(p,True,stats=sb)
   t=median_ms(solve,(p,),10);bt=median_ms(lambda x:solve(x,True),(p,),10)
   rows.append({'workflow':kind,'V':n,'E':len(p['dependencies']),'proposed_median_ms':round(t[0],4),'baseline_median_ms':round(bt[0],4),'speedup':round(bt[0]/t[0],2),'proposed_peak_kib':round(peak_kib(solve,(p,)),1),'baseline_peak_kib':round(peak_kib(lambda x:solve(x,True),(p,)),1),'dp_relaxations':sp['dp_edge_relaxations'],'baseline_dp_passes':sb['dp_passes']})
 with (out/'extended_results.csv').open('w',newline='')as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 report={'measured_utc':datetime.now(timezone.utc).isoformat(),'python':platform.python_version(),'platform':platform.platform(),'cpus':os.cpu_count(),'seed':'20261001','hash_seed':os.environ.get('PYTHONHASHSEED','unset'),'repetitions':10,'warmups':1,'semantics':'Readiness and DP end-to-end, including validation. Same input per method. Memory traced separately; inputs excluded. Fixed method order. Synthetic estimates only.','cases':rows,'performance_budget':performance_budget()}
 (out/'extended_results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
