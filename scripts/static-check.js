import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
for(const name of readdirSync('src',{recursive:true}).filter(n=>n.endsWith('.js'))){
 const source=readFileSync(`src/${name}`,'utf8');
 assert.ok(!/eval\s*\(|new Function\s*\(/.test(source),`Dynamic execution in ${name}`);
 assert.ok(!/vulnerable-app|demo\//.test(source),`Demo import in normal app: ${name}`);
}
console.log('Application static invariants passed; Semgrep runs separately in CI.');
