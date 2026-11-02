#!/usr/bin/env bash
# Removes what a Build Anything on AWS project leaves in the account. The human runs it with
# admin rights, one part at a time, in this order (the `teardown` skill explains each):
#   bash envelope/teardown.sh inventory   # read-only: what exists, what each stack left behind
#   (teardown.yml removes App-dev and App-prod; closing PRs removes App-pr-<n>)
#   bash envelope/teardown.sh prod-data   # table, buckets and log groups App-prod keeps on delete
#   bash envelope/teardown.sh toolkit     # BaaToolkit and its staging bucket
#   bash envelope/teardown.sh envelope    # BaaEnvelope: boundary, roles, OIDC, budget, trail
# Every part that deletes asks for the name of what it deletes. Region: BAA_REGION or cdk.json.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${BAA_REGION:-$(node -p "require('./cdk.json').context['baa:region']")}"
export AWS_REGION="$REGION"
PART="${1:-}"

say() { printf '\n== %s\n' "$*"; }
confirm() { # name
  local answer
  printf 'Type %s to continue, anything else stops: ' "$1"
  read -r answer </dev/tty
  [ "$answer" = "$1" ] || { echo "Stopped, nothing deleted."; exit 1; }
}
stack_status() { # name; prints NONE when the stack does not exist
  aws cloudformation describe-stacks --stack-name "$1" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo NONE
}
last_deleted_id() { # name; StackId of the newest DELETE_COMPLETE stack with that name
  aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE \
    --query "sort_by(StackSummaries[?StackName=='$1'], &DeletionTime)[-1].StackId" --output text
}
retained() { # name; "type<TAB>physical id" for each resource the delete skipped
  local id; id=$(last_deleted_id "$1")
  [ "$id" = None ] || [ -z "$id" ] && return 0
  aws cloudformation list-stack-resources --stack-name "$id" \
    --query "StackResourceSummaries[?ResourceStatus=='DELETE_SKIPPED'].[ResourceType,PhysicalResourceId]" --output text
}
exists() { # type id
  case "$1" in
    AWS::S3::Bucket) aws s3api head-bucket --bucket "$2" >/dev/null 2>&1 ;;
    AWS::DynamoDB::Table) aws dynamodb describe-table --table-name "$2" >/dev/null 2>&1 ;;
    AWS::ECR::Repository) aws ecr describe-repositories --repository-names "$2" >/dev/null 2>&1 ;;
    AWS::Logs::LogGroup) [ "$(aws logs describe-log-groups --log-group-name-prefix "$2" \
      --query "length(logGroups[?logGroupName=='$2'])" --output text)" = 1 ] ;;
    *) return 0 ;;
  esac
}
require_admin() {
  local arn; arn=$(aws sts get-caller-identity --query Arn --output text)
  case "$arn" in *assumed-role/baa-agent-readonly/*) echo "Signed in as the agent role ($arn). This part needs the human's admin sign-in."; exit 1 ;; esac
  echo "Signed in as $arn, region $REGION"
}

# Versioned buckets keep every old version and delete marker; all of them must go first.
empty_bucket() { # bucket
  local batch count
  while :; do
    batch=$(aws s3api list-object-versions --bucket "$1" --max-items 1000 --output json \
      --query '{Objects: [Versions[].{Key: Key, VersionId: VersionId}, DeleteMarkers[].{Key: Key, VersionId: VersionId}][], Quiet: `true`}')
    count=$(node -e 'console.log(JSON.parse(process.argv[1]).Objects.length)' "$batch")
    [ "$count" = 0 ] && break
    echo "  deleting $count objects and versions from $1"
    aws s3api delete-objects --bucket "$1" --delete "$batch" >/dev/null
  done
}
remove() { # type id
  case "$1" in
    AWS::S3::Bucket)
      empty_bucket "$2"
      aws s3api delete-bucket --bucket "$2" && echo "  deleted bucket $2" ;;
    AWS::DynamoDB::Table)
      local backup
      printf '  Keep an on-demand backup of %s? It stays after the table is gone and costs about 0.10 USD per GB and month. [y/N] ' "$2"
      read -r backup </dev/tty
      if [ "$backup" = y ]; then
        aws dynamodb create-backup --table-name "$2" --backup-name "$2-teardown-$(date +%Y%m%d)" \
          --query 'BackupDetails.BackupArn' --output text
      fi
      aws dynamodb update-table --table-name "$2" --no-deletion-protection-enabled >/dev/null
      aws dynamodb delete-table --table-name "$2" >/dev/null
      aws dynamodb wait table-not-exists --table-name "$2" && echo "  deleted table $2" ;;
    AWS::ECR::Repository)
      aws ecr delete-repository --repository-name "$2" --force >/dev/null && echo "  deleted repository $2" ;;
    AWS::Logs::LogGroup)
      aws logs delete-log-group --log-group-name "$2" && echo "  deleted log group $2" ;;
    *) echo "  $1 $2: not handled here, remove it in the console" ;;
  esac
}
remove_retained() { # stack name
  local type id found=0
  while IFS=$'\t' read -r type id; do
    [ -n "$type" ] || continue
    exists "$type" "$id" || continue
    found=1
    remove "$type" "$id"
  done < <(retained "$1")
  [ "$found" = 1 ] || echo "  nothing left from $1"
}
delete_stack() { # name
  aws cloudformation delete-stack --stack-name "$1"
  echo "  waiting for $1 to be deleted (CloudFront and IAM take a few minutes)"
  aws cloudformation wait stack-delete-complete --stack-name "$1"
  echo "  $1 deleted"
}
app_stacks() {
  aws cloudformation list-stacks \
    --query "StackSummaries[?starts_with(StackName, 'App-') && StackStatus!='DELETE_COMPLETE'].[StackName,StackStatus]" --output text
}

case "$PART" in
  inventory)
    say "Stacks in $REGION"
    for s in BaaEnvelope BaaToolkit; do printf '%-12s %s\n' "$s" "$(stack_status "$s")"; done
    app_stacks | sed 's/^/  /'
    say "Left behind by deleted stacks (still exist)"
    for s in App-prod App-dev BaaToolkit; do
      retained "$s" | while IFS=$'\t' read -r type id; do
        if [ -n "$type" ] && exists "$type" "$id"; then printf '%-10s %-22s %s\n' "$s" "$type" "$id"; fi
      done
    done
    echo "(empty above means nothing is left)"
    ;;

  prod-data)
    require_admin
    [ "$(stack_status App-prod)" = NONE ] || { echo "App-prod still exists. Run the teardown workflow with stage prod first."; exit 1; }
    say "Data that App-prod kept: table, buckets and log groups. Deleting them cannot be undone."
    retained App-prod | sed 's/^/  /'
    confirm App-prod-data
    remove_retained App-prod
    ;;

  toolkit)
    require_admin
    left=$(app_stacks)
    [ -z "$left" ] || { echo "These stacks still use BaaToolkit and must go first:"; echo "$left"; exit 1; }
    say "BaaToolkit: the CDK bootstrap roles and the staging bucket with deploy assets"
    confirm BaaToolkit
    aws cloudformation update-termination-protection --stack-name BaaToolkit --no-enable-termination-protection >/dev/null
    delete_stack BaaToolkit
    remove_retained BaaToolkit
    ;;

  envelope)
    require_admin
    [ "$(stack_status BaaToolkit)" = NONE ] || { echo "BaaToolkit still exists. Run the toolkit part first."; exit 1; }
    # The OIDC provider is one per account. Roles from other projects may trust it too.
    others=$(aws iam list-roles --output text \
      --query "Roles[?contains(to_string(AssumeRolePolicyDocument), 'token.actions.githubusercontent.com') && !starts_with(RoleName, 'baa-gha-')].RoleName")
    [ -z "$others" ] || { echo "Other roles trust the GitHub OIDC provider this envelope created: $others"; echo "Deleting it would break them. Stopped."; exit 1; }
    account=$(aws sts get-caller-identity --query Account --output text)
    users=$(aws iam list-entities-for-policy --policy-arn "arn:aws:iam::$account:policy/baa-boundary" --policy-usage-filter PermissionsBoundary \
      --query "PolicyRoles[?!starts_with(RoleName, 'baa-')].RoleName" --output text 2>/dev/null || true)
    [ -z "$users" ] || { echo "Roles outside the envelope still use baa-boundary: $users"; exit 1; }
    say "BaaEnvelope: boundary, execution policy, GitHub roles, agent role, OIDC provider, budget, trail"
    echo "The trail's log bucket stays (audit records); this part prints its name."
    confirm BaaEnvelope
    delete_stack BaaEnvelope
    retained BaaEnvelope | while IFS=$'\t' read -r type id; do
      if [ -n "$type" ] && exists "$type" "$id"; then
        echo "  kept: $type $id. When the audit records are no longer needed: aws s3 rb s3://$id --force"
      fi
    done
    say "Left outside AWS: the repository variables (gh variable list) and [profile baa-agent] in ~/.aws/config"
    ;;

  *)
    sed -n '2,9p' "$0"
    exit 2
    ;;
esac
