#!/usr/bin/env bash
# One entry point for every gate. The agent, the learner and CI all run the same thing:
#   npm run gates                 # stage pr-0, region from cdk.json
#   BAA_STAGE=prod npm run gates  # check the prod shape (Retain, deletion protection)
# Exit code is non-zero if any blocking (native) gate fails. Advisory checks never block.
# Results go to cdk.out/gates-result.json; CI turns them into docs/evidence/.
set -uo pipefail
cd "$(dirname "$0")/.."

STAGE="${BAA_STAGE:-pr-0}"
case "$STAGE" in pr-*) KIND=pr ;; dev) KIND=dev ;; prod) KIND=prod ;; *) echo "BAA_STAGE must be pr-<n>, dev or prod"; exit 2 ;; esac
REGION_ARGS=()
[ -n "${BAA_REGION:-}" ] && REGION_ARGS=(-c "baa:region=${BAA_REGION}")

RESULTS=()
FAILED=0
record() { # name oracle status(pass|fail|skip) blocking(true|false) note
  RESULTS+=("{\"gate\":\"$1\",\"oracle\":\"$2\",\"status\":\"$3\",\"blocking\":$4,\"note\":\"$5\"}")
  printf '%-18s %-6s %s\n' "$1" "$3" "$5"
  if [ "$3" = fail ] && [ "$4" = true ]; then FAILED=1; fi
}
run() { # name oracle blocking cmd...
  local name=$1 oracle=$2 blocking=$3; shift 3
  local log="cdk.out/.gate-$name.log"
  mkdir -p cdk.out
  if "$@" >"$log" 2>&1; then record "$name" "$oracle" pass "$blocking" ""
  else record "$name" "$oracle" fail "$blocking" "see $log"; sed -n '1,40p' "$log"; fi
}

echo "== gates for stage $STAGE =="
rm -rf cdk.out && mkdir -p cdk.out

run typecheck native true npx tsc --noEmit
run unit-tests native true npx jest --silent
run handler-tests native true node --test test/handler.test.mjs

# Synth. cdk-nag v3 errors make synth exit 1, but nag-report reads the report either way,
# so the gate does not depend on the exit code.
npx cdk synth --quiet -c "baa:stage=$STAGE" "${REGION_ARGS[@]}" >cdk.out/.synth.log 2>&1
SYNTH=$?
TEMPLATE=$(ls cdk.out/App-*.template.json 2>/dev/null | head -1)
if [ -z "$TEMPLATE" ]; then
  record synth native fail true "no template produced, see cdk.out/.synth.log"
  sed -n '1,60p' cdk.out/.synth.log
else
  record synth native pass true "exit $SYNTH, template $TEMPLATE"
fi

run cdk-nag native true node gates/scripts/nag-report.mjs cdk.out

if [ -n "$TEMPLATE" ]; then
  # cfn-lint: exit code is a bit mask, 2 = error. Warnings are shown but do not block.
  if command -v cfn-lint >/dev/null; then
    cfn-lint --config-file gates/cfnlintrc.yaml "$TEMPLATE" >cdk.out/.gate-cfn-lint.log 2>&1
    rc=$?
    if (( rc & 2 )); then record cfn-lint native fail true "see cdk.out/.gate-cfn-lint.log"; cat cdk.out/.gate-cfn-lint.log
    else record cfn-lint native pass true "warnings: $(grep -c '^W' cdk.out/.gate-cfn-lint.log || true)"; fi
  else record cfn-lint native skip true "cfn-lint not installed (pip install cfn-lint)"; FAILED=1; fi

  if command -v cfn-guard >/dev/null; then
    echo "{\"baa_stage\":\"$KIND\"}" > cdk.out/.guard-params.json
    for rule in gates/guard/*.guard; do
      name="guard:$(basename "$rule" .guard)"
      run "$name" native true cfn-guard validate -r "$rule" -d "$TEMPLATE" --input-params cdk.out/.guard-params.json -S fail
    done
  else record cfn-guard native skip true "cfn-guard not installed, see README"; FAILED=1; fi

  # Proxy oracle: Checkov is a second opinion and only advises.
  if command -v checkov >/dev/null; then
    checkov -f "$TEMPLATE" --framework cloudformation --quiet --compact >cdk.out/.gate-checkov.log 2>&1 \
      && record checkov proxy pass false "" || record checkov proxy fail false "advisory, see cdk.out/.gate-checkov.log"
  fi
fi

if command -v gitleaks >/dev/null; then
  run gitleaks native true gitleaks detect --no-banner --redact -s . --log-level error
fi

printf '{"stage":"%s","synthExit":%s,"results":[%s]}\n' "$STAGE" "$SYNTH" "$(IFS=,; echo "${RESULTS[*]}")" > cdk.out/gates-result.json
if [ "$FAILED" = 1 ]; then echo "== gates: RED =="; exit 1; fi
echo "== gates: GREEN =="
