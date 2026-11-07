import { createHash } from 'node:crypto';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join() !== [...keys].sort().join()) throw Error(`Invalid fields: ${label}`);
};
export async function checkSkills(root) {
  const registry = JSON.parse(await readFile(join(root, 'security/skills/registry.json'), 'utf8'));
  exactKeys(registry, ['version', 'skills'], 'registry');
  if (registry.version !== 1 || !Array.isArray(registry.skills)) throw Error('Invalid registry version or skills');
  const entries = await readdir(join(root, '.agents/skills'));
  if (entries.sort().join() !== registry.skills.map(s => s.name).sort().join()) throw Error('Unregistered or missing skill');
  const lock = JSON.parse(await readFile(join(root, 'skills-lock.json'), 'utf8'));
  if (Object.keys(lock.skills).sort().join() !== entries.join()) throw Error('Skill lock inventory mismatch');
  for (const skill of registry.skills) {
    exactKeys(skill, ['name', 'source', 'revision', 'sourcePath', 'folderHash', 'files', 'externalInstructions', 'platforms', 'permissions', 'review'], 'skill');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(skill.name) || !/^[a-f0-9]{40}$/.test(skill.revision) ||
        !/^[a-f0-9]{64}$/.test(skill.folderHash) || !/^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/.test(skill.source) ||
        !/^skills\/[a-z0-9-]+$/.test(skill.sourcePath)) throw Error('Invalid skill identity');
    if (JSON.stringify(skill.platforms) !== '["codex"]' ||
        JSON.stringify(skill.externalInstructions) !== '[]') throw Error('Platform or external instructions require policy review');
    exactKeys(skill.permissions, ['source', 'writes', 'network', 'secrets', 'processes', 'enforcement'], 'permissions');
    const expected = {source:'read-only', writes:'assigned-scratch-and-parent-owned-reports', network:'deny-target-egress', secrets:'none', processes:'sandbox-only', enforcement:'unverified-runtime-execution-blocked'};
    if (JSON.stringify(skill.permissions) !== JSON.stringify(expected)) throw Error('Unexpected capability policy');
    exactKeys(skill.review, ['owner', 'status', 'date'], 'review');
    if (skill.review.owner !== 'repository-maintainers' || skill.review.status !== 'provenance-verified-runtime-not-approved' || !/^\d{4}-\d{2}-\d{2}$/.test(skill.review.date)) throw Error('Invalid review state');
    const base = join(root, '.agents/skills', skill.name), files = [];
    async function walk(dir) {
      if (!(await lstat(dir)).isDirectory()) throw Error('Skill root must be a real directory');
      for (const entry of await readdir(dir, {withFileTypes:true})) {
        const path = join(dir, entry.name);
        if (entry.isSymbolicLink()) throw Error('Symlinks forbidden in skills');
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile()) files.push({path:relative(base,path).split('\\').join('/'), content:await readFile(path)});
        else throw Error('Non-regular skill content');
      }
    }
    await walk(base); files.sort((a,b) => a.path.localeCompare(b.path));
    const hash = createHash('sha256'), inventory = {};
    for (const file of files) {
      hash.update(file.path); hash.update(file.content); inventory[file.path] = digest(file.content);
      // Skill text may reference local companions. Remote instruction admission is deliberately disabled.
      if (/https?:\/\//i.test(file.content.toString('utf8'))) throw Error(`External reference requires inventory review: ${file.path}`);
    }
    if (JSON.stringify(inventory) !== JSON.stringify(skill.files)) throw Error('Skill file inventory/hash mismatch');
    if (hash.digest('hex') !== skill.folderHash || lock.skills[skill.name]?.computedHash !== skill.folderHash ||
        lock.skills[skill.name]?.source !== skill.source.replace('https://github.com/','') ||
        lock.skills[skill.name]?.sourceType !== 'github' || lock.skills[skill.name]?.skillPath !== `${skill.sourcePath}/SKILL.md`) throw Error('Skill provenance/lock mismatch');
  }
  return `Verified ${registry.skills.length} skill(s); runtime execution remains blocked pending sandbox evidence.`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await checkSkills(resolve(process.argv[2] || '.'))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
