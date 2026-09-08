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
- `js/planning.js` — **แผนการผลิต / Job Order**: ฟอร์มสร้าง Job Order, ตารางติดตามความคืบหน้า, ตัวเลือก Job Order ในฟอร์มบันทึกผลิต, การ์ด Job Order บน Dashboard
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
- **งานรอ Sort ในกราฟ Daily Output**: `dailyTrend[].pendingSortFromFg` / `pendingSortFromNg` / `pendingSortByModel[model] = {qty, fromFg, fromNg}`
  - แยกที่มาด้วย remark `พบที่: FG|RTV` (กติกาเดียวกับตอน QC อนุมัติที่หัก FG) → `fromFg`, ที่เหลือ = `fromNg`
  - กราฟ Daily Output (`js/charts/models.js`) หักเฉพาะ `fromFg` ออกจากแท่ง FG (งานผลิต) ส่วน `fromNg` (= พบระหว่างผลิต) เป็นยอดใหม่ ไม่หักจากที่ไหน แล้วแสดงรวมเป็นก้อน **"รอ Sort (ยังไม่รู้ผล)"** สีม่วง
  - หัก FG ได้ไม่เกินยอด FG ของช่วงนั้น (ใบงานอาจลงคนละวันกับวันผลิต) ส่วนที่หักไม่ได้ = `pendExtra` แจ้งใน tooltip
  - สลับโหมดได้ที่ `dailyOutputPendingSelector` (`split` = ค่าเริ่มต้น / `merge` = แบบเดิม)
- **Coil changes**: `data.dailyTrend[].coilChanges` (total), `data.dailyTrend[].coilChangesByMachine` (per machine) — from RawMaterial sheet

## Spare Parts Tracking System
- **Parts_Master sheet**: Part_ID, Part_Name, Category, Life_Shots (adjustable), Unit_Cost, Supplier, Remark
- **Parts_Installation sheet**: Install_ID, Machine, Part_ID, Part_Name, Install_Date, Install_Shot, Life_Shots, Status (Active/Replaced), Maint_Job_ID, Recorder, Replaced_Date
- **Shot Counter**: cumulative FG+NG per machine since install date → % life used → color status (green/yellow/red)
- Backend actions: GET_PARTS_MASTER, SAVE_PARTS_MASTER, DELETE_PARTS_MASTER, GET_PARTS_INSTALLATION, SAVE_PARTS_INSTALLATION, UPDATE_PARTS_LIFE, GET_MACHINE_SHOTS
- Frontend: `js/parts.js`, menu "⚙️ จัดการอะไหล่", Machine Detail tab "⚙️ อะไหล่"

## Production Plan / Job Order System
- **Plan_Data sheet**: Date, Product, Target_Qty, Shift, Timestamp (5 คอลัมน์แรก = รูปแบบเดิม ห้ามสลับลำดับ) + Job_Order, Status, Recorder, Updated_At
- ฟิลด์ที่ผู้ใช้กรอกมีแค่: Job Order (เว้นว่างได้), วันที่แผน, รุ่น, จำนวน, กะ
- **Production_Data** เพิ่มคอลัมน์ `Job_Order` (syncHeaders เติมให้อัตโนมัติ)
- เลข Job Order สร้างอัตโนมัติรูปแบบ `JO-YYMM-001` (running ต่อเดือน) หรือกรอกเองก็ได้ (ห้ามซ้ำ)
- สถานะ: Open → In Progress → Completed (คำนวณจากยอดผลิตจริง) / Closed, Cancelled (ตั้งค่าเอง) — แผนที่ Cancelled ไม่ถูกนับเป็น Target
- Backend actions: `GET_JOB_ORDERS` (GET), `SAVE_PLAN`, `UPDATE_PLAN`, `DELETE_PLAN` (POST)
- Dashboard payload เพิ่ม `jobOrders` (แผน + ยอดสะสม) และ `jobOrderData` (ยอดผลิตเฉพาะช่วงที่เลือก แยกตามเลข Job Order)
- แสดงผลใน: หน้า Plan (ตาราง + progress bar), การ์ด `card-job-orders` บน Dashboard, Auto Report (ตารางความคืบหน้า), Export CSV, ตาราง Production by Timestamp

