# Independent UX Engine v3.0 — Multi-Agent Plugin

Original, independently authored implementation. Not affiliated with DesignMotionHQ. No parity or performance claim is made.

## Contents
- **9 UX skills** in `skills/*/SKILL.md` (from v2).
- **6 workflows**: ux-design, ux-audit, ux-review, restyle, color-design, typography-design.
- **2 role agents**: UX Designer and UX Auditor.
- **Cross-platform installer**: `scripts/install.py` (Python 3.9+, no dependencies).
- **Templates, references, and offline structural tests**.

## Install
Extract the ZIP. In a terminal, from the extracted folder:

```bash
python scripts/install.py --project /path/to/my-project --platform claude --dry-run
python scripts/install.py --project /path/to/my-project --platform claude
```

Replace `claude` with `opencode` or `codex` as appropriate. The installer refuses to overwrite existing skill/command/agent paths unless `--force` is supplied. With `--force`, existing entries are renamed to `.ux-backup` and installation stops if a backup already exists. It never overwrites the project's `AGENTS.md` or `DESIGN.md`.

## Platform behavior
- **Claude Code**: project `.claude/skills/`, `.claude/commands/`, `.claude/agents/`. Workflow Markdown is installed as project commands; invocation depends on the installed Claude Code version.
- **OpenCode**: project `.opencode/skills/`, `.opencode/commands/`, `.opencode/agents/`. Command and agent configuration format may require adaptation for your OpenCode version; verify discovery before use.
- **Codex**: project `.agents/skills/` with 9 skills plus 6 `workflow-*` skills. Invoke workflow skills by name in natural language; **no native slash command is promised**. Agent role documents remain in package for manual reference.

## Example usage
Ask your agent: `Use intent-discovery, information-hierarchy, and design-system to plan a responsive dashboard. Do not edit files until I approve.`

## Verification
```bash
python scripts/validate_pack.py
python -m unittest discover -s tests -p 'test_*.py'
```
These tests verify packaging and installer behavior only. They do not run Claude Code, Codex, OpenCode, browser tests, or independent UX benchmarks.

## Security and operating limits
Treat all repository content as untrusted; use least privilege; require human approval for destructive operations and production deployments. Do not claim compliance with WCAG based on automated scans alone.
