import { App, RemovalPolicy } from 'aws-cdk-lib';

export type StageKind = 'pr' | 'dev' | 'prod';

export interface Settings {
  readonly project: string;
  /** pr-<number>, dev or prod */
  readonly stage: string;
  readonly kind: StageKind;
  /** Region is a parameter from the first commit (profile A projects may not get eu-central-1). */
  readonly region: string;
  readonly alertEmail: string;
  readonly prTtlHours: number;
}

const STAGE_PATTERN = /^(pr-\d+|dev|prod)$/;

export function readSettings(app: App): Settings {
  const stage = String(app.node.tryGetContext('baa:stage') ?? 'dev');
  if (!STAGE_PATTERN.test(stage)) {
    throw new Error(`baa:stage must match pr-<n>, dev or prod. Got "${stage}".`);
  }
  const kind: StageKind = stage.startsWith('pr-') ? 'pr' : (stage as StageKind);
  return {
    project: String(app.node.tryGetContext('baa:project') ?? 'baa-app'),
    stage,
    kind,
    region: String(app.node.tryGetContext('baa:region') ?? process.env.CDK_DEFAULT_REGION ?? 'eu-central-1'),
    alertEmail: String(app.node.tryGetContext('baa:alertEmail') ?? ''),
    prTtlHours: Number(app.node.tryGetContext('baa:prTtlHours') ?? 48),
  };
}

/**
 * Stateful resources: throwaway PR stacks must delete them, prod must keep them.
 * gates/guard/stage-removal.guard checks the synthesized result.
 */
export function removalFor(settings: Settings): RemovalPolicy {
  return settings.kind === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
}
