import net from 'node:net';
// ClamAV INSTREAM: no shell, no user-controlled paths, bounded frames/time/response.
export function clamScanner({host=process.env.CLAMAV_HOST,port=Number(process.env.CLAMAV_PORT??3310)}={}){
  if(!host)return null;
  return bytes=>new Promise((resolve,reject)=>{
    const socket=net.createConnection({host,port});let response='';
    const fail=()=>{socket.destroy();reject(Object.assign(Error('Scanner unavailable'),{httpStatus:503}));};
    socket.setTimeout(30_000,fail);socket.on('error',fail);
    socket.on('data',chunk=>{response+=chunk.toString('utf8');if(response.length>4096)fail();});
    socket.on('end',()=>{
      socket.destroy();
      if(/^stream: OK\0?$/.test(response.trim()))resolve(true);
      else if(response.includes('FOUND'))resolve(false);else fail();
    });
    socket.on('connect',async()=>{
      const write=chunk=>new Promise((ok,no)=>socket.write(chunk,e=>e?no(e):ok()));
      try{
        await write(Buffer.from('zINSTREAM\0'));
        for(let i=0;i<bytes.length;i+=65536){const chunk=bytes.subarray(i,i+65536),size=Buffer.alloc(4);size.writeUInt32BE(chunk.length);await write(size);await write(chunk);}
        await write(Buffer.alloc(4));
      }catch{fail();}
    });
  });
}
