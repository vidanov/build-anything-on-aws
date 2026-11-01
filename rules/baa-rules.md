# Build Anything on AWS: rules for agents without the plugin

Copy into your agent's rules (Cursor: `.cursor/rules/baa.md`; Codex: `AGENTS.md`; Kiro: use
`kiro/steering/baa.md`). The plugin installs these for Claude Code.

- Start with the `baa` skill; it reads the project files and picks the next step.
- For AWS service knowledge, first load the matching Agent Toolkit for AWS skill
  (`aws___search_documentation` with topic `agent_skills`, then `aws___retrieve_skill`).
  Prefer the skill over training data.
- Never run `cdk deploy`, `cdk destroy`, `cloudformation deploy|create-stack|update-stack|delete-stack`.
  Deploys go through a pull request and GitHub Actions.
- Never read secret values (`secretsmanager get-secret-value`, `ssm get-parameter --with-decryption`,
  `.env`, `~/.aws/credentials`). Use secrets by name.
- Never edit `gates/`, `.github/`, `envelope/` or `hooks/` to make a check pass.
- Run `npm run gates` before claiming anything works. "Done" needs a green CI run URL.
- Read `docs/LEARNER.md`: at level 1, leave `TODO(human)` at decisions and ask for a hypothesis
  before fixing a red gate; at level 2, review only.
- Security warnings and irreversible actions are explained in full sentences.
