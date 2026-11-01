# Card: cost-allowlist

Rule: only resource types on the blueprint's list may be created. A new type is a reviewed change.
Why: the surprise bill comes from a resource nobody priced: a NAT gateway (about 35 USD a month idle), a provisioned table, a large instance. Dollar estimates from code are unreliable; a list of allowed types is not.
Gate: guard cost-allowlist; the permissions boundary also denies NAT gateways and large instances.
Fix: remove the resource, or open a PR that adds its type to gates/guard/cost-allowlist.guard with a cost note, reviewed by CODEOWNERS.
WA: COST02 governance.
Check yourself: which resource in this blueprint would cost money even with zero visitors?
