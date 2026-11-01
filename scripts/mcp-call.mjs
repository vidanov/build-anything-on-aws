#!/usr/bin/env node
// Calls one AWS API operation through the managed AWS MCP Server, the same path an agent takes
// (mcp-proxy-for-aws-cli, pinned like .mcp.json). Used by scripts/fact-checks.sh for F5/F6.
//   node scripts/mcp-call.mjs [--profile p] [--region r] s3 ListBuckets ['{"json":"params"}']
// Credentials: --profile, or the AWS_* environment variables when no profile is given.
// The server runs API calls only inside aws___run_script (Python with call_boto3). That tool is
// marked destructive, so --read-only hides it (F7); this script starts the proxy without it.
// Prints one JSON line. Exit 0: the call ran. Exit 3: AccessDenied. Exit 1: anything else.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const PROXY = 'mcp-proxy-for-aws-cli==1.7.0';
const argv = process.argv.slice(2);
const opts = {};
while (argv[0]?.startsWith('--')) { const k = argv.shift().slice(2); opts[k] = argv.shift(); }
const [service, operation, params = '{}'] = argv;
if (!service || !operation) { console.error('usage: mcp-call.mjs [--profile p] [--region r] <service> <Operation> [json-params]'); process.exit(1); }
const region = opts.region ?? process.env.AWS_REGION ?? 'eu-central-1';
const call = `${service} ${operation}`;

const args = [PROXY, `https://aws-mcp.${region}.api.aws/mcp`, '--region', region];
if (opts.profile) args.push('--profile', opts.profile);
const env = { ...process.env };
if (!opts.profile) delete env.AWS_PROFILE; // env credentials must win over a profile from the shell

const proxy = spawn('uvx', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
let stderr = '';
proxy.stderr.on('data', (d) => { stderr += d; });
const pending = new Map();
createInterface({ input: proxy.stdout }).on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
let nextId = 1;
const request = (method, p) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  proxy.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: p }) + '\n');
});
const done = (code, result) => { console.log(JSON.stringify(result)); proxy.kill(); process.exit(code); };
setTimeout(() => done(1, { call, error: 'timeout after 240 s', stderr: stderr.slice(-500) }), 240_000).unref();
proxy.on('exit', (code) => done(1, { call, error: `proxy exited with ${code}`, stderr: stderr.slice(-500) }));

const init = await request('initialize', {
  protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'baa-fact-checks', version: '0.1.0' },
});
if (init.error) done(1, { call, error: init.error });
proxy.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

const list = await request('tools/list', {});
const tool = list.result?.tools?.find((t) => t.name.endsWith('run_script'));
if (!tool) done(1, { call, error: 'no run_script tool', tools: list.result?.tools?.map((t) => t.name) ?? list.error });

// Python inside the server's sandbox. It blocks dunder attributes (__name__), and ClientError
// is not defined there despite the tool description, so errors are caught as Exception.
const code = `
try:
    r = await call_boto3(service_name=${JSON.stringify(service)}, operation_name=${JSON.stringify(operation)}, params=json.loads(${JSON.stringify(params)}))
    result = {"ok": True, "keys": sorted(k for k in r.keys() if k != "ResponseMetadata")}
except Exception as e:
    result = {"ok": False, "message": str(e)}
result
`;
const res = await request('tools/call', { name: tool.name, arguments: { code } });
const raw = res.result?.content?.[0]?.text ?? JSON.stringify(res.error ?? '');
let out;
try { out = JSON.parse(raw); } catch { out = { status: 'unparsed', raw: raw.slice(0, 800) }; }
const value = out.return_value ?? out.result;
const denied = /AccessDenied|not authorized|explicit deny/i.test(JSON.stringify(value ?? out));
const ok = !res.error && !res.result?.isError && out.status !== 'error' && value?.ok === true;
done(denied ? 3 : ok ? 0 : 1, { call, tool: tool.name, denied, ok, value, apiCalls: out.api_calls, status: out.status, error: out.error });