### การนับยอด Job Order แบบกันซ้ำ (งานรอ Sorting + NG)
- Sorting_Data มีคอลัมน์ `Job_Order`; เมื่อ QC อนุมัติ ระบบสร้างแถวใน Production_Data `Batch_ID = "SORT-<Job_ID>"` และผูก `Job_Order` ลงไปด้วยเสมอ
  - ถ้าใบงาน Sorting ไม่ได้ระบุเลข → ย้อนหาแถวผลิตล่าสุดของ **เครื่อง + รุ่น** เดียวกัน (ไม่เกิน 60 วันก่อนวันคัด, ข้ามแถว `SORT-`) แล้วใช้เลขนั้น พร้อม backfill กลับไปที่ใบงาน Sorting
- Backend: `getProducedByJobOrder_()` แยกยอดแถวปกติ (`fgProd`, `ngPcsProd`) ออกจากแถว SORT- (`fgSort`, `ngPcsSort`)
- Backend: `getSortingByJobOrder_(opts)` รวมยอด Sorting ต่อ Job Order — **กันซ้ำด้วย `Job_ID` (1 งานนับครั้งเดียว)**
  - `Pending`/`Rejected` → `pendingPcs` (รอคัด) · `Wait QC` → `waitQcPcs` (คัดแล้วรอ QC) · `Completed` → เก็บอ้างอิงเท่านั้น (ยอดอยู่ในแถว SORT- แล้ว)
  - งานที่ยังไม่ผูกเลข Job Order รวมไว้ที่คีย์ `__NO_JO__`
- Backend: `summarizeJobOrderQty_(act, sort)` — สูตรกลาง (ห้ามคำนวณซ้ำที่อื่น) **ยึด "ขั้นตอนที่พบของเสีย"**:
  - พบ**ระหว่างผลิต** → ยังไม่เคยบันทึกเป็น FG หรือ NG → ยอดรอคัดเป็นก้อนใหม่ ไม่หักจากที่ไหน
  - พบที่ **FG/RTV** → เคยนับเป็น FG แล้ว → หักออกจาก FG ของจ๊อบนั้น
  - **คัดเสร็จ (QC อนุมัติ)** → แถว SORT- ลง FG ที่คัดได้ + NG จริง และงานออกจากก้อนรอคัดเอง
  - `producedFg = (fgProd + fgSort) − (pendingFromFg + waitQcFromFg)`
  - `ngNetPcs = ngPcsProd + ngPcsSort` (คนละก้อน ไม่ทับกัน)
  - `sortingOpenPcs = pendingPcs + waitQcPcs`
  - `accountedPcs = producedFg + ngNetPcs + sortingOpenPcs` → ใช้ตัดสิน "ยอดครบหรือไม่" เทียบกับ `targetQty`
  - ตรวจแล้วทุกสถานะ (ผลิตล้วน / รอคัด / คัดเสร็จ / พบที่ FG / รอ QC) ผลรวมคงที่เท่ายอดที่ออกจากเครื่อง
- Payload: `jobOrders[]` เพิ่ม `ngPcsFromMachine/ngPcsFromSort/pendingSortPcs/waitQcPcs/sortingOpenPcs/accountedPcs/qtyComplete`, dashboard เพิ่ม `jobOrderSortData`, GET_JOB_ORDERS เพิ่ม `unlinkedSorting`
- Frontend: `window.getJobOrderQty(j)` ใน `js/planning.js` เป็นตัวกลางอ่านค่าเหล่านี้ (มี fallback สำหรับข้อมูลเก่า) — ใช้ทั้งตาราง Plan, การ์ด Dashboard, Auto Report, CSV

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
- **Modify production plan / Job Order**: Edit `js/planning.js` (frontend) + `scr/backend.gs` (search `SAVE_PLAN` / `getJobOrders_`)
