---
name: ephemeral
description: Explains and debugs the throwaway App-pr-<n> stacks of a Build Anything on AWS project, why they exist, what they cost, how cleanup and the sweeper work, and how to read a failed CloudFormation deploy without write access.
---

# Ephemeral stacks

Every PR gets its own stack, `App-pr-<n>`, in the sandbox account. It exists so the learner sees real AWS behavior before merging, and it disappears when the PR closes.

## Lifecycle

1. `pr.yml` deploys `App-pr-<n>` after the gates pass.
2. The smoke test calls the real URLs.
3. `cleanup.yml` runs `cdk destroy` when the PR closes.
4. `sweeper.yml` deletes any PR stack older than its `ttlHours` tag (default 48 h), for PRs left open or cleanups that failed.

PR stacks delete their data on purpose: `stage-removal.guard` requires `DeletionPolicy: Delete` for stateful resources outside prod, because L2 constructs keep buckets and tables by default and a learner's account would fill with orphans.

## When a deploy fails

You have read-only access. Read, do not change:

1. `aws cloudformation describe-stack-events --stack-name App-pr-<n> --max-items 30` and find the first `*_FAILED` event; that is the cause, later failures are consequences.
2. For a runtime error in Lambda, use the AWS MCP Server's serverless diagnostics (read-only) after the learner has stated a hypothesis (level 1 and 2).
3. Name the cause as confirmed only if an event or log line shows it. Otherwise say unverified and what you would check next.

Then call the Skill tool with `explain-fail` and fix in code, not in the console.

## Cost

An idle PR stack of blueprint 01 costs close to nothing: no NAT, no provisioned capacity, on-demand everything. CloudFront distributions take minutes to create and delete; that is normal.

## Done when

The learner can say what `App-pr-<n>` is for, when it disappears, and why its data is deleted.
