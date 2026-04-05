Edit js/charts.js for chart feature changes.

IMPORTANT: This file is ~2500 lines. NEVER read the whole file.

Section map (use offset/limit):
- Lines 1-50: Helper functions (parseSetupType, separateSetupData)
- Lines 450-570: NG Symptom Trend chart
- Lines 780-800: commonOpts, dataLabelsPlugin
- Lines 805-950: Pareto chart (paretoViewSelector, paretoMachineSelector, separated data)
- Lines 950-1050: NG by Machine chart
- Lines 1050-1200: Machine detail modal charts
- Lines 1200-1220: getWppStrict, getKgFromPcs (strict, no fallback)
- Lines 1300-1400: displayTrendData computation (per-day loop, pendingByMachine, ngByMachine)
- Lines 1400-1520: qcTrend Chart.js instance (datasets, tooltip, onClick)
- Lines 1520-1600: renderTable
- Lines 2100-2160: showDailyNgBreakdown
- Lines 2170-2260: showTrendDayBreakdown (NG + pending popup)
- Lines 2270-2500: exportNgRateAudit (audit export)

Always:
1. Use Grep to find exact line first
2. Read only 30-50 lines around the target
3. Use Edit (not Write) for changes
