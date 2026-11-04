import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EdfHeap,compareTickets} from '../src/consultations/edf-heap.js';
import {validDeadline} from '../src/consultations/routes.js';
const ticket=(id,deadline_at=null,submitted_at=0)=>({id,deadline_at,submitted_at});
test('EDF heap orders overdue, tied and absent deadlines; inputs and outputs are isolated',()=>{
 const inputs=[ticket(4),ticket(3,10,1),ticket(2,10,1),ticket(1,-1)];
 const heap=new EdfHeap(inputs);inputs[0].id=99;const peek=heap.peek();peek.id=88;
 assert.deepEqual(Array.from({length:4},()=>heap.pop().id),[1,2,3,4]);assert.equal(heap.pop(),null);assert.equal(heap.peek(),null);
});
test('EDF randomized mixed workloads agree with sorted reference including position updates',()=>{
 let value=42;const rand=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/2**32;};
 for(let run=0;run<50;run++){
  const heap=new EdfHeap();const reference=new Map();let next=1;
  for(let i=0;i<1000;i++){
   const choice=rand();const ids=[...reference.keys()],id=ids[Math.floor(rand()*ids.length)];
   if(choice<.4||!ids.length){const t=ticket(next++,rand()<.1?null:Math.floor(rand()*100),i);heap.insert(t);reference.set(t.id,t);}
   else if(choice<.65){const t={...reference.get(id),deadline_at:Math.floor(rand()*100)};assert.equal(heap.update(t),true);reference.set(id,t);}
   else if(choice<.8){assert.deepEqual(heap.remove(id),reference.get(id));reference.delete(id);}
   else{const expected=[...reference.values()].sort(compareTickets)[0];assert.deepEqual(heap.pop(),expected);reference.delete(expected.id);}
   assert.equal(heap.size,reference.size);assert.deepEqual(heap.peek(),[...reference.values()].sort(compareTickets)[0]??null);
  }
 }
});
test('EDF heap rejects invalid/duplicate IDs and handles absent updates',()=>{
 assert.throws(()=>new EdfHeap([ticket(1),ticket(1)]));assert.throws(()=>new EdfHeap([ticket(0)]));
 assert.throws(()=>new EdfHeap([ticket(1,NaN)]));const heap=new EdfHeap();assert.equal(heap.update(ticket(1)),false);assert.equal(heap.remove(1),null);
});
test('deadlines require real calendar instants in explicit UTC',()=>{
 for(const v of [null,'2026-11-04T10:00:00Z','2026-11-04T10:00:00.123Z'])assert.equal(validDeadline(v),true);
 for(const v of ['0000-01-01T00:00:00Z','2026-02-30T10:00:00Z','2026-11-04','2026-11-04T10:00:00+08:00',42,'bad'])assert.equal(validDeadline(v),false);
});
