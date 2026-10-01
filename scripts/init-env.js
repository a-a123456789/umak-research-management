import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env')) throw Error('.env already exists; refusing to overwrite');
const admin=randomBytes(24).toString('hex'),app=randomBytes(24).toString('hex'),demo=randomBytes(16).toString('hex');
writeFileSync('.env',`PORT=3000\nHOST=127.0.0.1\nDATABASE_URL=postgresql://crm_app:${app}@127.0.0.1:5432/crm_ias\nADMIN_DATABASE_URL=postgresql://postgres:${admin}@127.0.0.1:5432/crm_ias\nPOSTGRES_PASSWORD=${admin}\nAPP_DB_PASSWORD=${app}\nDEMO_PASSWORD=${demo}\nALLOW_SYNTHETIC_SETUP=yes\nALLOW_ISOLATED_DEMO=yes\n`,{mode:0o600,flag:'wx'});
console.log('Created ignored .env with random local-only passwords.');
