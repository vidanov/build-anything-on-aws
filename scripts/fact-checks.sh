#!/usr/bin/env bash
# Day-1 fact checks in a SANDBOX account. A human runs this with admin credentials.
# It creates two throwaway IAM roles and deletes them at the end. Nothing else is created.
# Results go to fact-checks-result.txt; copy the verdicts into docs/FACT-CHECKS.md.
#   AWS_PROFILE=<sandbox-admin> bash scripts/fact-checks.sh
set -euo pipefail
OUT=fact-checks-result.txt
: > "$OUT"
log() { echo "$*" | tee -a "$OUT"; }

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ME=$(aws sts get-caller-identity --query Arn --output text)
REGION=${AWS_REGION:-eu-central-1}
log "account $ACCOUNT region $REGION caller $ME $(date -u +%FT%TZ)"

trust=$(cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::$ACCOUNT:root"},"Action":"sts:AssumeRole"}]}
JSON
)

make_role() { # name deny-condition-json
  aws iam create-role --role-name "$1" --assume-role-policy-document "$trust" >/dev/null
  aws iam attach-role-policy --role-name "$1" --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
  aws iam put-role-policy --role-name "$1" --policy-name deny-via-mcp --policy-document "$2"
}
cleanup() {
  for r in baa-fact-viamcp baa-fact-calledvia; do
    aws iam detach-role-policy --role-name $r --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess 2>/dev/null || true
    aws iam delete-role-policy --role-name $r --policy-name deny-via-mcp 2>/dev/null || true
    aws iam delete-role --role-name $r 2>/dev/null || true
  done
}
trap cleanup EXIT

# F5: deny s3:ListAllMyBuckets when the call comes through the AWS MCP Server (bool key)
make_role baa-fact-viamcp '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"s3:ListAllMyBuckets","Resource":"*","Condition":{"Bool":{"aws:ViaAWSMCPService":"true"}}}]}'
# F6: same with the string key and the service principal value
make_role baa-fact-calledvia '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"s3:ListAllMyBuckets","Resource":"*","Condition":{"StringEquals":{"aws:CalledViaAWSMCP":"aws-mcp.amazonaws.com"}}}]}'
sleep 10

log ""
log "F5/F6, step 1 (direct CLI, both roles): expected ALLOWED, because the keys only apply via MCP"
for r in baa-fact-viamcp baa-fact-calledvia; do
  creds=$(aws sts assume-role --role-arn "arn:aws:iam::$ACCOUNT:role/$r" --role-session-name fact --query Credentials --output json)
  if AWS_ACCESS_KEY_ID=$(jq -r .AccessKeyId <<<"$creds") AWS_SECRET_ACCESS_KEY=$(jq -r .SecretAccessKey <<<"$creds") AWS_SESSION_TOKEN=$(jq -r .SessionToken <<<"$creds") \
     aws s3api list-buckets --query 'length(Buckets)' >/dev/null 2>&1; then log "  $r direct: ALLOWED"; else log "  $r direct: DENIED (unexpected)"; fi
done

log ""
log "F5/F6, step 2 (through the AWS MCP Server): do this by hand in your agent, for each role:"
log "  1. add a profile:  [profile baa-fact-viamcp] role_arn=arn:aws:iam::$ACCOUNT:role/baa-fact-viamcp source_profile=<this profile>"
log "  2. start the proxy: uvx mcp-proxy-for-aws-cli==1.7.0 https://aws-mcp.$REGION.api.aws/mcp --profile baa-fact-viamcp --region $REGION"
log "  3. ask the agent: call aws s3api list-buckets through the aws-mcp server"
log "  expected: AccessDenied for both roles. If only one is denied, that key is the one that works."
log "  CloudTrail: look up ListBuckets events and note the condition keys in the request context."
log ""
read -r -p "Press Enter after step 2 (the roles are deleted when this script ends) " _

log ""
log "F1 (local, no AWS needed): run in the template: npx ts-node gates/drills/nag-drill.ts wildcard-action /tmp/d; echo \$?"
log "done $(date -u +%FT%TZ)"
