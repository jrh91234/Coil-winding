# Coil-winding QC Dashboard

## Project Structure
- `js/charts/` — Chart rendering (split into modules):
  - `helpers.js` (46 lines) — parseSetupType(), separateSetupData()
  - `models.js` (399 lines) — FG by model, simulator, model chart, daily output
  - `ng-trend.js` (329 lines) — NG symptom trend chart
  - `main.js` (817 lines) — renderCharts: Pareto, NG by Machine, qcTrend, doughnut
  - `table-machine.js` (533 lines) — renderTable, machine detail/switch
  - `popups.js` (184 lines) — showDailyNgBreakdown, showTrendDayBreakdown, image viewer
  - `audit.js` (393 lines) — exportNgRateAudit, downloadAuditCSV, printAuditReport
- `js/form.js` — NG input form, Setup sub-symptom selection
- `js/report.js` — Auto report generation
- `js/globals.js` — Global variables (ngSymptoms, machineMapping)
- `js/auth.js` — Authentication
- `scr/backend.gs` — Google Apps Script backend (data fetch, sort processing)
- `index.html` — Main HTML layout + modals

## Key Technical Details
- WPP (Weight Per Piece): 10A=0.00228, 16A=0.00279, 20A=0.00357, 25/32A=0.005335
- NG Rate = NG Kg / (FG Kg + NG Kg) x 100 (weight-based)
- NO fallback WPP (getWppStrict returns null for unknown products)
- NO global sort ratio fallback (skip symptoms without sort data, re-normalize)
- Setup format in data: "Setup - {symptom}" stored in NG_Details_JSON

## Data Flow
- Backend `sortResultByMachine[mac|date]` = { fgPcs, ngPcs, pendingPcs, pendingBySymptom }
- Frontend `data.machineData[mac].sortData[date]` = above object
- `data.machineData[mac].daily[date]` = { fg, ngPcs, ngBreakdown: {symptom: count} }
- `data.dynamicSymptomWeights` = { symptom: fgRate } from sort history

## Git
- Always push to branch starting with `claude/` and matching session ID
- Retry push on network error up to 4 times with exponential backoff
