import {validWorkerResult} from './algorithm-result.js';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function createAlgorithmRunner({timeoutMs=5000,maxConcurrent=2,workerScript=fileURLToPath(new URL('../algocom/worker.py',import.meta.url)),python=process.env.PYTHON_BIN||'python3'}={}) {
 let active=0;
 return function run(payload,signal) {
  if(active>=maxConcurrent)return Promise.reject(Object.assign(Error('Algorithm worker capacity reached'),{httpStatus:503,code:'WORKER_BUSY'}));
  active++;
  return new Promise((resolve,reject)=>{
   const child=spawn(python,['-u',workerScript],{shell:false,env:{PATH:process.env.PATH,LANG:'C.UTF-8',PYTHONHASHSEED:'0'},stdio:['pipe','pipe','pipe']});
   let output='',bytes=0,failure=null,settled=false;
   const fail=(code,httpStatus)=>{failure=Object.assign(Error(code),{code,httpStatus});child.kill('SIGKILL');};
   const timer=setTimeout(()=>fail('WORKER_TIMEOUT',504),timeoutMs);
   const abort=()=>fail('REQUEST_CANCELLED',499);
   signal?.addEventListener('abort',abort,{once:true});
   const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);active--;err?reject(err):resolve(value);};
   child.on('error',()=>finish(Object.assign(Error('Worker unavailable'),{code:'WORKER_UNAVAILABLE',httpStatus:503})));
   child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>8*1024*1024){fail('WORKER_OUTPUT_LIMIT',502);return;}output+=chunk.toString();});
   child.stderr.resume();
   child.stdin.on('error',()=>{});
   child.on('close',code=>{
    if(failure)return finish(failure);
    if(code!==0)return finish(Object.assign(Error('Worker failed'),{code:'WORKER_FAILED',httpStatus:502}));
    try {const value=JSON.parse(output);if(!validWorkerResult(value,payload))throw Error();finish(null,value);}
    catch {finish(Object.assign(Error('Invalid worker result'),{code:'WORKER_PROTOCOL',httpStatus:502}));}
   });
   if(signal?.aborted)abort();
   child.stdin.end(JSON.stringify(payload));
  });
 };
}
