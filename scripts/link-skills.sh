#!/usr/bin/env bash
# Manual install: link every skill into the skill folders of local agents.
# Prefer the plugin marketplace for Claude Code; use this for other agents or development.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
for target in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  mkdir -p "$target"
  for skill in "$here"/skills/*/*/; do
    name=$(basename "$skill")
    ln -sfn "$skill" "$target/$name"
    echo "linked $name -> $target"
  done
done
