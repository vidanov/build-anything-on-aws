// Drills for the envelope contract. They read the synthesized envelope template, so they need
// no AWS account. What they cannot prove (that IAM evaluates the conditions as intended) is
// listed in docs/FACT-CHECKS.md and checked in a sandbox account.
import { App, CliCredentialsStackSynthesizer } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EnvelopeStack } from '../envelope/envelope-stack';

function synth(extra: Partial<{ githubOwnerId: string; githubRepoId: string; profile: 'A' | 'B' | 'C' }> = {}): Template {
  const app = new App();
  const stack = new EnvelopeStack(app, 'BaaEnvelope', {
    env: { account: '111111111111', region: 'eu-central-1' },
    synthesizer: new CliCredentialsStackSynthesizer(),
    profile: extra.profile ?? 'B',
    githubOwner: 'learner',
    githubRepo: 'my-app',
    githubOwnerId: extra.githubOwnerId,
    githubRepoId: extra.githubRepoId,
    alertEmail: 'learner@example.com',
    monthlyBudgetUsd: 20,
    allowedRegions: ['eu-central-1', 'us-east-1'],
  });
  return Template.fromStack(stack);
}

const statements = (t: Template, name: string) => {
  const p = Object.values(t.findResources('AWS::IAM::ManagedPolicy')).find((r) => r.Properties.ManagedPolicyName === name);
  if (!p) throw new Error(`policy ${name} missing`);
  return p.Properties.PolicyDocument.Statement as Array<Record<string, any>>;
};

describe('GitHub OIDC trust', () => {
  test('every GitHub role trusts exact subjects of one repository, never a wildcard', () => {
    const t = synth();
    const roles = Object.values(t.findResources('AWS::IAM::Role')).filter((r) => String(r.Properties.RoleName).startsWith('baa-gha-'));
    expect(roles.map((r) => r.Properties.RoleName).sort()).toEqual(['baa-gha-dev', 'baa-gha-pr', 'baa-gha-prod']);
    for (const r of roles) {
      const st = r.Properties.AssumeRolePolicyDocument.Statement[0];
      expect(st.Condition.StringEquals['token.actions.githubusercontent.com:aud']).toBe('sts.amazonaws.com');
      const subs: string[] = [].concat(st.Condition['ForAnyValue:StringLike']['token.actions.githubusercontent.com:sub']);
      for (const s of subs) {
        expect(s).not.toContain('*');
        expect(s.startsWith('repo:learner')).toBe(true);
      }
    }
  });

  test('prod only trusts the prod environment, dev only main', () => {
    const t = synth();
    const sub = (name: string) => Object.values(t.findResources('AWS::IAM::Role')).find((r) => r.Properties.RoleName === name)!
      .Properties.AssumeRolePolicyDocument.Statement[0].Condition['ForAnyValue:StringLike']['token.actions.githubusercontent.com:sub'];
    expect([].concat(sub('baa-gha-prod'))).toEqual(['repo:learner/my-app:environment:prod']);
    expect([].concat(sub('baa-gha-dev'))).toEqual(['repo:learner/my-app:ref:refs/heads/main']);
  });

  test('immutable subject claims are trusted alongside the classic format when IDs are given', () => {
    const t = synth({ githubOwnerId: '123', githubRepoId: '456' });
    const role = Object.values(t.findResources('AWS::IAM::Role')).find((r) => r.Properties.RoleName === 'baa-gha-prod')!;
    const subs = role.Properties.AssumeRolePolicyDocument.Statement[0].Condition['ForAnyValue:StringLike']['token.actions.githubusercontent.com:sub'];
    expect(subs).toEqual(['repo:learner/my-app:environment:prod', 'repo:learner@123/my-app@456:environment:prod']);
  });
});

describe('permissions boundary', () => {
  const t = synth();
  const sids = statements(t, 'baa-boundary').map((s) => s.Sid);

  test('contains every deny the envelope promises', () => {
    for (const sid of ['DenyOutsideAllowedRegions', 'RolesMustCarryTheBoundary', 'BoundaryCannotBeRemovedOrEdited', 'NoUsersNoKeys', 'AuditStaysOn', 'NoNatGateways', 'OnlySmallInstances', 'NoProvisionedThroughput']) {
      expect(sids).toContain(sid);
    }
  });

  test('role creation is allowed only with this same boundary (CDK apps need CreateRole)', () => {
    const st = statements(t, 'baa-boundary').find((s) => s.Sid === 'RolesMustCarryTheBoundary')!;
    expect(st.Effect).toBe('Deny');
    expect(JSON.stringify(st.Condition.StringNotEquals['iam:PermissionsBoundary'])).toContain('policy/baa-boundary');
  });

  test('every role in the envelope carries the boundary', () => {
    for (const r of Object.values(t.findResources('AWS::IAM::Role'))) {
      expect(r.Properties.PermissionsBoundary).toBeDefined();
    }
  });
});

describe('CloudFormation execution policy', () => {
  test('is not AdministratorAccess: no Action "*" and IAM only with the boundary', () => {
    const st = statements(synth(), 'baa-cfn-exec');
    for (const s of st) expect([].concat(s.Action)).not.toContain('*');
    const create = st.find((s) => s.Sid === 'AppRolesWithBoundary')!;
    expect(JSON.stringify(create.Condition)).toContain('policy/baa-boundary');
  });
});

describe('agent and money', () => {
  test('the agent role is read-only and cannot read data or secrets', () => {
    const t = synth();
    const role = Object.values(t.findResources('AWS::IAM::Role')).find((r) => r.Properties.RoleName === 'baa-agent-readonly')!;
    expect(JSON.stringify(role.Properties.ManagedPolicyArns)).toContain('ReadOnlyAccess');
    const denies = Object.values(t.findResources('AWS::IAM::Policy')).flatMap((p) => p.Properties.PolicyDocument.Statement).filter((s: any) => s.Effect === 'Deny');
    const actions = denies.flatMap((s: any) => [].concat(s.Action));
    for (const a of ['s3:GetObject*', 'secretsmanager:GetSecretValue', 'dynamodb:Scan', 'kms:Decrypt']) expect(actions).toContain(a);
  });

  test('a monthly budget alerts by email, including on the forecast', () => {
    const t = synth();
    t.hasResourceProperties('AWS::Budgets::Budget', { Budget: { BudgetType: 'COST', TimeUnit: 'MONTHLY', BudgetLimit: { Amount: 20, Unit: 'USD' } } });
    const b = Object.values(t.findResources('AWS::Budgets::Budget'))[0];
    const types = b.Properties.NotificationsWithSubscribers.map((n: any) => n.Notification.NotificationType);
    expect(types).toContain('FORECASTED');
  });

  test('profile B gets its own trail, profile A does not', () => {
    synth({ profile: 'B' }).resourceCountIs('AWS::CloudTrail::Trail', 1);
    synth({ profile: 'A' }).resourceCountIs('AWS::CloudTrail::Trail', 0);
  });
});
