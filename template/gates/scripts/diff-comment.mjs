#!/usr/bin/env node
// Turns `cdk diff` output into a PR comment and puts it next to the learner's prediction.
// The prediction lives in the PR description under "## Prediction" (template in
// .github/pull_request_template.md). Comparing the two is a learning check with a real answer.
import { readFileSync } from 'node:fs';

const diff = readFileSync(process.argv[2] ?? 'diff.txt', 'utf8');
const lines = diff.split('\n');
const added = lines.filter((l) => /^\[\+\]/.test(l.trim())).length;
const removed = lines.filter((l) => /^\[-\]/.test(l.trim())).length;
const changed = lines.filter((l) => /^\[~\]/.test(l.trim())).length;
const replaced = lines.filter((l) => /may be replaced|requires replacement/i.test(l)).length;
const iam = /IAM Statement Changes|IAM Policy Changes/.test(diff);

console.log(`### cdk diff for ${process.env.BAA_STAGE ?? 'this PR'}

| added | changed | removed | replacements | IAM widened |
|---|---|---|---|---|
| ${added} | ${changed} | ${removed} | ${replaced} | ${iam ? 'yes, review the IAM table' : 'no'} |

Compare with your **Prediction** in the PR description. Where you were wrong is the lesson:
write one line about it in docs/FIXLOG.md.

<details><summary>Full diff</summary>

\`\`\`
${diff.slice(0, 60000)}
\`\`\`
</details>`);
