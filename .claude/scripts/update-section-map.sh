#!/bin/bash
# ตรวจว่า commit ล่าสุดมีการแก้ charts.js หรือไม่
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -c "js/charts.js")

if [ "$CHANGED" -gt 0 ]; then
    echo "SECTION_MAP_OUTDATED: js/charts.js was modified in the last commit. Please run /update-claude-md to refresh CLAUDE.md line numbers."
fi
