# AWS MCP Server configs

All configs use the managed AWS MCP Server through `mcp-proxy-for-aws-cli` pinned to 1.7.0,
the Frankfurt endpoint, the read-only `baa-agent` profile from the envelope, and `--read-only`
(write tools hidden). The official Agent Toolkit configs point at us-east-1 and use `@latest`;
these override that.

| Agent | File | Put it at |
|---|---|---|
| Claude Code | `../.mcp.json` | loaded by the plugin |
| Kiro | `kiro.mcp.json` | `.kiro/settings/mcp.json` |
| Cursor | `cursor.mcp.json` | `.cursor/mcp.json` |
| Codex | `codex.config.toml` | merge into `~/.codex/config.toml` |

Profile A (project region outside the MCP endpoint list, for example eu-north-1): keep the
eu-central-1 endpoint and `--region eu-central-1`, and add `--metadata AWS_REGION=eu-north-1`
so operations run in the project region. Not yet verified, see docs/FACT-CHECKS.md.

The read-only flag and the agent role are two separate locks. The role is the one that holds:
the agent's own shell `aws` calls bypass MCP, so their limits come from IAM, not from the proxy.
