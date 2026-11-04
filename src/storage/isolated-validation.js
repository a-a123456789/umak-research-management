import {Worker} from 'node:worker_threads';
export function validateIsolated(bytes,filename){
  return new Promise((resolve,reject)=>{
    const w=new Worker(new URL('./validation-worker.js',import.meta.url),{workerData:{bytes,filename},resourceLimits:{maxOldGenerationSizeMb:128,stackSizeMb:4}});
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);void w.terminate();error?reject(error):resolve(value);};
    const failure=()=>finish(Object.assign(Error('Document validation failed'),{httpStatus:400}));
    const timer=setTimeout(failure,10_000);
    w.once('message',m=>m.invalid?failure():finish(null,m.mediaType));w.once('error',failure);w.once('exit',()=>{if(!settled)failure();});
  });
}
