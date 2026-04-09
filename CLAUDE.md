# AI Development Guide

Read `.ai/PROJECT_CONTEXT.md` for full project structure, rules, and data flow.

## Claude-specific
- Always push to branch starting with `claude/` and matching session ID
- Retry push on network error up to 4 times with exponential backoff

## Workflow Rules (ALWAYS follow)
- Before editing chart files: check `.ai/PROJECT_CONTEXT.md` for which file to edit
- Before merging main: run `git fetch origin main && git merge origin/main`, resolve conflicts keeping BOTH sides
- After commit that changes js/charts/: hook auto-updates section map
- NEVER read entire large files — use Grep to find line, then Read with offset/limit
- NEVER use Explore Agent if PROJECT_CONTEXT.md already has the answer
- getWppStrict/getKgFromPcs defined ONLY in helpers.js — never duplicate locally

## Quick File Reference
| Task | File |
|------|------|
| Pareto chart | `js/charts/main.js` |
| NG Rate Trend | `js/charts/main.js` |
| NG Symptom Trend | `js/charts/ng-trend.js` |
| Audit export | `js/charts/audit.js` |
| Popup/breakdown | `js/charts/popups.js` |
| Table + machine detail | `js/charts/table-machine.js` |
| Model charts, simulator | `js/charts/models.js` |
| Shared helpers (WPP) | `js/charts/helpers.js` |
| NG input form | `js/form.js` |
| Auto report content | `js/report/auto-report.js` |
| Print/CSV export | `js/report/export.js` |
| Widget manager | `js/report/widgets.js` |
| Dashboard loader | `js/report/dashboard.js` |
| Parts tracking | `js/parts.js` |
| Menu/role access | `js/globals.js` |
| Backend data | `scr/backend.gs` |
