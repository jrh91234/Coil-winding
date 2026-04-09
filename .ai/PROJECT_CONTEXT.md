# Coil-winding QC Dashboard — AI Development Guide

## Project Structure
- `js/charts/` — Chart rendering (split into modules):
  - `helpers.js` (64 lines) — parseSetupType(), separateSetupData(), **getWppStrict()**, **getKgFromPcs()** (shared, strict no-fallback)
  - `models.js` (399 lines) — FG by model, simulator, model chart, daily output
  - `ng-trend.js` (329 lines) — NG symptom trend chart
  - `main.js` (835 lines) — renderCharts: Pareto (with paretoViewSelector + paretoMachineSelector + coil change tooltip), NG by Machine, qcTrend (Daily NG Rate Trend + coil change data), doughnut
  - `table-machine.js` (533 lines) — renderTable, machine detail/switch
  - `popups.js` (196 lines) — showDailyNgBreakdown, showTrendDayBreakdown (NG+pending sort+coil changes per machine), image viewer
  - `audit.js` (393 lines) — exportNgRateAudit, downloadAuditCSV, printAuditReport
- `js/report/` — Report & dashboard (split into modules):
  - `widgets.js` (57 lines) — Widget manager (open/save/apply visibility)
  - `auto-report.js` (1158 lines) — renderAutoReportContent (full report generation)
  - `export.js` (131 lines) — printAutoReport, exportCSV
  - `dashboard.js` (171 lines) — loadDashboard
- `js/form.js` (907 lines) — NG input form, Setup sub-symptom selection
- `js/globals.js` (426 lines) — Global variables (ngSymptoms, machineMapping, getShiftDateStr with 08:00 cutoff)
- `js/auth.js` (262 lines) — Authentication
- `js/packing.js` (366 lines) — Packing module
- `js/parts.js` (299 lines) — **Parts tracking**: Parts Master CRUD, Installation tracking, Shot Counter, Machine parts tab
- `scr/backend.gs` (2296 lines) — Google Apps Script backend
- `index.html` (2018 lines) — Main HTML layout + modals (Parts Manager modal, Daily NG breakdown modal widened to max-w-lg)

## Key Technical Rules (MUST follow)
1. WPP (Weight Per Piece): 10A=0.00228, 16A=0.00279, 20A=0.00357, 25/32A=0.005335
2. NG Rate = NG Kg / (FG Kg + NG Kg) x 100 — weight-based, NOT piece-based
3. NO fallback WPP — getWppStrict() returns null for unknown products, skip that machine
4. NO global sort ratio fallback — skip symptoms without sort data, re-normalize
5. Setup format: "Setup - {symptom}" stored in NG_Details_JSON
6. **Day cutoff 08:00-07:59** — before 08:00 counts as previous day (Production form, Sorting form, backend read, RawMaterial)
7. **getWppStrict/getKgFromPcs** — defined ONLY in helpers.js, all other files use shared version (no local duplicates)

## Data Flow
- Backend `sortResultByMachine[mac|date]` = { fgPcs, ngPcs, pendingPcs, pendingBySymptom }
- Frontend `data.machineData[mac].sortData[date]` = above object
- Frontend `data.machineData[mac].daily[date]` = { fg, ngPcs, ngBreakdown: {symptom: count} }
- `data.dynamicSymptomWeights` = { symptom: fgRate } from sort history
- **Coil changes**: `data.dailyTrend[].coilChanges` (total), `data.dailyTrend[].coilChangesByMachine` (per machine) — from RawMaterial sheet

## Spare Parts Tracking System
- **Parts_Master sheet**: Part_ID, Part_Name, Category, Life_Shots (adjustable), Unit_Cost, Supplier, Remark
- **Parts_Installation sheet**: Install_ID, Machine, Part_ID, Part_Name, Install_Date, Install_Shot, Life_Shots, Status (Active/Replaced), Maint_Job_ID, Recorder, Replaced_Date
- **Shot Counter**: cumulative FG+NG per machine since install date → % life used → color status (green/yellow/red)
- Backend actions: GET_PARTS_MASTER, SAVE_PARTS_MASTER, DELETE_PARTS_MASTER, GET_PARTS_INSTALLATION, SAVE_PARTS_INSTALLATION, UPDATE_PARTS_LIFE, GET_MACHINE_SHOTS
- Frontend: `js/parts.js`, menu "⚙️ จัดการอะไหล่", Machine Detail tab "⚙️ อะไหล่"

## Architecture Notes
- All chart functions use `window.functionName` — no ES modules, no imports
- Shared state: `currentDashboardData`, `charts` object, `machineMapping`
- Script load order matters: helpers → models → ng-trend → main → table-machine → popups → audit → parts
- Google Apps Script backend deploys separately from frontend
- Menu visibility controlled by role in `js/globals.js` (allMenus array includes tab-parts)

## Common Tasks
- **Add new chart**: Create new file in `js/charts/`, add script tag in `index.html`
- **Modify Pareto**: Edit `js/charts/main.js` (search `paretoViewSelector`)
- **Modify NG Rate Trend**: Edit `js/charts/main.js` (search `qcTrend`)
- **Modify NG Symptom Trend**: Edit `js/charts/ng-trend.js`
- **Modify audit export**: Edit `js/charts/audit.js`
- **Modify popup/breakdown**: Edit `js/charts/popups.js`
- **Modify data collection**: Edit `scr/backend.gs`
- **Modify NG form**: Edit `js/form.js`
- **Modify parts tracking**: Edit `js/parts.js`
- **Modify menu/role access**: Edit `js/globals.js` (search `allMenus` / `allowedMenus`)
