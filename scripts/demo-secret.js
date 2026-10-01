import {mkdtempSync,writeFileSync,rmSync,mkdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'crm-secret-demo-'));
try {
 execFileSync('git',['init','-q'],{cwd:dir});
 execFileSync('git',['config','user.name','Synthetic Demo'],{cwd:dir});execFileSync('git',['config','user.email','demo@example.test'],{cwd:dir});
 mkdirSync(join(dir,'scripts'));mkdirSync(join(dir,'.githooks'));
 copyFileSync(new URL('./scan-secrets.js',import.meta.url),join(dir,'scripts/scan-secrets.mjs'));
 writeFileSync(join(dir,'.githooks/pre-commit'),'#!/bin/sh\nnode scripts/scan-secrets.mjs --staged\n',{mode:0o755});
 execFileSync('git',['config','core.hooksPath','.githooks'],{cwd:dir});
 writeFileSync(join(dir,'fake-secret.txt'),'IAS_DEMO_'+'SECRET_'+'A'.repeat(24));
 execFileSync('git',['add','.'],{cwd:dir});
 const result=spawnSync('git',['commit','-m','Synthetic rejection demonstration'],{cwd:dir,encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Possible secret in fake-secret/);
 console.log(result.stderr.trim());console.log('PASS: actual pre-commit hook rejected a synthetic secret. No secret was pushed.');
} finally {rmSync(dir,{recursive:true,force:true});}
