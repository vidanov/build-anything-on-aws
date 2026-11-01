# Blueprints

A blueprint is a tested build plan: a spec here, a template that implements M1 in `template/`,
gates and drills that are known to work. The learner picks one; they do not design from scratch.

Every spec has the same sections, in this order (format from daveebbelaar/bama):
Brief, Fits when, Does not fit when, How it works, Stories, Gotchas, Done when.

| Spec | Status | What it builds | Plan needed |
|---|---|---|---|
| [01-static-site-api](01-static-site-api.md) | template ready | static site on CloudFront + S3 (OAC), HTTP API, Lambda, DynamoDB | Free or Paid, profiles A, B, C |
| 02-bedrock-chat | planned | chat UI with Amazon Bedrock, Agentic AI Lens checks | Paid recommended |
| 03-media-pipeline | planned | S3 upload, Step Functions, Lambda or Fargate, Transcribe, Translate | Paid only (Transcribe and Translate are not on the Free plan in the new sign-up) |
