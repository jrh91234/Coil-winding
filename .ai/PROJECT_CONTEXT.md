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
  - `pptx-export.js` — Executive/Customer PowerPoint generation from the latest loaded Dashboard data; includes overall and per-model production KPIs, monthly/quarterly production and Sorting trends (single total bar for Sorted FG + Sorted NG + pending, plus average actual capacity across all sorters per active sorting day), quality, machine, and Job Order slides; Customer preset omits machine and Job Order details; loads local PptxGenJS from `js/vendor/` · **เทมเพลตแบบเดียวกับระบบ H1 Lug&Screw**: slide master แถบน้ำเงิน + ท้ายหน้า/เลขหน้า, ปก/สไลด์ปิดพื้นเข้ม, การ์ด KPI, กราฟเป็นกราฟจริงของ PowerPoint (ผลิต = FG+NG ซ้อน แกนซ้าย + เส้น % NG ตามน้ำหนัก แกนขวา + ตารางใต้กราฟ), ตารางหัวเข้มแถวสลับสี
- `js/form.js` (907 lines) — NG input form, Setup sub-symptom selection
- `js/tabs.js` — **แถบแท็บแบบ browser** ใต้ Navbar: ห่อ `window.switchTab` (โหลดเป็นไฟล์สุดท้าย), จำแท็บใน localStorage `cwm_browser_tabs`, ปุ่ม + เปิด `section-newtab` (หน้าเปล่าให้เลือกเมนู สร้างด้วย JS), Ctrl/⌘+คลิก หรือคลิกกลางที่เมนู = แท็บใหม่ · CSS `.cwm-tab*` ใน `css/style.css`
- `js/globals.js` (426 lines) — Global variables (ngSymptoms, machineMapping, getShiftDateStr with 08:00 cutoff)
- `js/auth.js` (318 lines) — Authentication (+ Super App SSO auto-login via `SUPERAPP_SSO`)
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
- `data.sortingTrend[]` = daily Sorting results with total FG/NG/Pending and `byModel[model] = {fgPcs, ngPcs, pendingPcs}` for presentation exports
- `data.machineData[machine].byModel[model]` = {fg, ngPcs, ngKg} for model-specific machine NG slides
- Frontend `data.machineData[mac].sortData[date]` = above object
- Frontend `data.machineData[mac].daily[date]` = { fg, ngPcs, ngBreakdown: {symptom: count} }
- `data.dynamicSymptomWeights` = { symptom: fgRate } from sort history
- **งานรอ Sort ในกราฟ Daily Output**: `dailyTrend[].pendingSortFromFg` / `pendingSortFromNg` / `pendingSortByModel[model] = {qty, fromFg, fromNg}`
  - แยกที่มาด้วย remark `พบที่: FG|RTV` (กติกาเดียวกับตอน QC อนุมัติที่หัก FG) → `fromFg`, ที่เหลือ = `fromNg`
  - กราฟ Daily Output (`js/charts/models.js`) หักเฉพาะ `fromFg` ออกจากแท่ง FG (งานผลิต) ส่วน `fromNg` (= พบระหว่างผลิต) เป็นยอดใหม่ ไม่หักจากที่ไหน แล้วแสดงรวมเป็นก้อน **"รอ Sort (ยังไม่รู้ผล)"** สีม่วง
  - หัก FG ได้ไม่เกินยอด FG ของช่วงนั้น (ใบงานอาจลงคนละวันกับวันผลิต) ส่วนที่หักไม่ได้ = `pendExtra` แจ้งใน tooltip
  - สลับโหมดได้ที่ `dailyOutputPendingSelector` (`split` = ค่าเริ่มต้น / `merge` = แบบเดิม)
- **Coil changes**: `data.dailyTrend[].coilChanges` (total), `data.dailyTrend[].coilChangesByMachine` (per machine) — from RawMaterial sheet

## มุมมองช่วงเวลาของกราฟ (วัน / สัปดาห์ / เดือน / ไตรมาส / ปี) — แบบกราฟหุ้น
- Helper กลางใน `js/charts/helpers.js`: `getPeriodKey`, `formatPeriodLabel`, `formatPeriodTitle`, `groupRowsByPeriod`, `mergeNumberMap`, `getChartPeriod`, `setChartPeriod`, `registerChartPeriod`, `renderPeriodSwitches`
- ปุ่มสลับ = `<div class="chart-period-switch" data-period-chart="KEY" [data-periods="month,quarter,year"]>` (helper วาดปุ่มให้) · ค่าที่เลือกเก็บใน localStorage `chartPeriods`
- `KEY = '__all'` (แถบตัวกรองบน Dashboard) = เปลี่ยนทุกกราฟพร้อมกัน
- กราฟที่รองรับ: `qcTrend` (main.js), `ngTrend` (ng-trend.js), `dailyOutput` (models.js), `machineDaily` (table-machine.js), `costTrend` (cost.js — ข้อมูลรายเดือน เลือกได้ เดือน/ไตรมาส/ปี)
- กติกา: รวมยอด (Kg / ชิ้น) ของทุกวันในช่วงก่อน แล้วค่อยคำนวณ % ใหม่จากยอดรวม — **ห้ามเฉลี่ย % รายวัน**
- กราฟใหม่ที่มีแกนเวลา: ใช้ `getChartPeriod(KEY)` + `groupRowsByPeriod` แล้ว `registerChartPeriod(KEY, renderFn)` และวางปุ่มใน index.html

