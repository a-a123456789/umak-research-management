import {readFile} from 'node:fs/promises';
const path=process.env.BACKUP_STATUS_FILE;if(!path)throw Error('BACKUP_STATUS_FILE required');
const status=JSON.parse(await readFile(path,'utf8'));
const age=Date.now()-Date.parse(status.last_success);
if(!Number.isFinite(age)||age<0||age>26*3600_000||!status.offsite)throw Error('Offsite backup missing, stale or unverified');
console.log(JSON.stringify({result:'PASS',age_hours:age/3600_000}));
