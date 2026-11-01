#!/usr/bin/env bash
# Day-1 fact checks in a SANDBOX account. A human runs this with admin credentials, after the
# envelope and its BootstrapCommand. It creates two throwaway IAM roles and two one-role
# CloudFormation stacks, and deletes them at the end. Nothing else is created.
# Needs jq, node and uvx (for the AWS MCP proxy). Takes about 5 minutes.
# Results go to fact-checks-result.txt; copy the verdicts into docs/FACT-CHECKS.md.
#   AWS_PROFILE=<sandbox-admin> bash scripts/fact-checks.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=fact-checks-result.txt
: > "$OUT"
log() { echo "$*" | tee -a "$OUT"; }

export AWS_REGION=${AWS_REGION:-eu-central-1}
REGION=$AWS_REGION
QUALIFIER=baa # template/envelope/envelope-stack.ts
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ME=$(aws sts get-caller-identity --query Arn --output text)
START=$(date -u +%FT%TZ)
log "account $ACCOUNT region $REGION caller $ME $START"

trust=$(cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::$ACCOUNT:root"},"Action":"sts:AssumeRole"}]}
JSON
)

make_role() { # name deny-condition-json
  aws iam create-role --role-name "$1" --assume-role-policy-document "$trust" >/dev/null
  aws iam attach-role-policy --role-name "$1" --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
  aws iam put-role-policy --role-name "$1" --policy-name deny-via-mcp --policy-document "$2"
}
as_role() { # role-name cmd... : run cmd with that role's credentials instead of the admin profile
  local creds
  creds=$(aws sts assume-role --role-arn "arn:aws:iam::$ACCOUNT:role/$1" --role-session-name fact --query Credentials --output json)
  shift
  env -u AWS_PROFILE AWS_ACCESS_KEY_ID="$(jq -r .AccessKeyId <<<"$creds")" \
    AWS_SECRET_ACCESS_KEY="$(jq -r .SecretAccessKey <<<"$creds")" AWS_SESSION_TOKEN="$(jq -r .SessionToken <<<"$creds")" "$@"
}
cleanup() {
  for r in baa-fact-viamcp baa-fact-calledvia; do
    aws iam detach-role-policy --role-name $r --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess 2>/dev/null || true
    aws iam delete-role-policy --role-name $r --policy-name deny-via-mcp 2>/dev/null || true
    aws iam delete-role --role-name $r 2>/dev/null || true
  done
  for s in baa-fact-boundary-with baa-fact-boundary-without; do
    aws cloudformation describe-stacks --stack-name $s >/dev/null 2>&1 || continue
    aws cloudformation delete-stack --stack-name $s
    aws cloudformation wait stack-delete-complete --stack-name $s || echo "delete $s by hand"
  done
}
trap cleanup EXIT

# F5: deny s3:ListAllMyBuckets when the call comes through the AWS MCP Server (bool key)
make_role baa-fact-viamcp '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"s3:ListAllMyBuckets","Resource":"*","Condition":{"Bool":{"aws:ViaAWSMCPService":"true"}}}]}'
# F6: same with the string key and the service principal value
make_role baa-fact-calledvia '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"s3:ListAllMyBuckets","Resource":"*","Condition":{"StringEquals":{"aws:CalledViaAWSMCP":"aws-mcp.amazonaws.com"}}}]}'
sleep 10

log ""
log "F5/F6, check 1 (direct CLI, both roles): expected ALLOWED, because the keys only apply via MCP"
for r in baa-fact-viamcp baa-fact-calledvia; do
  if as_role $r aws s3api list-buckets --query 'length(Buckets)' >/dev/null 2>&1; then log "  $r direct: ALLOWED"; else log "  $r direct: DENIED (unexpected)"; fi
done

log ""
log "F5/F6, check 2 (through the AWS MCP Server, aws___run_script): expected DENIED where the key works"
for r in baa-fact-viamcp baa-fact-calledvia; do
  rc=0
  res=$(as_role $r node scripts/mcp-call.mjs --region "$REGION" s3 ListBuckets) || rc=$?
  case $rc in 0) v=ALLOWED ;; 3) v=DENIED ;; *) v=ERROR ;; esac
  log "  $r via MCP: $v"
  log "    $res"
done
log "  If only one role is DENIED, that key is the one that works. Both ALLOWED: neither key is set."
log "  CloudTrail (events arrive after 5 to 15 minutes), the request context shows the keys:"
log "    aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=ListBuckets --start-time $START --query 'Events[].CloudTrailEvent' --output text"

log ""
log "F12, check 4 (CloudFormation through the BAA execution role): a role with baa-boundary"
log "  expected CREATED, a role without it expected FAILED with AccessDenied; both stacks must delete"
EXEC=cdk-$QUALIFIER-cfn-exec-role-$ACCOUNT-$REGION
role_template() { # with|without
  local pb=""
  [ "$1" = with ] && pb=",\"PermissionsBoundary\":\"arn:aws:iam::$ACCOUNT:policy/baa-boundary\""
  echo "{\"Resources\":{\"R\":{\"Type\":\"AWS::IAM::Role\",\"Properties\":{\"AssumeRolePolicyDocument\":{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"lambda.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}$pb}}}}"
}
if ! aws iam get-role --role-name "$EXEC" >/dev/null 2>&1; then
  log "  skipped: $EXEC not found. Deploy the envelope and run its BootstrapCommand first."
else
  log "  $EXEC boundary: $(aws iam get-role --role-name "$EXEC" --query Role.PermissionsBoundary.PermissionsBoundaryArn --output text)"
  log "  $EXEC policies: $(aws iam list-attached-role-policies --role-name "$EXEC" --query 'AttachedPolicies[].PolicyName' --output text)"
  for kind in with without; do
    s=baa-fact-boundary-$kind
    aws cloudformation create-stack --stack-name $s --role-arn "arn:aws:iam::$ACCOUNT:role/$EXEC" --template-body "$(role_template $kind)" >/dev/null
    if aws cloudformation wait stack-create-complete --stack-name $s 2>/dev/null; then v=CREATED
    else v="FAILED: $(aws cloudformation describe-stack-events --stack-name $s --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].ResourceStatusReason | [0]" --output text)"; fi
    log "  $kind boundary: $v"
    # The delete runs through the same execution role, like the teardown of an App-pr-<n> stack.
    aws cloudformation delete-stack --stack-name $s
    if aws cloudformation wait stack-delete-complete --stack-name $s 2>/dev/null; then log "  $kind boundary: stack deleted"
    else log "  $kind boundary: DELETE FAILED: $(aws cloudformation describe-stack-events --stack-name $s --query "StackEvents[?ResourceStatus=='DELETE_FAILED'].ResourceStatusReason | [0]" --output text)"; fi
  done
fi

log ""
log "F1 (local, no AWS needed): run in the template: npx ts-node gates/drills/nag-drill.ts wildcard-action /tmp/d; echo \$?"
log "done $(date -u +%FT%TZ)"
