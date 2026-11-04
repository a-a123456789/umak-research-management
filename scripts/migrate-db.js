import pg from 'pg';
import {migrate} from './migrations.js';
if(!process.env.ADMIN_DATABASE_URL) throw Error('ADMIN_DATABASE_URL required');
const client=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});
await client.connect();
try {await client.query('BEGIN');await migrate(client);await client.query('COMMIT');console.log('Database migrations applied.');}
catch(e){await client.query('ROLLBACK');throw e;}
finally{await client.end();}
