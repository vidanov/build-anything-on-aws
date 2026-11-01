#!/usr/bin/env node
// Manufactured oracle: after a real deploy, ask the real endpoints. The site must answer 200
// over CloudFront, /health must answer {"ok":true}, POST /visits must count up.
// Usage: node gates/scripts/smoke.mjs outputs.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const outputs = JSON.parse(readFileSync(process.argv[2] ?? 'outputs.json', 'utf8'));
const stack = Object.values(outputs)[0] ?? {};
const site = stack.SiteUrl;
const api = stack.ApiUrl;
const checks = [];

async function check(name, fn) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await fn();
      checks.push({ name, ok: true, attempt });
      return;
    } catch (e) {
      if (attempt === 6) checks.push({ name, ok: false, error: String(e.message ?? e) });
      else await new Promise((r) => setTimeout(r, 10_000)); // CloudFront can take a moment
    }
  }
}

await check('site answers 200 over HTTPS', async () => {
  const r = await fetch(site);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});
await check('site redirects HTTP to HTTPS', async () => {
  const r = await fetch(site.replace('https://', 'http://'), { redirect: 'manual' });
  if (![301, 302, 307, 308].includes(r.status)) throw new Error(`status ${r.status}`);
});
await check('GET /health answers ok', async () => {
  const r = await fetch(`${api}/health`);
  const body = await r.json();
  if (r.status !== 200 || body.ok !== true) throw new Error(`status ${r.status} ${JSON.stringify(body)}`);
});
await check('POST /visits counts up', async () => {
  const a = await (await fetch(`${api}/visits`, { method: 'POST' })).json();
  const b = await (await fetch(`${api}/visits`, { method: 'POST' })).json();
  if (!(b.visits > a.visits)) throw new Error(`${a.visits} then ${b.visits}`);
});
await check('unknown route is not served', async () => {
  const r = await fetch(`${api}/admin`);
  if (r.status < 400) throw new Error(`status ${r.status}`);
});

const ok = checks.every((c) => c.ok);
mkdirSync('cdk.out', { recursive: true });
writeFileSync('cdk.out/smoke-result.json', JSON.stringify({ ok, site, api, checks }, null, 2));
for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.error ? `: ${c.error}` : ''}`);
process.exit(ok ? 0 : 1);