## Spare Parts Tracking System
- **Parts_Master sheet**: Part_ID, Part_Name, Category, Life_Shots (adjustable), Unit_Cost, Supplier, Remark
- **Parts_Installation sheet**: Install_ID, Machine, Part_ID, Part_Name, Install_Date, Install_Shot, Life_Shots, Status (Active/Replaced), Maint_Job_ID, Recorder, Replaced_Date
- **Shot Counter**: cumulative FG+NG per machine since install date → % life used → color status (green/yellow/red)
- Backend actions: GET_PARTS_MASTER, SAVE_PARTS_MASTER, DELETE_PARTS_MASTER, GET_PARTS_INSTALLATION, SAVE_PARTS_INSTALLATION, UPDATE_PARTS_LIFE, GET_MACHINE_SHOTS
- **กันติดตั้งซ้ำ** (`SAVE_PARTS_INSTALLATION`): LockService + `requestId` (CacheService 6 ชม. — ส่งซ้ำได้ผลเดิม) · โหมด replace ต้องให้รายการเดิมยัง `Active` · ห้าม Part_ID เดียวกัน Active ซ้ำบนเครื่องเดียวกัน (code: `DUPLICATE_ACTIVE` / `ALREADY_CHANGED` / `NOT_FOUND` / `BUSY`)
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
- Sorting_Data มีคอลัมน์ `Found_At` (ขั้นตอนที่พบ) — ส่งมาจากระบบ Sorting (`jrh91234/CWM-sorting-system-`) ผ่าน `SAVE_SORTING`/`EDIT_SORTING`
  - ค่าที่มีคำว่า FG/RTV = เคยนับเป็น FG แล้ว → หักออกจาก FG · ค่าอื่น (เช่น "ระหว่างกระบวนการผลิต") = ยอดใหม่
  - ถ้าแถวเก่าไม่มีค่า ระบบ fallback ไปอ่าน `[พบที่: ...]` ใน Remark เหมือนเดิม
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
- PowerPoint Sorting trend uses Dashboard `sortingTrend[]` (`date`, `fgPcs`, `ngPcs`, `pendingPcs`) grouped by Sorting record date; Completed/Wait QC outputs and Pending/Rejected quantities stay separate from production totals.
- Frontend: `window.getJobOrderQty(j)` ใน `js/planning.js` เป็นตัวกลางอ่านค่าเหล่านี้ (มี fallback สำหรับข้อมูลเก่า) — ใช้ทั้งตาราง Plan, การ์ด Dashboard, Auto Report, CSV

## Daily Check (OK 1st Part Workstation Check list)
- Frontend: `js/dailycheck.js` + `section-dailycheck` ใน index.html, เมนู `tab-dailycheck` (Admin / Production / QC)
- ตรวจทุกเครื่อง CWM-01..16 ทุกกะ (Day 08:00-20:00 / Night 20:00-08:00, วันที่กะตัดรอบ 08:00 ตาม getShiftDateStr) — ตารางสถานะเครื่องต่อกะ (เขียว OK / แดง NOK / เทา ยังไม่ตรวจ)
- 11 ข้อตรวจตามแบบฟอร์ม (C1..C10 + C11 ชิ้นงานตัวสุดท้าย) ค่า OK / NOK / N/A · มี NOK → ผล NOK และต้องกรอก Remark (Recovery plan)
- Sheet `Daily_Check`: Check_ID, Timestamp, Shift_Date, Shift, Check_Time, Machine, Product, Check_Type, C1..C11, Result, Inspector, Recorded_By, Remark, Supervisor, Confirmed_At (สร้างอัตโนมัติ)
- Backend actions (POST): `SAVE_DAILY_CHECK`, `GET_DAILY_CHECKS` (dateFrom/dateTo/machine), `CONFIRM_DAILY_CHECK` (หัวหน้างานยืนยัน), `DELETE_DAILY_CHECK` (Admin)

