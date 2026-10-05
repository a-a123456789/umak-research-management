"""Pure DAG dynamic programming. Durations are integer estimated minutes.
AI assistance: ChatGPT/Codex helped extend the supplied readiness algorithm with
DAG recurrences, validation and test cases. Original readiness baseline is retained.
"""
from collections import deque
from prototype import evaluate_proposed, evaluate_baseline

MAX_V, MAX_E, MAX_Q = 5000, 25000, 50000

def error(kind, message):
    return {'status': 'ERROR', 'error_type': kind, 'message': message}

def normalize(payload):
    """Validate the public schema and map receipt/verification gates to predicates."""
    fields = {'steps','dependencies','completed_actions','requirements','evidence','durations'}
    if not isinstance(payload,dict) or set(payload) != fields:
        raise ValueError('Exactly steps, dependencies, completed_actions, requirements, evidence, durations required')
    steps=payload['steps'];edges=payload['dependencies'];completed=payload['completed_actions'];reqs=payload['requirements'];evidence=payload['evidence'];durations=payload['durations']
    valid_id=lambda s:isinstance(s,str) and 1<=len(s)<=64 and all(c.isascii() and (c.isalnum() or c in '_-')for c in s)
    if not isinstance(steps,list) or not 1<=len(steps)<=MAX_V or not all(valid_id(s)for s in steps) or len(set(steps))!=len(steps):raise ValueError('1..5000 unique ASCII step IDs required')
    ids=set(steps)
    if not isinstance(edges,list) or len(edges)>MAX_E:raise ValueError('At most 25000 edges allowed')
    edge_set=set()
    for e in edges:
        if not isinstance(e,list) or len(e)!=2 or not all(valid_id(x) and x in ids for x in e):raise ValueError('Each edge must reference two existing steps')
        if tuple(e) in edge_set:raise ValueError('Duplicate edge')
        edge_set.add(tuple(e))
    if not isinstance(completed,list) or not all(valid_id(x) and x in ids for x in completed) or len(set(completed))!=len(completed):raise ValueError('Invalid completed_actions')
    if not isinstance(durations,dict) or set(durations)!=ids or any(type(v)is not int or not 0<=v<=525600 for v in durations.values()):raise ValueError('Every step needs integer duration_minutes in 0..525600')
    if not isinstance(reqs,dict) or any(k not in ids for k in reqs):raise ValueError('Invalid requirements map')
    step_reqs={};count=0
    for step,items in reqs.items():
        if not isinstance(items,list):raise ValueError('Requirements must be lists')
        out=set()
        for q in items:
            if not isinstance(q,dict) or set(q)!={'id','gate'} or not valid_id(q['id']) or q['gate'] not in ('received','verified'):raise ValueError('Requirement needs id and received/verified gate')
            key=q['id']+':'+q['gate']
            if key in out:raise ValueError('Duplicate requirement membership')
            out.add(key);count+=1
            if count>MAX_Q:raise ValueError('At most 50000 requirement memberships allowed')
        step_reqs[step]=out
    if not isinstance(evidence,list) or len(evidence)>MAX_Q:raise ValueError('Invalid evidence list')
    satisfied=set();seen=set()
    for item in evidence:
        if not isinstance(item,dict) or set(item)!={'id','state'} or not valid_id(item['id']) or item['state'] not in ('received','verified') or item['id'] in seen:raise ValueError('Evidence needs unique id and received/verified state')
        seen.add(item['id']);satisfied.add(item['id']+':received')
        if item['state']=='verified':satisfied.add(item['id']+':verified')
    return steps,edges,set(completed),satisfied,step_reqs,durations

def evaluate(args, baseline=False, stats=None):
    steps,edges,completed,satisfied,reqs,durations=args
    readiness=(evaluate_baseline if baseline else evaluate_proposed)(steps,edges,completed,satisfied,reqs)
    if readiness['status']=='ERROR':return readiness
    rank={v:i for i,v in enumerate(steps)};pre={v:[]for v in steps};adj={v:[]for v in steps};indeg={v:0 for v in steps}
    for u,v in edges:pre[v].append(u);adj[u].append(v);indeg[v]+=1
    finish={};parent={};relaxations=0
    def compute(v):
        nonlocal relaxations
        best=None
        for u in pre[v]:
            relaxations+=1
            if best is None or finish[u]>finish[best] or (finish[u]==finish[best] and rank[u]<rank[best]):best=u
        parent[v]=best
        finish[v]=(finish[best] if best is not None else 0)+(0 if v in completed else durations[v])
    passes=0
    if baseline:
        while len(finish)<len(steps):
            passes+=1
            for v in steps:
                if v not in finish and all(u in finish for u in pre[v]):compute(v)
    else:
        queue=deque(v for v in steps if indeg[v]==0)
        while queue:
            v=queue.popleft();compute(v)
            for child in adj[v]:
                indeg[child]-=1
                if indeg[child]==0:queue.append(child)
    end=max(steps,key=lambda v:(finish[v],-rank[v]));path=[];cur=end
    while cur is not None:
        if cur not in completed:path.append(cur)
        cur=parent[cur]
    path.reverse()
    if len(completed)==len(steps):path=[]
    if stats is not None:stats.update(dp_edge_relaxations=relaxations,dp_passes=passes)
    return {**readiness,'earliest_finish_minutes':{v:finish[v] for v in steps},'remaining_duration_minutes':finish[end],'critical_path':path,'duration_model':'Estimated dependency-only duration; unlimited parallel capacity; evidence and resource delays excluded'}

def solve(payload,baseline=False,stats=None):
    try:args=normalize(payload)
    except (ValueError,TypeError) as e:return error('INVALID_INPUT',str(e))
    return evaluate(args,baseline,stats)
