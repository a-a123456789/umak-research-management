import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validWorkerResult} from '../src/algorithm-result.js';
const payload={steps:['a','b'],completed_actions:[]};
const good={status:'SUCCESS',ready_steps:['a'],blocked_steps:[{step:'b',reasons:['Unsatisfied prerequisite: a']}],earliest_finish_minutes:{a:5,b:12},remaining_duration_minutes:12,critical_path:['a','b'],duration_model:'Dependency estimate',metrics:{worker_elapsed_ms:1}};
test('worker response validates complete shapes, types and input membership',()=>{
 assert.ok(validWorkerResult(good,payload));
 for(const field of Object.keys(good)){const v=structuredClone(good);delete v[field];assert.equal(validWorkerResult(v,payload),false,field);}
 for(const patch of [{ready_steps:'a'},{blocked_steps:[{step:'b',reasons:[]}]},{critical_path:['unknown']},{remaining_duration_minutes:NaN},{metrics:{worker_elapsed_ms:Infinity}},{earliest_finish_minutes:{a:5,b:'12'}},{ready_steps:['b']},{status:'COMPLETE'},{unexpected:true}]) assert.equal(validWorkerResult({...good,...patch},payload),false,JSON.stringify(patch));
 assert.equal(validWorkerResult({status:'SUCCESS'},payload),false);
 assert.ok(validWorkerResult({status:'COMPLETE',ready_steps:[],blocked_steps:[],earliest_finish_minutes:{a:0,b:0},remaining_duration_minutes:0,critical_path:[],duration_model:'estimate',metrics:{worker_elapsed_ms:0}},{...payload,completed_actions:['a','b']}));
 assert.ok(validWorkerResult({status:'ERROR',error_type:'INVALID_INPUT',message:'Invalid schema',metrics:{worker_elapsed_ms:0}},{}));
 assert.equal(validWorkerResult({status:'ERROR',message:'missing type',metrics:{worker_elapsed_ms:0}},{}),false);
});
