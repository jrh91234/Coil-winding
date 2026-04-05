#!/bin/bash
# Auto-update CLAUDE.md section map after charts.js changes
# Runs as PostToolUse hook — zero token cost

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -c "js/charts.js")
if [ "$CHANGED" -eq 0 ]; then
    exit 0
fi

FILE="js/charts.js"
MD="CLAUDE.md"

if [ ! -f "$FILE" ] || [ ! -f "$MD" ]; then
    exit 0
fi

# Extract line numbers for key sections
L_PARSE=$(grep -n "parseSetupType\|separateSetupData" "$FILE" | head -1 | cut -d: -f1)
L_PARETO=$(grep -n "Pareto View Selector\|Pareto Machine Selector\|paretoViewSelector" "$FILE" | head -1 | cut -d: -f1)
L_PARETO_END=$(grep -n "ngByMachineChart\|ctxNgMac" "$FILE" | head -1 | cut -d: -f1)
L_WPP=$(grep -n "getWppStrict" "$FILE" | head -1 | cut -d: -f1)
L_TREND=$(grep -n "displayTrendData = trendData.map\|displayTrendData=trendData.map" "$FILE" | head -1 | cut -d: -f1)
L_QCTREND=$(grep -n "charts.qcTrend = new Chart\|charts\.qcTrend=new Chart" "$FILE" | head -1 | cut -d: -f1)
L_NGBREAK=$(grep -n "showDailyNgBreakdown" "$FILE" | head -1 | cut -d: -f1)
L_TRENDBREAK=$(grep -n "showTrendDayBreakdown" "$FILE" | head -1 | cut -d: -f1)
L_AUDIT=$(grep -n "exportNgRateAudit" "$FILE" | head -1 | cut -d: -f1)
TOTAL=$(wc -l < "$FILE")

# Build new section map
NEW_MAP="## Charts.js Section Map (use offset/limit, never read whole file)
- Lines 1-${L_PARSE:-50}: parseSetupType(), separateSetupData()
- Lines ${L_PARETO:-805}-${L_PARETO_END:-950}: Pareto chart (view selector + machine filter)
- Lines ${L_WPP:-1200}-$((${L_WPP:-1200}+20)): getWppStrict(), getKgFromPcs()
- Lines ${L_TREND:-1300}-$((${L_TREND:-1300}+100)): displayTrendData computation
- Lines ${L_QCTREND:-1400}-$((${L_QCTREND:-1400}+120)): qcTrend chart instance
- Lines ${L_NGBREAK:-2100}-${L_TRENDBREAK:-2260}: showDailyNgBreakdown, showTrendDayBreakdown
- Lines ${L_AUDIT:-2270}+: exportNgRateAudit
- Total: ${TOTAL} lines"

# Replace section map in CLAUDE.md using sed
sed -i "/^## Charts.js Section Map/,/^- Total:/c\\${NEW_MAP}" "$MD" 2>/dev/null

echo '{"suppressOutput": true}'
