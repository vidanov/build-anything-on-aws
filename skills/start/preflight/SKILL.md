---
name: preflight
description: Checks the learner's machine, AWS sign-in and tool versions before a Build Anything on AWS project starts, picks the account profile (A, B or C) and the starting learner level, and records both in .baa/preflight.json.
---

# Preflight

Find out what this machine and this AWS account can do before any code exists. Change nothing without showing the user what will change first.

## 1. Tools

Run each check and record the version. Missing tools are reported with one install line each; do not install them yourself without a yes.

| Tool | Check | Needed |
|---|---|---|
| Node.js | `node --version` | 22 or newer (template pins 24 in `.nvmrc`) |
| AWS CLI | `aws --version` | 2.35.0 or newer (needed by `aws agent-toolkit`) |
| GitHub CLI | `gh auth status` | signed in |
| cfn-guard | `cfn-guard --version` | 3.x |
| cfn-lint | `cfn-lint --version` | 1.x |
| uv | `uv --version` | for the AWS MCP proxy (`uvx`) |

## 2. AWS sign-in

1. `aws sts get-caller-identity`. If it fails, the human runs `aws login` (or `aws sso login`). Never ask for access keys and never put keys in this chat.
2. `aws freetier get-account-plan-state` tells Free or Paid plan. Record it.
3. Look for `aws-starter-rules.md` in the agent's rules folder. If it exists, the user signed up with the new AWS experience (a "project").

## 3. Pick the profile

| Signal | Profile | Read |
|---|---|---|
| New sign-up (starter rules present, the word "project", no root user) | A | `envelope/profiles/A-project.md` |
| Classic account, one learner | B | `envelope/profiles/B-classic.md` |
| AWS Organizations, a team or business unit | C | `envelope/profiles/C-team.md` |

Ask one question if the signals disagree. Profile A fixes the region (Germany maps to eu-north-1); record the region the account really uses, never assume eu-central-1.

## 4. Agent Toolkit for AWS

The repo depends on the `aws-core` plugin for AWS service knowledge. Check it with `aws agent-toolkit list-installed-skills` (or the plugin list in the agent). Record the output, because Toolkit skills update automatically and a lesson must be reproducible. If it is missing, show the install line from the README and wait.

The AWS MCP Server runs read-only through `mcp/` configs with `AWS_PROFILE=baa-agent`. That profile exists only after `envelope`; until then the MCP server stays off.

## 5. Starting level

If the starter rules asked `help_level`, map it: HIGH -> level 0, MEDIUM -> level 1, LOW -> level 2. Otherwise ask the learner one question with options:

- A) "I build with an agent and have not deployed to AWS myself" -> level 0 (recommended for most)
- B) "I deployed small things and want to understand them" -> level 1
- C) "I know AWS and want the agent to review, not write" -> level 2

Write `docs/LEARNER.md` from the template with `level:` and an empty topic table. Levels change per topic later (skill `level`).

## 6. Record

Write `.baa/preflight.json`:

```json
{ "profile": "B", "region": "eu-central-1", "plan": "FREE", "account": "123456789012",
  "tools": { "node": "24.x", "aws": "2.35.x", "cfn-guard": "3.2.1" },
  "toolkit": "<output of list-installed-skills>", "level": 0, "at": "<ISO date>" }
```

## Done when

Every tool is present or listed as missing with its install line, the profile and region are recorded from evidence (not assumed), `docs/LEARNER.md` has a level, and the user knows the next step is `envelope`.
