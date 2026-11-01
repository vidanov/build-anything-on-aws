// Drill for the deny hook: every pattern must block its example, and safe commands must pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hook = join(dirname(fileURLToPath(import.meta.url)), '..', 'deny-aws.mjs');
const run = (cmd) => spawnSync('node', [hook], { input: JSON.stringify({ tool_input: { command: cmd } }), encoding: 'utf8' });

const blocked = {
  'aws-s1': 'aws organizations delete-organization',
  'aws-s2': 'aws organizations remove-account-from-organization --account-id 1',
  'aws-s3': 'aws account close-account --account-id 1',
  'aws-s4': 'aws s3api put-bucket-acl --bucket b --acl public-read',
  'aws-s5': 'aws s3api delete-public-access-block --bucket b',
  'aws-s6': 'aws s3api put-bucket-policy --bucket b --policy {"Principal":"*","Effect":"Allow"}',
  'aws-s7': 'aws ec2 authorize-security-group-ingress --group-id sg-1 --cidr 0.0.0.0/0 --port 22',
  'aws-s8': 'aws iam attach-role-policy --role-name r --policy-arn arn:aws:iam::aws:policy/AdministratorAccess',
  'aws-s9': 'aws iam create-policy-version --policy-arn x --policy-document file://p.json --set-as-default',
  'aws-s10': 'aws iam delete-account-password-policy',
  'aws-s11': 'aws cloudtrail stop-logging --name t',
  'aws-s12': 'aws configservice delete-configuration-recorder --configuration-recorder-name default',
  'aws-s13': 'aws iam create-access-key --user-name u',
  'aws-s14': 'aws kms schedule-key-deletion --key-id k',
  'aws-s15': 'aws kms disable-key --key-id k',
  'aws-s16': 'aws rds delete-db-instance --db-instance-identifier d --skip-final-snapshot',
  'aws-s17': 'aws ec2 modify-instance-attribute --instance-id i --no-disable-api-termination DisableApiTermination false',
  'baa-1': 'npx cdk deploy App-prod',
  'baa-2': 'aws secretsmanager get-secret-value --secret-id s',
  'baa-3': 'aws ssm get-parameter --name /x --with-decryption',
  'baa-4': 'aws cloudformation delete-stack --stack-name App-prod',
  'baa-5': 'aws iam delete-role-permissions-boundary --role-name r',
  'baa-6': 'aws iam create-user --user-name bob',
  'baa-7': 'git push --force origin main',
  'baa-8': 'git commit -m x --no-verify',
  'baa-9': 'cat .env',
};

for (const [id, cmd] of Object.entries(blocked)) {
  test(`${id} blocks: ${cmd}`, () => {
    const r = run(cmd);
    assert.equal(r.status, 2, `expected block for ${cmd}`);
    assert.match(r.stderr, new RegExp(`${id}\\b`));
  });
}

for (const cmd of ['npx cdk synth', 'npx cdk diff', 'npm run gates', 'aws sts get-caller-identity', 'git push origin feature/s-001', 'cat README.md', 'aws s3 ls']) {
  test(`allows: ${cmd}`, () => assert.equal(run(cmd).status, 0));
}

test('unparseable input is blocked, not waved through', () => {
  const r = spawnSync('node', [hook], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 2);
});
