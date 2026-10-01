import {execFileSync} from 'node:child_process';
const staged=process.argv.includes('--staged');
const args=staged?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','-z'];
const paths=execFileSync('git',args,{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/AKIA[A-Z0-9]{16}/,/gh[pousr]_[A-Za-z0-9]{36,}/,/github_pat_[A-Za-z0-9_]{50,}/,/IAS_DEMO_SECRET_[A-Za-z0-9]{24}/];
let bad=false;
for(const path of paths){
 if(/(^|\/)\.env(?:\..*)?$/.test(path)&&!path.endsWith('.env.example')) {console.error(`Blocked environment file: ${path}`);bad=true;continue;}
 if(/\.(png|jpg|pdf|docx|zip)$/.test(path))continue;
 const content=execFileSync('git',['show',`${staged?':':'HEAD:'}${path}`],{encoding:'utf8',maxBuffer:20*1024*1024});
 if(patterns.some(p=>p.test(content))){console.error(`Possible secret in ${path} (value redacted)`);bad=true;}
}
if(bad)process.exit(1);console.log('Secret-pattern check passed. CI also runs Gitleaks.');
