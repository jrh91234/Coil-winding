# Coil-winding QC Dashboard

## Project Structure
- `js/charts.js` (~2500 lines) — All chart rendering (Pareto, NG Trend, Machine charts, Audit export)
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

## Charts.js Section Map (use offset/limit, never read whole file)
- Lines 1-50: parseSetupType(), separateSetupData()
- Lines 805-950: Pareto chart (view selector + machine filter)
- Lines 1200-1220: getWppStrict(), getKgFromPcs()
- Lines 1300-1400: displayTrendData computation
- Lines 1400-1520: qcTrend chart instance
- Lines 2100-2260: showDailyNgBreakdown, showTrendDayBreakdown
- Lines 2270+: exportNgRateAudit

## Git
- Always push to branch starting with `claude/` and matching session ID
- Retry push on network error up to 4 times with exponential backoff
