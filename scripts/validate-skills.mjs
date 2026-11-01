#!/usr/bin/env node
// Checks every SKILL.md against the Agent Skills spec and this repo's rules:
// name <= 64 chars and equal to the folder, description <= 1024, body < 500 lines,
// a "Done when" section, user-invoked skills have agents/openai.yaml, every skill is listed
// in .claude-plugin/plugin.json, and no two descriptions overlap too much (trigger collisions).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const find = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? find(p) : f === 'SKILL.md' ? [p] : [];
});
const files = find(join(root, 'skills'));
const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
const listed = new Set(plugin.skills.map((s) => s.replace(/^\.\//, '')));
const errors = [];
const skills = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const rel = dirname(file).slice(root.length);
  if (!m) { errors.push(`${rel}: no frontmatter`); continue; }
  const fm = Object.fromEntries(m[1].split('\n').map((l) => l.split(/:\s(.*)/s)).filter((p) => p.length > 1).map(([k, v]) => [k.trim(), v.trim()]));
  const body = m[2];
  if (!fm.name || fm.name.length > 64) errors.push(`${rel}: name missing or longer than 64`);
  if (fm.name !== basename(dirname(file))) errors.push(`${rel}: name "${fm.name}" differs from folder`);
  if (!fm.description || fm.description.length > 1024) errors.push(`${rel}: description missing or longer than 1024`);
  if (body.split('\n').length >= 500) errors.push(`${rel}: body has 500 lines or more`);
  if (!/^## Done when/m.test(body)) errors.push(`${rel}: no "## Done when" section`);
  if (fm['disable-model-invocation'] === 'true' && !existsSync(join(dirname(file), 'agents/openai.yaml'))) errors.push(`${rel}: user-invoked skill without agents/openai.yaml (Codex)`);
  if (!listed.has(rel)) errors.push(`${rel}: not listed in .claude-plugin/plugin.json`);
  skills.push({ rel, words: new Set(fm.description.toLowerCase().match(/[a-z][a-z-]{3,}/g)) });
}
for (const s of listed) if (!files.some((f) => dirname(f).slice(root.length) === s)) errors.push(`plugin.json lists ${s}, which has no SKILL.md`);

// Collision check: Jaccard similarity of description words, ignoring shared project words.
const common = new Set(['build', 'anything', 'project', 'learner', 'level', 'docs', 'with', 'from', 'that', 'each', 'every', 'into', 'their', 'when', 'aws']);
for (let i = 0; i < skills.length; i++) for (let j = i + 1; j < skills.length; j++) {
  const a = [...skills[i].words].filter((w) => !common.has(w));
  const b = new Set([...skills[j].words].filter((w) => !common.has(w)));
  const inter = a.filter((w) => b.has(w)).length;
  const sim = inter / (a.length + b.size - inter || 1);
  if (sim > 0.35) errors.push(`descriptions of ${skills[i].rel} and ${skills[j].rel} overlap (${sim.toFixed(2)})`);
}

if (errors.length) { for (const e of errors) console.error(`validate-skills: ${e}`); process.exit(1); }
console.log(`validate-skills: ${skills.length} skills ok`);
