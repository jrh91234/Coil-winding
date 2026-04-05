# Coil-winding QC Dashboard — AI Development Guide

## Project Structure
- `js/charts/` — Chart rendering (split into modules):
  - `helpers.js` (46 lines) — parseSetupType(), separateSetupData()
  - `models.js` (399 lines) — FG by model, simulator, model chart, daily output
  - `ng-trend.js` (329 lines) — NG symptom trend chart
  - `main.js` (817 lines) — renderCharts: Pareto, NG by Machine, qcTrend, doughnut
  - `table-machine.js` (533 lines) — renderTable, machine detail/switch
  - `popups.js` (184 lines) — showDailyNgBreakdown, showTrendDayBreakdown, image viewer
  - `audit.js` (393 lines) — exportNgRateAudit, downloadAuditCSV, printAuditReport
- `js/form.js` (907 lines) — NG input form, Setup sub-symptom selection
- `js/report.js` (1517 lines) — Auto report generation
- `js/globals.js` (426 lines) — Global variables (ngSymptoms, machineMapping)
- `js/auth.js` (262 lines) — Authentication
- `js/packing.js` (366 lines) — Packing module
- `scr/backend.gs` (2047 lines) — Google Apps Script backend
- `index.html` (1925 lines) — Main HTML layout + modals

## Key Technical Rules (MUST follow)
1. WPP (Weight Per Piece): 10A=0.00228, 16A=0.00279, 20A=0.00357, 25/32A=0.005335
2. NG Rate = NG Kg / (FG Kg + NG Kg) x 100 — weight-based, NOT piece-based
3. NO fallback WPP — getWppStrict() returns null for unknown products, skip that machine
4. NO global sort ratio fallback — skip symptoms without sort data, re-normalize
5. Setup format: "Setup - {symptom}" stored in NG_Details_JSON

## Data Flow
- Backend `sortResultByMachine[mac|date]` = { fgPcs, ngPcs, pendingPcs, pendingBySymptom }
- Frontend `data.machineData[mac].sortData[date]` = above object
- Frontend `data.machineData[mac].daily[date]` = { fg, ngPcs, ngBreakdown: {symptom: count} }
- `data.dynamicSymptomWeights` = { symptom: fgRate } from sort history

## Architecture Notes
- All chart functions use `window.functionName` — no ES modules, no imports
- Shared state: `currentDashboardData`, `charts` object, `machineMapping`
- Script load order matters: helpers → models → ng-trend → main → table-machine → popups → audit
- Google Apps Script backend deploys separately from frontend

## Common Tasks
- **Add new chart**: Create new file in `js/charts/`, add script tag in `index.html`
- **Modify Pareto**: Edit `js/charts/main.js` (search `paretoViewSelector`)
- **Modify NG Trend**: Edit `js/charts/ng-trend.js`
- **Modify audit export**: Edit `js/charts/audit.js`
- **Modify popup/breakdown**: Edit `js/charts/popups.js`
- **Modify data collection**: Edit `scr/backend.gs`
- **Modify NG form**: Edit `js/form.js`