## 5ส. หลังเลิกงาน (Production)
- Frontend: `js/fives.js` + `section-fives` (+ กล้องเต็มจอ `fs-cam`, หน้าต่างดูรูป `fs-photo-modal`) ใน index.html, เมนู `tab-fives` (Admin / Production) · CSS `.fs-*` ใน `css/style.css`
- ทุกกะ (A/B) ทำวันละ 1 ครั้ง จ.–ส. (วันอาทิตย์ไม่มี) วันทำงานตัดรอบ 08:00 · ผู้ใช้เลือก "กะของฉัน" เอง (จำใน localStorage `cwm_fives_crew`)
- ถ่ายรูปครบ 3 รูป (บังคับ): 1) พื้นที่ทำงาน/พื้นรอบเครื่อง 2) โต๊ะงาน/เครื่องมือเก็บเข้าที่ 3) ถังขยะ/ถังเศษ/จุดวางงาน NG — กล้องในหน้าเว็บเท่านั้น (fallback `<input capture>` ไม่รับไฟล์เก่ากว่า 5 นาที) ย่อ 1280px JPEG 0.75 ประทับแถบ กะ/(n/3)/เวลา/ชื่อ
- รูปตัวอย่างจางในช่องว่าง: `img/fives/end-1..3.jpg` (ดู `img/fives/README.md`)
- **ให้คะแนนย้อนหลัง / แก้คะแนน**: `SCORE_FIVES` (entryId, score, scoreNote) เฉพาะงาน confirmed, ห้ามให้คะแนนงานตัวเอง (ยกเว้น Admin) · บันทึก `ScoredBy`/`ScoredAt` · GET คืน `unscored` (ยืนยันแล้วไม่มีคะแนน ย้อน 60 วัน) → การ์ด `fs-unscored-card` ในแท็บสรุปรายสัปดาห์ · ปุ่ม `fs-photo-score` ในหน้าต่างดูรูปของงานที่ยืนยันแล้ว
- **คะแนน 5ส.**: Leader ต้องให้คะแนน 0–10 (บังคับ) + ความเห็น (ไม่บังคับ) ตอนยืนยัน (ยืนยันทั้งหมด = คะแนนเดียวกัน) → คอลัมน์ `Score`, `ScoreNote` · แท็บสรุปรายสัปดาห์มีการ์ด "คะแนนประเมินพนักงานประจำกะ" เฉลี่ยทั้งเดือนต่อกะ A/B และต่อผู้ถ่าย (`monthScored` จาก GET_FIVES_WEEK) · ถูกตีกลับแล้วส่งใหม่ คะแนนเดิมถูกล้าง
- Leader (role Admin / Production) ยืนยัน หรือ "ให้ทำใหม่" พร้อมเหตุผล — คนถ่ายยืนยัน/ตีกลับงานตัวเองไม่ได้ (ยกเว้น Admin) · งานที่ถูกตีกลับถ่ายใหม่ครบ 3 รูปแล้วบันทึกทับแถวเดิม
- Sheet `FiveSEndLog`: EntryID (`5SE-yyyyMMdd-XXXXXX`), Timestamp, Date, Day, Shift, DoneBy, DoneByName, Photos (URL คั่น ", "), Remark, Status (done/confirmed/rejected), ConfirmedBy, ConfirmedName, ConfirmedAt, RejectReason, ClientRequestID, Score, ScoreNote, ScoredBy, ScoredAt (สร้าง/เติมคอลัมน์อัตโนมัติ) · รูปเก็บ Drive โฟลเดอร์ `5S_Photos` (Script Property `FIVES_PHOTOS_FOLDER_ID`)
- Backend actions (POST): `GET_FIVES_WEEK` (date → endEntries/endToday/pending ย้อน 31 วัน/canConfirm), `SAVE_FIVES_END` (shift, photos[3], remark, clientRequestId กันส่งซ้ำ), `CONFIRM_FIVES` (entryIds[], score 0–10, scoreNote), `REJECT_FIVES` (entryId, reason)

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
- **Modify PowerPoint export**: Edit `js/report/pptx-export.js` and its modal in `index.html`
- **Modify popup/breakdown**: Edit `js/charts/popups.js`
- **Modify data collection**: Edit `scr/backend.gs`
- **Modify NG form**: Edit `js/form.js`
- **Modify parts tracking**: Edit `js/parts.js`
- **Modify menu/role access**: Edit `js/globals.js` (search `allMenus` / `allowedMenus`)
- **Modify production plan / Job Order**: Edit `js/planning.js` (frontend) + `scr/backend.gs` (search `SAVE_PLAN` / `getJobOrders_`)
