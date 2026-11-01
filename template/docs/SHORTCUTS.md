# Shortcuts

Collected from `// shortcut:` comments at each debrief. A shortcut is a known limit with an
upgrade condition, not a forgotten problem.

| Where | Limit | Upgrade when | Condition true now? |
|---|---|---|---|
| lib/frontend.ts | default *.cloudfront.net certificate, TLS policy fixed | the brief needs a custom domain (M2, profiles B and C) | no |
| lib/api.ts | CORS allows any origin | routes need sign-in (M2) | no |
