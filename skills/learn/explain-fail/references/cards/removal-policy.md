# Card: removal-policy

Rule: throwaway stacks delete their data; prod keeps it.
Why: CDK L2 constructs keep buckets and tables after `cdk destroy` by default. In a learning account that silently piles up orphans that cost money. In prod, deleting data by deleting a stack is the opposite disaster.
Gate: guard stage-removal.
Fix: `removalPolicy: removalFor(settings)` from lib/settings.ts; `autoDeleteObjects` for buckets outside prod; `deletionProtection` on prod tables.
WA: REL09, COST.
Check yourself: what happens to the table when PR 12 closes? And to the prod table if someone runs `cdk destroy App-prod`?
