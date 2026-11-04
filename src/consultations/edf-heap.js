// Inputs use epoch milliseconds (null deadline sorts last), not local date strings.
export function compareTickets(a,b) {
  const ad=a.deadline_at??Infinity,bd=b.deadline_at??Infinity;
  return (ad<bd?-1:ad>bd?1:0)||a.submitted_at-b.submitted_at||a.id-b.id;
}
export class EdfHeap {
  constructor(tickets=[]) {
    this.items=[];this.positions=new Map();
    for(const ticket of tickets){this.validate(ticket);if(this.positions.has(ticket.id))throw Error('Duplicate ticket');this.positions.set(ticket.id,this.items.length);this.items.push({...ticket});}
    for(let i=Math.floor(this.size/2)-1;i>=0;i--)this.down(i);
  }
  get size(){return this.items.length;}
  validate(t){if(!t||!Number.isSafeInteger(t.id)||t.id<1||!Number.isFinite(t.submitted_at)||(t.deadline_at!==null&&!Number.isFinite(t.deadline_at)))throw Error('Invalid ticket');}
  swap(i,j){[this.items[i],this.items[j]]=[this.items[j],this.items[i]];this.positions.set(this.items[i].id,i);this.positions.set(this.items[j].id,j);}
  up(i){while(i>0){const p=Math.floor((i-1)/2);if(compareTickets(this.items[p],this.items[i])<=0)break;this.swap(i,p);i=p;}}
  down(i){for(;;){let m=i;for(const c of [2*i+1,2*i+2])if(c<this.size&&compareTickets(this.items[c],this.items[m])<0)m=c;if(m===i)break;this.swap(i,m);i=m;}}
  peek(){return this.size?{...this.items[0]}:null;}
  insert(ticket){this.validate(ticket);if(this.positions.has(ticket.id))throw Error('Duplicate ticket');this.items.push({...ticket});const i=this.size-1;this.positions.set(ticket.id,i);this.up(i);}
  remove(id){const i=this.positions.get(id);if(i===undefined)return null;const removed=this.items[i],last=this.items.pop();this.positions.delete(id);if(i<this.size){this.items[i]=last;this.positions.set(last.id,i);this.up(i);this.down(this.positions.get(last.id));}return {...removed};}
  pop(){return this.size?this.remove(this.items[0].id):null;}
  update(ticket){this.validate(ticket);if(!this.positions.has(ticket.id))return false;this.remove(ticket.id);this.insert(ticket);return true;}
}
