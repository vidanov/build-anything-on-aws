# Card: log-retention

Rule: every log group has a retention period.
Why: logs without retention are kept forever and billed forever; nobody reads logs from two years ago.
Gate: guard secure-defaults `log_retention`.
Fix: create the log group explicitly with `retention: logs.RetentionDays.ONE_MONTH` and pass it to the function (`logGroup:`).
WA: COST, OPS.
