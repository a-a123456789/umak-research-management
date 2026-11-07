import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import {spawn} from 'node:child_process';
const mode=process.argv[2];
const denyWrite=p=>assert.throws(()=>fs.writeFileSync(p,'probe'),e=>['EROFS','EACCES','ENOENT'].includes(e.code));
if(mode==='boundaries'){
  assert.equal(process.getuid(),65534);
  assert.deepEqual(Object.keys(process.env).sort(),['HOME','LANG','PATH','TMPDIR','XDG_CACHE_HOME'].sort());
  assert.equal(process.env.HOME,'/scratch');
  for(const p of ['/source/package.json','/usr/local/bin/write-probe','/tmp/write-probe','/root/write-probe','/harness/write-probe'])denyWrite(p);
  for(const p of ['/var/run/docker.sock','/source/.git','/source/.env','/source/node_modules','/host','/evidence']) assert.equal(fs.existsSync(p),false);
  fs.writeFileSync('/scratch/allowed','synthetic');
  assert.equal(fs.readFileSync('/scratch/allowed','utf8'),'synthetic');
  const status=fs.readFileSync('/proc/self/status','utf8');
  assert.match(status,/CapEff:\s+0+\n/); assert.match(status,/NoNewPrivs:\s+1/);
  const socket=net.connect({host:'192.0.2.1',port:443});
  await new Promise((res,rej)=>{socket.setTimeout(1000,()=>{socket.destroy();rej(Error('Network denial not observed'))});socket.on('connect',()=>{socket.destroy();rej(Error('Unexpected external connection'))});socket.on('error',e=>['ENETUNREACH','EHOSTUNREACH','EACCES'].includes(e.code)?res():rej(e));});
  // Empty network namespace has no non-loopback interfaces.
  assert.deepEqual(fs.readdirSync('/sys/class/net'),['lo']);
} else if(mode==='file-size'){
  const fd=fs.openSync('/scratch/large','w');let denied=false;
  try{for(let i=0;i<16;i++)fs.writeSync(fd,Buffer.alloc(1024*1024));}catch(e){if(e.code!=='EFBIG')throw e;denied=true;}finally{fs.closeSync(fd)}
  assert.ok(denied);assert.ok(fs.statSync('/scratch/large').size<=8*1024*1024);
} else if(mode==='disk'){
  let denied=false;const block=Buffer.alloc(4*1024*1024,1);
  try{for(let i=0;i<24;i++)fs.writeFileSync(`/scratch/block-${i}`,block);}catch(e){if(e.code!=='ENOSPC')throw e;denied=true;}
  assert.ok(denied,'scratch disk quota not enforced');
} else if(mode==='processes'){
  const children=[];let denied=false;
  try{
    for(let i=0;i<100;i++){
      const child=spawn('/bin/sleep',['10']);children.push(child);
      await new Promise((res,rej)=>{child.once('spawn',res);child.once('error',e=>{if(e.code==='EAGAIN'){denied=true;res()}else rej(e)})});
      if(denied)break;
    }
    assert.ok(denied,'process limit not enforced');
  }finally{for(const c of children)if(c.pid)c.kill('SIGKILL');}
} else if(mode==='memory'){
  const buffers=[]; for(let i=0;i<512;i++)buffers.push(Buffer.alloc(1024*1024,1));
  throw Error('Memory quota did not terminate process');
} else if(mode==='cpu'){while(true){} }
else if(mode==='wall'){setInterval(()=>{},1000);}
else if(mode==='output'){const b=Buffer.alloc(8192,65);while(true)fs.writeSync(1,b);}
else throw Error('Unknown probe');
