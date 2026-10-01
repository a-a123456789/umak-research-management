import pg from 'pg';
import { createApp } from './app.js';
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL required');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
await db.query('SELECT 1');
const server=createApp(db).listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('CRM API listening on local port '+(process.env.PORT||3000)));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await db.end();process.exit(0);}));
