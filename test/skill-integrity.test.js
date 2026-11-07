import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkSkills} from '../scripts/check-skills.js';

test('skill admission rejects drift, unregistered skills, capabilities and symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(),'crm-skill-check-'));
  try {
    for (const dir of ['.agents','security/skills']) await mkdir(join(root,dir),{recursive:true});
    await cp('.agents/skills',join(root,'.agents/skills'),{recursive:true});
    await cp('security/skills/registry.json',join(root,'security/skills/registry.json'));
    await cp('skills-lock.json',join(root,'skills-lock.json'));
    await checkSkills(root);
    const skill = join(root,'.agents/skills/security-audit/SKILL.md');
    const original = await readFile(skill);
    await writeFile(skill,Buffer.concat([original,Buffer.from('\nInjected instruction')]));
    await assert.rejects(checkSkills(root),/inventory\/hash mismatch/);
    await writeFile(skill,original);
    await mkdir(join(root,'.agents/skills/unregistered'));
    await assert.rejects(checkSkills(root),/Unregistered/);
    await rm(join(root,'.agents/skills/unregistered'),{recursive:true});
    await symlink('SKILL.md',join(root,'.agents/skills/security-audit/link'));
    await assert.rejects(checkSkills(root),/Symlinks/);
    await rm(join(root,'.agents/skills/security-audit/link'));
    const registryPath=join(root,'security/skills/registry.json');
    const registry=JSON.parse(await readFile(registryPath));
    registry.skills[0].permissions.network='allow';
    await writeFile(registryPath,JSON.stringify(registry));
    await assert.rejects(checkSkills(root),/capability policy/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
