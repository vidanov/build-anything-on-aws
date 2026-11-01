---
name: scaffold
description: Creates the learner's CDK TypeScript project from the Build Anything on AWS template for the chosen blueprint, with safe defaults, gates, drills and docs, and proves the gates are green before the first commit.
---

# Scaffold

Copy the template, set three values, prove it works. The template is tested: its gates are green and its drills prove each gate can fail. Keep it that way.

## 1. Show before writing

List the files that will be created (the `template/` tree of this plugin). If the target folder is not empty, list what would be overwritten and stop for a yes. Never overwrite `docs/` files that already exist; merge them.

## 2. Copy and set

1. Copy `template/` (from this plugin: `${CLAUDE_PLUGIN_ROOT}/template`, or the repo checkout) into the project root, without `node_modules` and `cdk.out`.
2. In `cdk.json` set `baa:project` (lowercase, hyphens), `baa:region` (from `.baa/preflight.json`) and `baa:alertEmail`.
3. In `.github/CODEOWNERS` replace `@owner` with the reviewer's GitHub handle.
4. `npm ci`

## 3. Prove it

1. `npm run gates` must end with `gates: GREEN`.
2. `npm run drills` must end with every gate going red on its planted violation.

If either fails on the untouched template, it is a bug in the template or the toolchain, not in the learner's work. Report the exact output and stop; do not patch gates to make them pass.

## 4. First commit

`git init` if needed, commit everything on `main` with the message `scaffold blueprint <spec>`. The learner pushes (the agent does not push to a remote for the first time).

## Done when

The project is committed, `npm run gates` is green, `npm run drills` proves every gate can fail, and the learner knows the next step is `pipeline`.
