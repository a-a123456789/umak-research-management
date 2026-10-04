import copy,random,unittest
from engine import solve
from prototype import canonical

def case(steps,edges,durations,completed=None):
 return dict(steps=steps,dependencies=edges,completed_actions=completed or [],requirements={},evidence=[],durations=dict(zip(steps,durations)))
class DynamicProgrammingTests(unittest.TestCase):
 def test_chain_completed_prefix(self):
  p=case(['a','b','c'],[['a','b'],['b','c']],[10,20,30],['a']);r=solve(p)
  self.assertEqual(r['remaining_duration_minutes'],50);self.assertEqual(r['critical_path'],['b','c']);self.assertEqual(r['ready_steps'],['b'])
 def test_join_disconnected_tie_zero(self):
  p=case(['a','b','c','d'],[['a','c'],['b','c']],[4,4,3,0]);r=solve(p)
  self.assertEqual(r['critical_path'],['a','c']);self.assertEqual(r['remaining_duration_minutes'],7)
 def test_completed_and_zero(self):
  self.assertEqual(solve(case(['a'],[],[5],['a']))['critical_path'],[])
  self.assertEqual(solve(case(['a'],[],[0]))['remaining_duration_minutes'],0)
 def test_receipt_does_not_mean_verified(self):
  p=case(['a','b'],[],[1,1]);p['requirements']={'a':[{'id':'proof','gate':'received'}],'b':[{'id':'proof','gate':'verified'}]};p['evidence']=[{'id':'proof','state':'received'}]
  self.assertEqual(solve(p)['ready_steps'],['a']);p['evidence'][0]['state']='verified';self.assertEqual(solve(p)['ready_steps'],['a','b'])
 def test_invalid_and_cycle(self):
  for val in [-1,1.5,True,float('inf'),525601]:
   p=case(['a'],[],[val]);self.assertEqual(solve(p)['error_type'],'INVALID_INPUT')
  self.assertEqual(solve(case(['a'],[['a','a']],[0]))['error_type'],'CYCLIC_DEPENDENCY_DETECTED')
  p=case(['a','b'],[['a','b']],[1,1],['b']);self.assertEqual(solve(p)['error_type'],'INCONSISTENT_COMPLETION')
 def test_limits_and_duplicates(self):
  p=case(['a'],[],[0]);p['steps']=['a']*5001;self.assertEqual(solve(p)['status'],'ERROR')
  p=case(['a','b'],[['a','b'],['a','b']],[1,1]);self.assertEqual(solve(p)['status'],'ERROR')
  p=case(['a'],[],[0]);p['requirements']={'a':[{'id':str(i),'gate':'received'}for i in range(50001)]};self.assertEqual(solve(p)['status'],'ERROR')
 def test_random_equivalence_certificate_and_immutability(self):
  rng=random.Random(20261004)
  for _ in range(500):
   n=rng.randint(1,30);steps=[f's{i}'for i in range(n)];edges=[[steps[j],steps[i]]for i in range(n)for j in range(i)if rng.random()<.15]
   p=case(steps,edges,[rng.randint(0,100)for _ in steps],steps[:rng.randint(0,n)]);rng.shuffle(p['steps']);snapshot=copy.deepcopy(p)
   a,b=solve(p),solve(p,True);self.assertEqual(canonical(a),canonical(b));self.assertEqual({k:v for k,v in a.items() if k not in ('ready_steps','blocked_steps')},{k:v for k,v in b.items() if k not in ('ready_steps','blocked_steps')});self.assertEqual(p,snapshot)
   self.assertEqual(sum(p['durations'][v]for v in a['critical_path']),a['remaining_duration_minutes'])
if __name__=='__main__':unittest.main()
