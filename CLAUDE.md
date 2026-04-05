# AI Development Guide

Read `.ai/PROJECT_CONTEXT.md` for full project structure, rules, and data flow.

## Claude-specific
- Always push to branch starting with `claude/` and matching session ID
- Retry push on network error up to 4 times with exponential backoff
- Use `/edit-chart` command for chart file reference
- Use `/merge-main` command for merging main branch
