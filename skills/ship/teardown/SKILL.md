---
name: teardown
description: Removes a Build Anything on AWS project from the account when the human asks, App-dev, App-prod with its kept data, the CDK toolkit and the envelope, in the order that works, with an inventory before and after.
disable-model-invocation: true
---

# Teardown

Use this when the learner is done with the project, wants to start over, or moves to another account. Removing things is the one step where order matters: every app stack deletes through the `BaaToolkit` roles, and those roles carry the `baa-boundary` policy from `BaaEnvelope`. Delete in reverse order of creation, or the next delete fails halfway.

The agent does not delete. It runs the inventory with its read-only role, explains each step, and checks the result. The human starts the workflow and runs the script parts that need admin rights.

## 1. Inventory

Run `AWS_PROFILE=baa-agent bash envelope/teardown.sh inventory`. It lists `BaaEnvelope`, `BaaToolkit` and every `App-*` stack, and what deleted stacks left behind that still exists. Show the result and say for each item whether it holds data (the prod table, the prod site bucket) or only configuration.

Ask what the human wants removed. Three answers are common:

- **Only the app** (start a new project in the same account): steps 2 to 4. Envelope and toolkit stay.
- **Everything** (the account is done with BAA): steps 2 to 6.
- **Only prod** (keep dev for learning): steps 3 and 4.

Before anything with data goes, ask whether the learner wants a copy. The prod table can get an on-demand backup in step 4 (it stays after the table is gone and is billed per GB). Site files are in git; nothing in the logs bucket is needed later.

## 2. PR stacks

Close every open pull request. `cleanup.yml` deletes `App-pr-<n>`. A stack whose cleanup failed is deleted by `sweeper.yml` on its next run (start it by hand: Actions, sweeper, Run workflow). Check with the inventory that no `App-pr-*` stack is left.

## 3. App-dev and App-prod

Actions, teardown, Run workflow, on `main`. Pick the stage and type the stack name (`App-dev` or `App-prod`) into the confirm field; a wrong name skips the job. The workflow runs `cdk destroy` with the stage's GitHub role, the same way `cleanup.yml` does for PR stacks.

- `App-dev` deletes its table and buckets with it.
- `App-prod` deletes the stack but keeps its table (deletion protection, DeletionPolicy Retain) and both buckets. This is the prod shape `stage-removal.guard` requires: a deleted stack must not take customer data with it.

A `DELETE_FAILED` on a logs bucket with "The bucket you tried to delete is not empty" means a CloudFront log arrived after the bucket was emptied (`docs/FACT-CHECKS.md`, F25). Read the stack events as `baa-agent` to confirm it. The human empties that one bucket in the console and runs the workflow again.

## 4. Prod data

The human runs `bash envelope/teardown.sh prod-data` with their admin sign-in. It stops while `App-prod` still exists, lists what the deleted stack kept, and asks the human to type `App-prod-data`. Then it offers the backup, turns off deletion protection, deletes the table, and empties (all versions) and deletes each bucket.

Deleting a table or a versioned bucket cannot be undone. Say that before the human types the confirmation, in the learner's language.

## 5. Toolkit

The human runs `bash envelope/teardown.sh toolkit`. It stops while any `App-*` stack exists, then turns off termination protection, deletes `BaaToolkit` and the staging bucket it keeps. The default `CDKToolkit` of other projects in the account is not touched.

## 6. Envelope

The human runs `bash envelope/teardown.sh envelope`. It stops while `BaaToolkit` exists, while a role from another project trusts the GitHub OIDC provider (one provider per account, created by the envelope), or while a role outside the envelope uses `baa-boundary`. Then it deletes `BaaEnvelope`: boundary, execution policy, GitHub roles, agent role, OIDC provider, budget and trail.

The trail's log bucket stays on purpose; audit records outlive the project. The script prints its name and the command to remove it later.

What is left outside AWS: the repository variables (`gh variable list`, `gh variable list --env prod`) and `[profile baa-agent]` in `~/.aws/config`. The human removes them or archives the repository. After step 6 the agent role is gone, so the final check runs with the human's sign-in.

## 7. Check

Run the inventory again (as `baa-agent` after steps 2 to 4, as the human after step 6). Report each item from step 1 as removed, kept on purpose (with the reason) or still there. Write the result into `docs/ENVELOPE.md`: `status: removed` after step 6, or a `## Teardown` section with the date and what was removed.

A prod stack in its own account (`AWS_PROD_ACCOUNT_ID`) has its own toolkit and envelope; repeat steps 4 to 6 there with that account's admin sign-in.

## Done when

The second inventory matches what the human asked to remove, everything kept has a stated reason, and `docs/ENVELOPE.md` records it.
