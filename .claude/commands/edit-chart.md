Edit chart files in js/charts/ directory.

Charts are split into modules — edit the correct file directly:

| File | Content |
|------|---------|
| `js/charts/helpers.js` | parseSetupType(), separateSetupData() |
| `js/charts/models.js` | FG by model, simulator, model chart, daily output |
| `js/charts/ng-trend.js` | NG symptom trend chart, toggleNgTrendLabels |
| `js/charts/main.js` | renderCharts: Pareto, NG by Machine, qcTrend, doughnut |
| `js/charts/table-machine.js` | renderTable, switchMachineChart, showMachineDetail |
| `js/charts/popups.js` | showDailyNgBreakdown, showTrendDayBreakdown, viewMaintImage |
| `js/charts/audit.js` | exportNgRateAudit, downloadAuditCSV, printAuditReport |

All files use `window.functionName` — no imports needed.
Shared data: `currentDashboardData`, `charts` object, `machineMapping`.
