// Validate the worker boundary independently of the Python implementation.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k));
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const ids = v => Array.isArray(v) && v.every(id) && new Set(v).size === v.length;
const minutes = v => Number.isSafeInteger(v) && v >= 0 && v <= 2628000000;
export function validWorkerResult(v, payload) {
 if(!object(v) || !exact(v.metrics,['worker_elapsed_ms']) || typeof v.metrics.worker_elapsed_ms !== 'number' || !Number.isFinite(v.metrics.worker_elapsed_ms) || v.metrics.worker_elapsed_ms < 0) return false;
 if(v.status === 'ERROR') return exact(v,['status','error_type','message','metrics']) && typeof v.error_type === 'string' && v.error_type.length > 0 && typeof v.message === 'string' && v.message.length > 0;
 if(!['SUCCESS','COMPLETE'].includes(v.status) || !exact(v,['status','ready_steps','blocked_steps','earliest_finish_minutes','remaining_duration_minutes','critical_path','duration_model','metrics'])) return false;
 if(!ids(v.ready_steps) || !ids(v.critical_path) || !Array.isArray(v.blocked_steps) || !object(v.earliest_finish_minutes) || !minutes(v.remaining_duration_minutes) || typeof v.duration_model !== 'string' || !v.duration_model.length) return false;
 if(!v.blocked_steps.every(b => exact(b,['step','reasons']) && id(b.step) && Array.isArray(b.reasons) && b.reasons.length > 0 && b.reasons.every(r => typeof r === 'string' && r.length > 0))) return false;
 const steps=payload?.steps, completed=payload?.completed_actions;
 if(!ids(steps) || !ids(completed) || !exact(v.earliest_finish_minutes, steps) || !Object.values(v.earliest_finish_minutes).every(minutes)) return false;
 const completedSet=new Set(completed);
 const pending=steps.filter(s=>!completedSet.has(s)), pendingSet=new Set(pending), reported=[...v.ready_steps,...v.blocked_steps.map(b=>b.step)];
 if(reported.length !== pending.length || new Set(reported).size !== reported.length || reported.some(s=>!pendingSet.has(s)) || v.critical_path.some(s=>!pendingSet.has(s))) return false;
 if(v.remaining_duration_minutes !== Math.max(...Object.values(v.earliest_finish_minutes))) return false;
 if(v.status === 'COMPLETE') return pending.length === 0 && v.critical_path.length === 0 && v.remaining_duration_minutes === 0;
 return pending.length > 0;
}
