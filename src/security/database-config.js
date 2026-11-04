import {readFileSync} from 'node:fs';
export function databaseConfig(env=process.env){
  if(!env.DATABASE_URL)throw Error('DATABASE_URL required');
  const config={connectionString:env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,statement_timeout:10000};
  if(env.NODE_ENV==='production'){
    if(!env.DB_TLS_CA_FILE)throw Error('Production database TLS CA is required');
    const url=new URL(env.DATABASE_URL);
    for(const k of ['sslmode','sslcert','sslkey','sslrootcert'])if(url.searchParams.has(k))throw Error('Use explicit database TLS configuration');
    config.ssl={rejectUnauthorized:true,ca:readFileSync(env.DB_TLS_CA_FILE,'utf8'),minVersion:'TLSv1.3'};
  }
  return config;
}
