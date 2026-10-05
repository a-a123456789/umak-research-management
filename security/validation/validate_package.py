"""Validate documentation/model consistency; does not test the application."""
from pathlib import Path
import json,math,copy,sys,csv
from decimal import Decimal as D
from jsonschema import Draft7Validator
P=Path(__file__).resolve().parents[1]
risks=json.loads((P/'data/risks.json').read_text());m=json.loads((P/'models/CRM_Threat_Dragon.json').read_text());f=json.loads((P/'data/financial_inputs.json').read_text())
schema=json.loads((P/'validation/threat-dragon-v2.schema.json').read_text())
# OWASP schema uses OpenAPI nullable. Translate that keyword without changing the checked types.
def nullable(s):
 if isinstance(s,dict):
  if s.get('nullable') and isinstance(s.get('type'),str):s['type']=[s['type'],'null']
  for v in s.values():nullable(v)
 elif isinstance(s,list):
  for v in s:nullable(v)
nullable(schema)
errors=list(Draft7Validator(schema).iter_errors(m));assert not errors, '\n'.join(str(x) for x in errors)
threatschema=schema['properties']['detail']['properties']['diagrams']['items']['properties']['cells']['items']['properties']['threats']['items']
checks=[]
for field in ['id','tva','threat','acl','ticket']:
 assert len({r[field]for r in risks})==len(risks)
checks.append('Unique risk/TVA/threat/control/ticket IDs')
assert sum(r['cost'] for r in risks)==f['acs']
av=sum(f['valuation'].values());sle=D(str(av))*D(str(f['ef']));before=sle*D(str(f['aro_prior']));after=sle*D(str(f['aro_post']));cba=before-after-D(str(f['acs']))
assert (av,sle,before,after,cba)==(3600000,D('1440000'),D('2880000'),D('72000'),D('2568000'))
for r in risks:
 assert len(r['dread'])==5 and all(1<=x<=10 for x in r['dread'])
 assert math.isclose(sum(r['dread'])/5,r['score'])
 assert all(1<=x<=5 for x in r['prior']+r['post'])
assert [r['n'] for r in sorted(risks,key=lambda r:-r['score'])[:3]]==[4,1,8]
checks.append('All financial totals, cost allocation and DREAD scores')
all_th=[]
for diagram in m['detail']['diagrams']:
 cells=diagram['cells'];ids={c['id']for c in cells};assert len(ids)==len(cells)
 for c in cells:
  if c['shape']=='flow':
   assert c['source']['cell']in ids and c['target']['cell']in ids
   assert c['data']['protocol']
  for t in c.get('data',{}).get('threats',[]):
   Draft7Validator(threatschema).validate(t);all_th.append(t)
assert len(all_th)==len(risks)
assert {t['title'].split()[0] for t in all_th}=={r['threat'] for r in risks}
l1=m['detail']['diagrams'][1]['cells'];assert sum(c['shape']=='process'for c in l1)>=2;assert sum(c['shape']=='store'for c in l1)>=2;assert sum(c['data'].get('isTrustBoundary',False)for c in l1)>=3
assert {r['element'][:1]for r in risks}>={'P','D','E'}
assert any(r['element'].startswith('DF')for r in risks)
assert len({r['category']for r in risks})==5
assert all(sum(r['category']==cat for r in risks)>=2 for cat in {r['category']for r in risks})
assert any('Repudiation' in r['stride']for r in risks)
checks+=['Official Threat Dragon v2 schema including data.threats objects','Flow endpoints, protocols, diagram counts and all eleven threat mappings','Five categories with at least two triples and explicit repudiation scenario']
# Join exported tables and diagram placement to the risk source, not only ID counts.
trace=list(csv.DictReader((P/'data/traceability.csv').open()))
register=list(csv.DictReader((P/'data/risk_register.csv').open()))
assert len(trace)==len(register)==len(risks)
for r in risks:
 tr=next(t for t in trace if t['Risk']==r['id'])
 for col,key in [('Asset','asset'),('TVA','tva'),('STRIDE Threat','threat'),('Element','element'),('Control','acl'),('Backlog','ticket')]:assert tr[col]==r[key],(r['id'],col)
 rr=next(t for t in register if t['Risk ID']==r['id'])
 assert rr['Asset']==r['asset'] and rr['Vulnerability']==r['flaw'] and rr['Countermeasure']==r['control']
 assert int(rr['Annual Safeguard Allocation PHP'])==r['cost']
 assert int(rr['Inherent Score'])==math.prod(r['prior']) and int(rr['Target Residual Score'])==math.prod(r['post'])
 matches=[(c,t) for c in l1 for t in c['data'].get('threats',[]) if t['title'].split()[0]==r['threat']]
 assert len(matches)==1
 cell,th=matches[0]
 assert cell['data']['name'].split()[0]==r['element']
 assert th['title']==r['threat']+' '+r['title']
for c in l1:
 assert c['data'].get('hasOpenThreats',False)==any(t['status']=='Open' for t in c['data'].get('threats',[]))
checks.append('Risk register and traceability values, model threat titles/placement and open flags agree')
report={'status':'PASS','checks':checks,'metrics':{'AV':av,'SLE':str(sle),'ALE_prior':str(before),'ALE_post':str(after),'CBA':str(cba),'ACS':f['acs'],'risks':len(risks),'threats':len(all_th)},'limitations':['This validator checks documentation only; application results are recorded separately in evidence.','No live cloud deployment validated; synthetic restore evidence is recorded separately.','Costs, scoring and effectiveness are scenario assumptions.','UI import and report visual review are recorded separately in README.']}
(P/'validation/results.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
