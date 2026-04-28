/**
 * ปรับปรุง v3.55 + ระบบ Authentication & Maintenance (Job ID) & RTV & Widget Manager & Packing: 
 * - แก้ไข GET_SORTING ให้รองรับการทำงานร่วมกับ Frontend UI (ส่ง Completed, Closed_By, Closed_Date และรองรับ filterBy)
 * - เพิ่มระบบ Login, เช็คสิทธิ์ Role (Admin, Production, QC, Planning, Viewer)
 * - เพิ่มระบบเก็บ Log Action ของผู้ใช้
 * - คงฟังก์ชันเดิมทั้งหมด (บันทึกผลิต, แผน, สรุปกราฟ Dashboard ฯลฯ)
 * - เพิ่มระบบ Admin จัดการผู้ใช้ (เพิ่ม/แก้ไข/ลบ)
 * - เพิ่มระบบ แจ้งซ่อม/บันทึกปัญหา (Maintenance Log) แบบมี Job_ID (รองรับการซ่อมข้ามวัน กันกดเบิ้ล)
 * - เพิ่มระบบ บันทึกงานเคลม RTV
 * - เพิ่มระบบ Admin ซ่อน/แสดง กราฟบน Dashboard (Widget Manager)
 * - เพิ่มระบบ บันทึกข้อมูล Packing & Pallet
 */

const REQUIRED_COLUMNS = [
  "Timestamp", "Date", "Machine", "Shift", "Recorder", 
  "Product", "Hour", "FG", "NG_Total", "NG_Details_JSON", "Shift_Type", "Batch_ID"
];

function capitalizeFirst(str) {
  if (!str) return "";
  let strTrimmed = String(str).trim();
  if (strTrimmed.length > 0) {
    return strTrimmed.charAt(0).toUpperCase() + strTrimmed.slice(1);
  }
  return strTrimmed;
}

function normalizeNgSymptomName(str) {
  const text = String(str || "").trim();
  if (!text) return "";
  const setupMatch = text.match(/^setup\s*-\s*(.+)$/i);
  if (setupMatch) return capitalizeFirst(setupMatch[1]);
  if (text.toLowerCase() === "setup") return "Setup";
  return capitalizeFirst(text);
}

// ==================================================
// 🌟 ฟังก์ชันสำหรับเซฟรูปภาพลง Google Drive
// ==================================================
function saveImageToDrive(base64Data, filename) {
  if (!base64Data) return "";
  try {
    const splitBase = base64Data.split(',');
    const type = splitBase[0].split(';')[0].replace('data:', '');
    const byteCharacters = Utilities.base64Decode(splitBase[1]);
    const blob = Utilities.newBlob(byteCharacters, type, filename);

    const folderId = "1GcY_XvQTaBTE75dkrWdh8SnABXfUc6G4"; // เปลี่ยน ID โฟลเดอร์เป็นของคุณ
    const folder = DriveApp.getFolderById(folderId);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();
  } catch (e) {
    console.error("Save image error: " + e);
    return "";
  }
}

// ==================================================
// 🌟 โฟลเดอร์แยกสำหรับรูปการตรวจเช็คอะไหล่
// ==================================================
function getOrCreateCheckPhotosFolder() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty("PARTS_CHECK_PHOTOS_FOLDER_ID");
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (e) { /* fall through */ }
  }
  // สร้างเป็น sibling ของโฟลเดอร์ NG เดิม (หา parent ของ folder NG)
  try {
    const ngFolder = DriveApp.getFolderById("1GcY_XvQTaBTE75dkrWdh8SnABXfUc6G4");
    const parents = ngFolder.getParents();
    const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    const newFolder = parent.createFolder("Parts_Check_Photos");
    newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty("PARTS_CHECK_PHOTOS_FOLDER_ID", newFolder.getId());
    return newFolder;
  } catch (e) {
    console.error("Create check folder error: " + e);
    // Fallback: ใช้โฟลเดอร์ NG เดิม
    return DriveApp.getFolderById("1GcY_XvQTaBTE75dkrWdh8SnABXfUc6G4");
  }
}

function saveCheckImageToDrive(base64Data, filename) {
  if (!base64Data) return "";
  try {
    const splitBase = base64Data.split(',');
    const type = splitBase[0].split(';')[0].replace('data:', '');
    const byteCharacters = Utilities.base64Decode(splitBase[1]);
    const blob = Utilities.newBlob(byteCharacters, type, filename);
    const folder = getOrCreateCheckPhotosFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    console.error("Save check image error: " + e);
    return "";
  }
}

// เพิ่ม column ที่ขาดหายไปใน sheet (backward compat helper)
function ensureColumns(sheet, requiredCols) {
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  requiredCols.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    }
  });
}

// ค้น Check_Interval_Shots default จาก Parts_Master
function lookupPartsMasterCheckInterval(ss, partId) {
  if (!partId) return 0;
  const sheet = ss.getSheetByName("Parts_Master");
  if (!sheet) return 0;
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return 0;
  const headers = rows[0].map(h => String(h).trim());
  const pidIdx = headers.indexOf("Part_ID");
  const ciIdx = headers.indexOf("Check_Interval_Shots");
  if (pidIdx === -1 || ciIdx === -1) return 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][pidIdx] || "").trim() === partId) {
      return parseInt(rows[i][ciIdx]) || 0;
    }
  }
  return 0;
}

// ==================================================
// 🌟 GET ROUTE (ดึงข้อมูล)
// ==================================================
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === "GET_DASHBOARD") {
      return ContentService.createTextOutput(JSON.stringify(getAdvancedDashboardData(e.parameter.start, e.parameter.end, e.parameter.shift, e.parameter.shiftType))).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "GET_OPTIONS") {
      return ContentService.createTextOutput(JSON.stringify(getUniqueOptionsFromHistory())).setMimeType(ContentService.MimeType.JSON);
    }

    // 🌟 ดึงข้อมูลงานรอ Sort (ปรับปรุงใหม่ให้เข้ากับ Frontend) 🌟
    if (action === "GET_SORTING") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("Sorting_Data");
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "success", data: [], summaryData: []})).setMimeType(ContentService.MimeType.JSON);
      
      const startDateStr = e.parameter.start || "";
      const endDateStr = e.parameter.end || "";
      const filterBy = e.parameter.filterBy || "reported"; // ค่าจาก UI: 'reported' หรือ 'closed'

      const rows = sheet.getDataRange().getValues();
      const headers = rows[0];
      const activeJobs = [];
      const summaryJobs = [];
      
      // ป้องกันปัญหาตั้งชื่อคอลัมน์ผิดเล็กน้อย (Case-insensitive)
      const getCol = (name) => headers.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());

      let jobCol = getCol("Job_ID");
      let dateCol = getCol("Date");
      let prodCol = getCol("Product");
      let sympCol = getCol("Symptom");
      let qtyCol = getCol("Qty");
      let remCol = getCol("Remark");
      let recCol = getCol("Recorder");
      let statCol = getCol("Status");
      let fgCol = getCol("FG_Qty");
      let ngCol = getCol("NG_Qty");
      let closedByCol = getCol("Closed_By"); 
      let closedDateCol = getCol("Closed_Date");
      let sorterCol = getCol("Sorter");
      let rejectTargetCol = getCol("Reject_Target");
      let qcFgApprovedCol = getCol("QC_FG_Approved");
      let qcNgApprovedCol = getCol("QC_NG_Approved");

      if (jobCol === -1 || statCol === -1) return ContentService.createTextOutput(JSON.stringify({status: "success", data: [], summaryData: []})).setMimeType(ContentService.MimeType.JSON);

      const todayObj = new Date();
      const todayISO = Utilities.formatDate(todayObj, "GMT+7", "yyyy-MM-dd");

      for (let i = 1; i < rows.length; i++) {
        let r = rows[i];
        let currentStatus = String(r[statCol]).trim();
        if(!currentStatus) continue;
        
        // 1. จัดการวันที่แจ้ง (Reported Date) - ป้องกันบั๊ก พ.ศ. 2569
        let dDate = r[dateCol];
        let dDateISO = "";
        
        if (dDate instanceof Date) {
            let yyyy = dDate.getFullYear();
            if (yyyy > 2500) yyyy -= 543; // แปลง พ.ศ. เป็น ค.ศ.
            let mm = String(dDate.getMonth() + 1).padStart(2, '0');
            let dd = String(dDate.getDate()).padStart(2, '0');
            dDateISO = `${yyyy}-${mm}-${dd}`;
            dDate = `${dDateISO} ${Utilities.formatDate(dDate, "GMT+7", "HH:mm")}`;
        } else {
            dDate = String(dDate);
            let dStr = dDate.split(' ')[0];
            if(dStr.includes('/')) {
                let parts = dStr.split('/');
                if(parts.length === 3) {
                    let yyyy = parts[2];
                    if(yyyy.length === 2) yyyy = "20" + yyyy;
                    else if(parseInt(yyyy) > 2500) yyyy = String(parseInt(yyyy) - 543);
                    dDateISO = `${yyyy}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                }
            } else if (dStr.includes('-')) {
                let parts = dStr.split('-');
                if(parts.length >= 3) {
                    let yyyy = parts[0];
                    if(parseInt(yyyy) > 2500) yyyy = String(parseInt(yyyy) - 543);
                    dDateISO = `${yyyy}-${parts[1]}-${parts[2]}`;
                }
            } else {
                dDateISO = dStr.substring(0, 10);
            }
        }

        // 2. จัดการวันที่ปิดงาน (Closed Date) - ป้องกันบั๊ก พ.ศ. 2569
        let cDate = closedDateCol > -1 ? r[closedDateCol] : "";
        let cDateISO = "";
        
        if (cDate) {
            if (cDate instanceof Date) {
                let yyyy = cDate.getFullYear();
                if (yyyy > 2500) yyyy -= 543; // แปลง พ.ศ. เป็น ค.ศ.
                let mm = String(cDate.getMonth() + 1).padStart(2, '0');
                let dd = String(cDate.getDate()).padStart(2, '0');
                cDateISO = `${yyyy}-${mm}-${dd}`;
                cDate = `${cDateISO} ${Utilities.formatDate(cDate, "GMT+7", "HH:mm")}`;
            } else {
                cDate = String(cDate);
                let cStr = cDate.split(' ')[0];
                if(cStr.includes('/')) {
                   let parts = cStr.split('/');
                   if(parts.length === 3) {
                       let yyyy = parts[2];
                       if(yyyy.length === 2) yyyy = "20" + yyyy;
                       else if(parseInt(yyyy) > 2500) yyyy = String(parseInt(yyyy) - 543);
                       cDateISO = `${yyyy}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                   }
                } else if (cStr.includes('-')) {
                   let parts = cStr.split('-');
                   if (parts.length >= 3) {
                       let yyyy = parts[0];
                       if (parseInt(yyyy) > 2500) yyyy = String(parseInt(yyyy) - 543);
                       cDateISO = `${yyyy}-${parts[1]}-${parts[2]}`;
                   }
                } else {
                   cDateISO = cStr.substring(0, 10);
                }
            }
        }

        // 3. กรองตารางหลัก 
        let targetDateISO = dDateISO; 
        if (filterBy === "closed" && cDateISO) {
            targetDateISO = cDateISO; // ถ้ากรองด้วยวันปิดงาน ให้ใช้วันปิดงานเป็นเกณฑ์
        }

        let isActiveDateMatch = true;
        if (startDateStr && endDateStr) {
             if (targetDateISO < startDateStr || targetDateISO > endDateStr) {
                 isActiveDateMatch = false;
             }
        }

        // ดึงข้อมูลสถานะทั้งหมดกลับไป (รวมถึง Completed) ให้ Frontend ไปแยก Tab เอง
        if (isActiveDateMatch) {
          activeJobs.push({
            jobId: r[jobCol],
            date: dDate,
            product: r[prodCol],
            symptom: r[sympCol],
            qty: r[qtyCol],
            remark: r[remCol],
            recorder: r[recCol],
            status: currentStatus,
            fgQty: fgCol > -1 ? r[fgCol] : "",
            ngQty: ngCol > -1 ? r[ngCol] : "",
            closedBy: closedByCol > -1 ? r[closedByCol] : "",
            closedDate: cDate,
            sorter: sorterCol > -1 ? r[sorterCol] : "",
            rejectTarget: rejectTargetCol > -1 ? r[rejectTargetCol] : "",
            qcFgApproved: qcFgApprovedCol > -1 ? String(r[qcFgApprovedCol] || "").toUpperCase() === "TRUE" : false,
            qcNgApproved: qcNgApprovedCol > -1 ? String(r[qcNgApprovedCol] || "").toUpperCase() === "TRUE" : false
          });
        }

        // 4. กรองกล่องสรุปผลงาน (Summary Jobs) -> วัดจากงานที่คัดเสร็จแล้วเท่านั้น
        let isSummaryDateMatch = false;
        let summaryTargetISO = cDateISO || dDateISO;

        if (startDateStr && endDateStr) {
             if (summaryTargetISO >= startDateStr && summaryTargetISO <= endDateStr) {
                 isSummaryDateMatch = true;
             }
        } else {
             if (summaryTargetISO === todayISO) isSummaryDateMatch = true; // ค่าเริ่มต้นคือวันนี้
        }

       if ((currentStatus === "Wait QC" || currentStatus === "Completed" || currentStatus === "Rejected") && isSummaryDateMatch) {
            summaryJobs.push({
                jobId: r[jobCol],
                product: r[prodCol],
                symptom: r[sympCol] || "",
                fgQty: fgCol > -1 ? r[fgCol] : "",
                ngQty: ngCol > -1 ? r[ngCol] : "",
                status: currentStatus,
                sortDate: summaryTargetISO,
                sorter: sorterCol > -1 ? r[sorterCol] : ""
            });
        }
      }
      
      activeJobs.sort((a, b) => b.date.localeCompare(a.date));
      return ContentService.createTextOutput(JSON.stringify({
          status: "success", 
          data: activeJobs,
          summaryData: summaryJobs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ดึงข้อมูลแจ้งซ่อมที่ยังไม่เสร็จ (ค้างข้ามวัน)
    if (action === "GET_PENDING_MAINTENANCE") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("Maintenance_Data");
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);
      
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0];
      const pendingJobs = [];
      
      const getCol = (name) => headers.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
      let jobCol = getCol("Job_ID");
      let dateCol = getCol("Date");
      let macCol = getCol("Machine");
      let issueCol = getCol("Issue_Type");
      let startCol = getCol("Start_Time");
      let endCol = getCol("End_Time");
      let remarkCol = getCol("Remark");

      if (jobCol === -1) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);

      for (let i = 1; i < rows.length; i++) {
        let r = rows[i];
        if (r[jobCol] && (!r[endCol] || String(r[endCol]).trim() === "")) {
          let dDate = (r[dateCol] instanceof Date) ? Utilities.formatDate(r[dateCol], "GMT+7", "yyyy-MM-dd") : String(r[dateCol]).substring(0, 10);
          let sTime = (r[startCol] instanceof Date) ? Utilities.formatDate(r[startCol], "GMT+7", "HH:mm") : String(r[startCol]).substring(0, 5);
          
          pendingJobs.push({
            jobId: r[jobCol],
            date: dDate,
            machine: r[macCol],
            issueType: r[issueCol],
            startTime: sTime,
            remark: r[remarkCol]
          });
        }
      }
      
      pendingJobs.sort((a, b) => a.date.localeCompare(b.date));
      return ContentService.createTextOutput(JSON.stringify({status: "success", data: pendingJobs})).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "DEBUG") {
      return ContentService.createTextOutput(JSON.stringify(debugSheetData())).setMimeType(ContentService.MimeType.JSON);
    }

    // 🌟 ดึงรายการ NG จาก Production_Data สำหรับระบบนับ Stock 🌟
    if (action === "GET_STOCK_ITEMS") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const items = [];

      // ดึงจาก Production_Data (เฉพาะแถวที่มี NG > 0)
      const prodSheet = ss.getSheetByName("Production_Data");
      if (prodSheet && prodSheet.getLastRow() > 1) {
        const pRows = prodSheet.getDataRange().getValues();
        const pH = pRows[0];
        const pCol = (name) => pH.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
        const cDate = pCol("Date"), cMachine = pCol("Machine"), cProduct = pCol("Product");
        const cFG = pCol("FG"), cNG = pCol("NG_Total"), cNGJson = pCol("NG_Details_JSON");
        const cRecorder = pCol("Recorder"), cShift = pCol("Shift"), cBatchId = pCol("Batch_ID");
        const cTimestamp = pCol("Timestamp");

        for (let i = 1; i < pRows.length; i++) {
          const r = pRows[i];
          const ngTotal = parseFloat(r[cNG]) || 0;
          if (ngTotal <= 0) continue;

          let dateStr = "";
          if (cDate > -1) {
            const d = r[cDate];
            if (d instanceof Date) {
              let y = d.getFullYear(); if (y > 2500) y -= 543;
              dateStr = y + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
            } else { dateStr = String(d).split(" ")[0]; }
          }

          // parse NG breakdown
          let ngDetails = [];
          if (cNGJson > -1 && r[cNGJson]) {
            try {
              const parsed = JSON.parse(r[cNGJson]);
              if (Array.isArray(parsed)) {
                ngDetails = parsed.filter(d => parseFloat(d.qty) > 0);
              }
            } catch(e) {}
          }

          // ถ้ามี breakdown ให้สร้างรายการแยกตามอาการ
          if (ngDetails.length > 0) {
            ngDetails.forEach(detail => {
              items.push({
                source: "Production_Data",
                refId: cBatchId > -1 ? String(r[cBatchId] || "") : ("ROW-" + (i+1)),
                rowNum: i + 1,
                date: dateStr,
                machine: cMachine > -1 ? String(r[cMachine]) : "",
                product: cProduct > -1 ? String(r[cProduct]) : "",
                symptom: detail.type || "",
                qty: String(detail.qty) + " kg",
                fg: cFG > -1 ? String(r[cFG]) : "0",
                ngTotal: String(ngTotal),
                recorder: cRecorder > -1 ? String(r[cRecorder]) : "",
                shift: cShift > -1 ? String(r[cShift]) : ""
              });
            });
          } else {
            // ไม่มี breakdown ให้แสดงยอดรวม
            items.push({
              source: "Production_Data",
              refId: cBatchId > -1 ? String(r[cBatchId] || "") : ("ROW-" + (i+1)),
              rowNum: i + 1,
              date: dateStr,
              machine: cMachine > -1 ? String(r[cMachine]) : "",
              product: cProduct > -1 ? String(r[cProduct]) : "",
              symptom: "รวม NG",
              qty: String(ngTotal) + " kg",
              fg: cFG > -1 ? String(r[cFG]) : "0",
              ngTotal: String(ngTotal),
              recorder: cRecorder > -1 ? String(r[cRecorder]) : "",
              shift: cShift > -1 ? String(r[cShift]) : ""
            });
          }
        }
      }

      // ดึงประวัติ Stock Count ล่าสุด
      let history = [];
      const scSheet = ss.getSheetByName("Stock_Count");
      if (scSheet && scSheet.getLastRow() > 1) {
        const scRows = scSheet.getDataRange().getValues();
        const scH = scRows[0];
        const scCol = (name) => scH.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
        for (let i = 1; i < scRows.length; i++) {
          const r = scRows[i];
          history.push({
            countId: scCol("Count_ID") > -1 ? String(r[scCol("Count_ID")]) : "",
            timestamp: scCol("Timestamp") > -1 ? String(r[scCol("Timestamp")]) : "",
            refId: scCol("Ref_ID") > -1 ? String(r[scCol("Ref_ID")]) : "",
            product: scCol("Product") > -1 ? String(r[scCol("Product")]) : "",
            symptom: scCol("Symptom") > -1 ? String(r[scCol("Symptom")]) : "",
            expectedQty: scCol("Expected_Qty") > -1 ? String(r[scCol("Expected_Qty")]) : "",
            actualQty: scCol("Actual_Qty") > -1 ? String(r[scCol("Actual_Qty")]) : "",
            diff: scCol("Diff") > -1 ? String(r[scCol("Diff")]) : "",
            status: scCol("Status") > -1 ? String(r[scCol("Status")]) : "",
            pallet: scCol("Pallet") > -1 ? String(r[scCol("Pallet")]) : "",
            counter: scCol("Counter") > -1 ? String(r[scCol("Counter")]) : "",
            remark: scCol("Remark") > -1 ? String(r[scCol("Remark")]) : ""
          });
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success", items: items, history: history
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const url = ScriptApp.getService().getUrl();
    const html = `<div style="font-family:sans-serif;text-align:center;padding:50px;"><h1>🚀 System v3.55 (Auth + QC Inbox) Online</h1><a href="${url}?action=DEBUG" target="_blank" style="background:#007bff;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;font-weight:bold;">🔍 กดปุ่มนี้เพื่อดูข้อมูล Debug</a></div>`;
    return HtmlService.createHtmlOutput(html);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================================================
// 🌟 POST ROUTE (บันทึกข้อมูล)
// ==================================================
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid JSON" })).setMimeType(ContentService.MimeType.JSON);
  }

  const action = data.action;

  if (action === "GET_SORTING_PROD_SUMMARY") {
    try {
      const sheet = ss.getSheetByName("Production_Data");
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", summary: {}, totals: { fg: 0, ng: 0, jobs: 0 } })).setMimeType(ContentService.MimeType.JSON);
      }

      const rows = sheet.getDataRange().getValues();
      if (rows.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", summary: {}, totals: { fg: 0, ng: 0, jobs: 0 } })).setMimeType(ContentService.MimeType.JSON);
      }

      const headers = rows[0].map(h => String(h || "").trim());
      const getCol = (name) => headers.findIndex(h => h.toLowerCase() === String(name).toLowerCase());
      const productCol = getCol("Product");
      const fgCol = getCol("FG");
      const ngKgCol = getCol("NG_Total");
      const batchIdCol = getCol("Batch_ID");
      const timestampCol = getCol("Timestamp");

      if (productCol === -1 || fgCol === -1 || ngKgCol === -1 || batchIdCol === -1 || timestampCol === -1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", summary: {}, totals: { fg: 0, ng: 0, jobs: 0 } })).setMimeType(ContentService.MimeType.JSON);
      }

      const start = String(data.start || "").trim();
      const end = String(data.end || "").trim();

      const toShiftDateISO = (rawVal) => {
        if (!rawVal) return "";

        const formatYmd = (dObj) => {
          return dObj.getFullYear() + "-" + String(dObj.getMonth() + 1).padStart(2, "0") + "-" + String(dObj.getDate()).padStart(2, "0");
        };

        if (rawVal instanceof Date) {
          const dObj = new Date(rawVal.getTime());
          const hour = parseInt(Utilities.formatDate(dObj, "GMT+7", "HH"), 10) || 0;
          if (hour < 8) dObj.setDate(dObj.getDate() - 1); // cutoff 08:00-07:59
          return formatYmd(dObj);
        }

        const text = String(rawVal).trim();
        if (!text) return "";
        const parts = text.split(" ");
        const d = parts[0];
        const t = parts.length > 1 ? parts[1] : "";
        const hour = t ? (parseInt(t.split(":")[0], 10) || 0) : null;
        const hasTime = hour !== null;

        let yyyy = "";
        let mm = "";
        let dd = "";
        if (d.includes("/")) {
          const dParts = d.split("/");
          if (dParts.length === 3) {
            yyyy = String(dParts[2]).trim();
            if (yyyy.length === 2) yyyy = "20" + yyyy;
            if (parseInt(yyyy, 10) > 2500) yyyy = String(parseInt(yyyy, 10) - 543);
            mm = String(dParts[1]).padStart(2, "0");
            dd = String(dParts[0]).padStart(2, "0");
          }
        } else if (d.includes("-")) {
          const dParts = d.split("-");
          if (dParts.length === 3) {
            yyyy = String(dParts[0]).trim();
            if (parseInt(yyyy, 10) > 2500) yyyy = String(parseInt(yyyy, 10) - 543);
            mm = String(dParts[1]).padStart(2, "0");
            dd = String(dParts[2]).padStart(2, "0");
          }
        }

        if (!yyyy || !mm || !dd) return d.substring(0, 10);
        const dObj = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
        if (hasTime && hour < 8) dObj.setDate(dObj.getDate() - 1); // cutoff 08:00-07:59
        return formatYmd(dObj);
      };

      const getWppStrict = (productName) => {
        const p = String(productName || "");
        if (p.includes("10A")) return 0.00228;
        if (p.includes("16A")) return 0.00279;
        if (p.includes("20A")) return 0.00357;
        if (p.includes("25/32A")) return 0.005335;
        return null;
      };

      const summary = {};
      let totalFg = 0;
      let totalNg = 0;
      let totalJobs = 0;
      const seenBatchIds = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const batchId = String(row[batchIdCol] || "").trim();
        if (!batchId || batchId.indexOf("SORT-") !== 0) continue;

        // กันนับซ้ำกรณีมีแถว Batch_ID เดิมซ้ำใน Production_Data
        if (seenBatchIds[batchId]) continue;
        seenBatchIds[batchId] = true;

        // ใช้วันที่จากเวลาที่บันทึกจริงลง Production_Data
        const targetDateRaw = row[timestampCol];
        const targetDateISO = toShiftDateISO(targetDateRaw);
        if (!targetDateISO) continue;
        if (start && targetDateISO < start) continue;
        if (end && targetDateISO > end) continue;

        const model = String(row[productCol] || "").trim();
        if (!model) continue;

        const wpp = getWppStrict(model);
        if (!wpp) continue; // strict no-fallback

        const fg = parseFloat(row[fgCol]) || 0;
        const ngKg = parseFloat(row[ngKgCol]) || 0;
        const ng = ngKg > 0 ? Math.round(ngKg / wpp) : 0;

        if (!summary[model]) summary[model] = { fg: 0, ng: 0, jobs: 0 };
        summary[model].fg += fg;
        summary[model].ng += ng;
        summary[model].jobs += 1;

        totalFg += fg;
        totalNg += ng;
        totalJobs += 1;
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        summary: summary,
        totals: { fg: totalFg, ng: totalNg, jobs: totalJobs }
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // --- ส่วนที่ 1: ระบบ Authentication & Admin ---
  if (action === "LOGIN") {
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบ Sheet 'Users' ในฐานข้อมูล"})).setMimeType(ContentService.MimeType.JSON);
    
    const sheetData = sheet.getDataRange().getValues();
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]) === String(data.username) && String(sheetData[i][1]) === String(data.password)) {
        logUserAction(sheetData[i][0], sheetData[i][2], "LOGIN", "เข้าสู่ระบบสำเร็จ");
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          user: { username: String(sheetData[i][0]), role: sheetData[i][2], name: sheetData[i][3] }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({success: false, message: "Username หรือ Password ไม่ถูกต้อง"})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "LOG_ACTION") {
    logUserAction(data.username, data.role, data.logType, data.details);
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "CHANGE_PASSWORD") {
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบ Sheet 'Users'"})).setMimeType(ContentService.MimeType.JSON);

    const sheetData = sheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]) === String(data.username) && String(sheetData[i][1]) === String(data.oldPassword)) {
        foundRow = i + 1; 
        break;
      }
    }

    if (foundRow > 1) {
      sheet.getRange(foundRow, 2).setValue(data.newPassword);
      logUserAction(data.username, data.role || "User", "CHANGE_PASSWORD", "ผู้ใช้งานเปลี่ยนรหัสผ่านด้วยตนเอง");
      return ContentService.createTextOutput(JSON.stringify({success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ"})).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: "รหัสผ่านเดิมไม่ถูกต้อง หรือไม่พบข้อมูลผู้ใช้"})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "GET_USERS") {
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบ Sheet 'Users'"})).setMimeType(ContentService.MimeType.JSON);
    
    const sheetData = sheet.getDataRange().getValues();
    const users = [];
    for(let i = 1; i < sheetData.length; i++) {
        users.push({ username: sheetData[i][0], role: sheetData[i][2], name: sheetData[i][3] });
    }
    return ContentService.createTextOutput(JSON.stringify({success: true, users: users})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "ADD_USER") {
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบ Sheet 'Users'"})).setMimeType(ContentService.MimeType.JSON);
    
    const sheetData = sheet.getDataRange().getValues();
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]) === String(data.newUsername)) {
        return ContentService.createTextOutput(JSON.stringify({success: false, message: "มี Username นี้ในระบบแล้ว"})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    sheet.appendRow([data.newUsername, data.newPassword, data.newRole, data.newName]);
    logUserAction(data.adminUsername || "Admin", "Admin", "ADD_USER", "เพิ่มผู้ใช้ใหม่: " + data.newUsername);
    return ContentService.createTextOutput(JSON.stringify({success: true, message: "เพิ่มผู้ใช้สำเร็จ"})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "EDIT_USER") {
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบ Sheet 'Users'"})).setMimeType(ContentService.MimeType.JSON);
    
    const sheetData = sheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]) === String(data.targetUsername)) {
        foundRow = i + 1; 
        break;
      }
    }
    
    if (foundRow > 1) {
      if (data.newUsername) sheet.getRange(foundRow, 1).setValue(data.newUsername);
      if (data.newPassword) sheet.getRange(foundRow, 2).setValue(data.newPassword);
      if (data.newRole) sheet.getRange(foundRow, 3).setValue(data.newRole);
      if (data.newName) sheet.getRange(foundRow, 4).setValue(data.newName);
      
      logUserAction(data.adminUsername || "Admin", "Admin", "EDIT_USER", "แก้ไขผู้ใช้: " + data.targetUsername);
      return ContentService.createTextOutput(JSON.stringify({success: true, message: "แก้ไขข้อมูลผู้ใช้สำเร็จ"})).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบผู้ใช้ที่ต้องการแก้ไข"})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "DELETE_USER") {
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบ Sheet 'Users'"})).setMimeType(ContentService.MimeType.JSON);
    
    const sheetData = sheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]) === String(data.targetUsername)) {
        foundRow = i + 1;
        break;
      }
    }
    
    if (foundRow > 1) {
      sheet.deleteRow(foundRow);
      logUserAction(data.adminUsername || "Admin", "Admin", "DELETE_USER", "ลบผู้ใช้: " + data.targetUsername);
      return ContentService.createTextOutput(JSON.stringify({success: true, message: "ลบผู้ใช้สำเร็จ"})).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: "ไม่พบผู้ใช้ที่ต้องการลบ"})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // --- ส่วนที่ 2: ระบบแจ้งซ่อม (Maintenance) ---
  if (action === "SAVE_MAINTENANCE") {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); 

      let sheet = ss.getSheetByName("Maintenance_Data");
      if (!sheet) {
          sheet = ss.insertSheet("Maintenance_Data");
          sheet.appendRow(["Timestamp", "Date", "Machine", "Issue_Type", "Start_Time", "End_Time", "Remark", "Image_URL", "Recorder", "Job_ID", "End_Date"]);
      }

      let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      
      if (headers.indexOf("Job_ID") === -1) {
          sheet.getRange(1, headers.length + 1).setValue("Job_ID");
          headers.push("Job_ID");
      }
      if (headers.indexOf("End_Date") === -1) {
          sheet.getRange(1, headers.length + 1).setValue("End_Date");
          headers.push("End_Date");
      }

      const now = new Date();
      const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      const timeStr = Utilities.formatDate(now, "GMT+7", "HHmmss");

      // กรณีปิดจ๊อบค้าง
      if (data.jobId) {
        const rows = sheet.getDataRange().getValues();
        let foundRow = -1;
        
        let jobCol = headers.indexOf("Job_ID");
        let endDateCol = headers.indexOf("End_Date") + 1; 
        let endTimeCol = headers.indexOf("End_Time") + 1;
        let remarkCol = headers.indexOf("Remark") + 1;
        let imgCol = headers.indexOf("Image_URL") + 1;

        for (let i = 1; i < rows.length; i++) {
          if (rows[i][jobCol] === data.jobId) {
            foundRow = i + 1; 
            break;
          }
        }

        if (foundRow > -1) {
          if (data.endDate) sheet.getRange(foundRow, endDateCol).setValue(data.endDate);
          if (data.endTime) sheet.getRange(foundRow, endTimeCol).setValue(data.endTime);
          
          let oldRemark = sheet.getRange(foundRow, remarkCol).getValue();
          let newRemarkText = ` | ปิดจ๊อบโดย: ${data.username || "Unknown"}`;
          if (data.remark && String(data.remark).trim() !== "") {
              newRemarkText += ` (อัปเดตตอนปิด: ${data.remark})`;
          }
          sheet.getRange(foundRow, remarkCol).setValue(oldRemark + newRemarkText);

          if (data.imageBase64 && imgCol > 0) {
              let closeImageUrl = saveImageToDrive(data.imageBase64, `MaintClose_${data.machine}_${dateStr}_${timeStr}.jpg`);
              if (closeImageUrl) {
                  let oldImg = sheet.getRange(foundRow, imgCol).getValue();
                  sheet.getRange(foundRow, imgCol).setValue(oldImg ? oldImg + "|" + closeImageUrl : closeImageUrl);
              }
          }

          SpreadsheetApp.flush();
          logUserAction(data.username || "System", data.role || "User", "CLOSE_MAINTENANCE", `ปิดจ๊อบ ${data.jobId} เครื่อง ${data.machine}`);
          return ContentService.createTextOutput(JSON.stringify({status: "success", message: `ปิดจ๊อบ ${data.jobId} สำเร็จ!`})).setMimeType(ContentService.MimeType.JSON);
        } else {
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: `ไม่พบจ๊อบ ${data.jobId} ในฐานข้อมูล`})).setMimeType(ContentService.MimeType.JSON);
        }
      } 
      // กรณีเปิดจ๊อบใหม่ (กันเบิ้ล)
      else {
        const rows = sheet.getDataRange().getValues();
        let isDuplicate = false;
        
        let dateCol = headers.indexOf("Date");
        let macCol = headers.indexOf("Machine");
        let startCol = headers.indexOf("Start_Time");

        let inDate = data.date || dateStr;
        let inStartMatch = String(data.startTime).match(/(\d{1,2}:\d{2})/);
        let inStart = inStartMatch ? inStartMatch[1].padStart(5, '0') : String(data.startTime).substring(0, 5);

        let startCheck = Math.max(1, rows.length - 50);
        for (let i = startCheck; i < rows.length; i++) {
          let rDateVal = rows[i][dateCol];
          let rDate = (rDateVal instanceof Date) ? Utilities.formatDate(rDateVal, "GMT+7", "yyyy-MM-dd") : String(rDateVal).substring(0, 10);
          
          let rMac = String(rows[i][macCol]).trim();
          
          let rStartVal = rows[i][startCol];
          let rStart = "";
          if (rStartVal instanceof Date) {
              rStart = Utilities.formatDate(rStartVal, "GMT+7", "HH:mm");
          } else if (rStartVal) {
              let match = String(rStartVal).match(/(\d{1,2}:\d{2})/);
              if (match) rStart = match[1].padStart(5, '0');
          }

          if (rDate === inDate && rMac === data.machine && rStart === inStart) {
              isDuplicate = true;
              break;
          }
        }

        if (isDuplicate) {
            return ContentService.createTextOutput(JSON.stringify({status: "success", message: `บันทึกข้อมูลเรียบร้อยแล้ว`})).setMimeType(ContentService.MimeType.JSON);
        }

        let imageUrl = data.imageBase64 ? saveImageToDrive(data.imageBase64, `Maint_${data.machine}_${dateStr}_${timeStr}.jpg`) : "";

        const newJobId = "MT-" + Utilities.formatDate(now, "GMT+7", "yyMMdd") + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        let newRow = new Array(headers.length).fill("");
        const mapValue = (colName, val) => {
            let idx = headers.indexOf(colName);
            if (idx > -1) newRow[idx] = val;
        };

        mapValue("Timestamp", now.toLocaleString('th-TH'));
        mapValue("Date", inDate);
        mapValue("Machine", data.machine);
        mapValue("Issue_Type", data.issueType);
        mapValue("Start_Time", data.startTime);
        mapValue("End_Time", data.endTime || "");
        mapValue("Remark", data.remark || "-");
        mapValue("Image_URL", imageUrl);
        mapValue("Recorder", data.username || "Unknown");
        mapValue("Job_ID", newJobId);
        mapValue("End_Date", data.endDate || "");

        sheet.appendRow(newRow);
        SpreadsheetApp.flush();

        logUserAction(data.username || "System", data.role || "User", "SAVE_MAINTENANCE", `เปิดจ๊อบใหม่ ${newJobId} เครื่อง ${data.machine}`);
        return ContentService.createTextOutput(JSON.stringify({status: "success", message: `เปิดจ๊อบ ${newJobId} สำเร็จ!`, imageUrl: imageUrl})).setMimeType(ContentService.MimeType.JSON);
      }

    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock(); 
    }
  }

  // --- ส่วนที่ 2.5: ระบบงานเคลม RTV ---

  // --- ระบบ Tracking อะไหล่เครื่องจักร (Parts Tracking) ---
  if (action === "GET_PARTS_MASTER") {
    let sheet = ss.getSheetByName("Parts_Master");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);
    const headers = rows[0].map(h => String(h).trim());
    const data2 = [];
    for (let i = 1; i < rows.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = rows[i][idx] !== undefined ? rows[i][idx] : ""; });
      if (obj.Part_ID) data2.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify({status: "success", data: data2})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_PARTS_MASTER") {
    let sheet = ss.getSheetByName("Parts_Master");
    if (!sheet) {
      sheet = ss.insertSheet("Parts_Master");
      sheet.appendRow(["Part_ID", "Part_Name", "Category", "Life_Shots", "Unit_Cost", "Supplier", "Remark"]);
    }
    const d = data.part;
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => String(h).trim());
    const colIdx = (name) => headers.indexOf(name);

    // เพิ่ม column Check_Interval_Shots ใน Parts_Master ถ้ายังไม่มี (backward compat)
    if (headers.indexOf("Check_Interval_Shots") === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue("Check_Interval_Shots");
    }

    if (data.mode === "edit" && d.Part_ID) {
      // แก้ไขอะไหล่เดิม
      const newLife = parseInt(d.Life_Shots) || 0;
      const newName = d.Part_Name || "";
      const newCheckInterval = parseInt(d.Check_Interval_Shots) || 0;
      const freshHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const checkCol = freshHeaders.indexOf("Check_Interval_Shots");
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][colIdx("Part_ID")]).trim() === d.Part_ID) {
          sheet.getRange(i + 1, colIdx("Part_Name") + 1).setValue(newName);
          sheet.getRange(i + 1, colIdx("Category") + 1).setValue(d.Category || "");
          sheet.getRange(i + 1, colIdx("Life_Shots") + 1).setValue(newLife);
          sheet.getRange(i + 1, colIdx("Unit_Cost") + 1).setValue(parseFloat(d.Unit_Cost) || 0);
          sheet.getRange(i + 1, colIdx("Supplier") + 1).setValue(d.Supplier || "");
          sheet.getRange(i + 1, colIdx("Remark") + 1).setValue(d.Remark || "");
          if (checkCol !== -1) sheet.getRange(i + 1, checkCol + 1).setValue(newCheckInterval);
          // Sync: อัพเดต Life_Shots + Part_Name + Check_Interval ของ Active installation ทั้งหมดของ Part_ID นี้
          const instSheet = ss.getSheetByName("Parts_Installation");
          if (instSheet) {
            const iRows = instSheet.getDataRange().getValues();
            if (iRows.length > 1) {
              const iHdr = iRows[0].map(h => String(h).trim());
              const iPid = iHdr.indexOf("Part_ID");
              const iStatus = iHdr.indexOf("Status");
              const iLife = iHdr.indexOf("Life_Shots");
              const iName = iHdr.indexOf("Part_Name");
              const iCheckInterval = iHdr.indexOf("Check_Interval_Shots");
              if (iPid !== -1 && iLife !== -1) {
                for (let j = 1; j < iRows.length; j++) {
                  if (String(iRows[j][iPid] || "").trim() === d.Part_ID
                      && String(iRows[j][iStatus] || "").trim() === "Active") {
                    instSheet.getRange(j + 1, iLife + 1).setValue(newLife);
                    if (iName !== -1) instSheet.getRange(j + 1, iName + 1).setValue(newName);
                    if (iCheckInterval !== -1 && newCheckInterval > 0) {
                      instSheet.getRange(j + 1, iCheckInterval + 1).setValue(newCheckInterval);
                    }
                  }
                }
              }
            }
          }
          SpreadsheetApp.flush();
          return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Updated"})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Part_ID not found"})).setMimeType(ContentService.MimeType.JSON);
    } else {
      // เพิ่มอะไหล่ใหม่ — สร้าง Part_ID จากตัวย่อชื่อ (เช่น "Guide Roller" → "GR-001")
      const words = (d.Part_Name || "PART").trim().split(/\s+/);
      const prefix = words.map(function(w) { return w.charAt(0).toUpperCase(); }).join("");
      const pidCol = colIdx("Part_ID");
      let maxNum = 0;
      for (let i = 1; i < rows.length; i++) {
        const pid = String(rows[i][pidCol] || "");
        const match = pid.match(new RegExp("^" + prefix + "-(\\d+)$"));
        if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
      }
      const newId = prefix + "-" + String(maxNum + 1).padStart(3, "0");
      // Build row ตาม header order (รองรับ Check_Interval_Shots)
      const freshHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const rowData = freshHeaders.map(function(h) {
        switch(h) {
          case "Part_ID": return newId;
          case "Part_Name": return d.Part_Name || "";
          case "Category": return d.Category || "";
          case "Life_Shots": return parseInt(d.Life_Shots) || 0;
          case "Unit_Cost": return parseFloat(d.Unit_Cost) || 0;
          case "Supplier": return d.Supplier || "";
          case "Remark": return d.Remark || "";
          case "Check_Interval_Shots": return parseInt(d.Check_Interval_Shots) || 0;
          default: return "";
        }
      });
      sheet.appendRow(rowData);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Added", partId: newId})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "DELETE_PARTS_MASTER") {
    let sheet = ss.getSheetByName("Parts_Master");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Sheet not found"})).setMimeType(ContentService.MimeType.JSON);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === data.partId) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Deleted"})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Part not found"})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "GET_PARTS_INSTALLATION") {
    let sheet = ss.getSheetByName("Parts_Installation");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);
    const headers = rows[0].map(h => String(h).trim());
    const filterMachine = data.machine || "";
    const results = [];
    for (let i = 1; i < rows.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = rows[i][idx] !== undefined ? rows[i][idx] : ""; });
      if (!obj.Install_ID) continue;
      if (filterMachine && obj.Machine !== filterMachine) continue;
      results.push(obj);
    }
    // ถ้าไม่ระบุ machine filter → คำนวณ machineShots สำหรับ Active records ทั้งหมด (ใช้ใน Parts Master table)
    let machineShots = null;
    if (!filterMachine) {
      const activeMachines = [];
      results.forEach(function(r) {
        if (r.Status === "Active" && r.Machine && activeMachines.indexOf(r.Machine) === -1) {
          activeMachines.push(r.Machine);
        }
      });
      if (activeMachines.length > 0) {
        machineShots = calcMultiMachineShots(ss, activeMachines);
      }
    }
    const response = {status: "success", data: results};
    if (machineShots) response.machineShots = machineShots;
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_PARTS_INSTALLATION") {
    let sheet = ss.getSheetByName("Parts_Installation");
    if (!sheet) {
      sheet = ss.insertSheet("Parts_Installation");
      sheet.appendRow(["Install_ID", "Machine", "Part_ID", "Part_Name", "Install_Date", "Install_Shot", "Life_Shots", "Status", "Maint_Job_ID", "Recorder", "Replaced_Date", "Carried_Shots", "Carried_Days", "Check_Interval_Shots", "Next_Check_Shot", "Last_Check_Date", "Check_Count"]);
    }
    // ตรวจสอบว่ามีคอลัมน์ที่จำเป็นหรือยัง (backward compat)
    ensureColumns(sheet, ["Carried_Shots", "Carried_Days", "Check_Interval_Shots", "Next_Check_Shot", "Last_Check_Date", "Check_Count"]);

    const d = data.installation;
    const now = new Date();

    // หา Check_Interval_Shots default: frontend → Parts_Master → 0
    let checkInterval = parseInt(d.Check_Interval_Shots);
    if (!checkInterval || checkInterval < 0) {
      checkInterval = lookupPartsMasterCheckInterval(ss, d.Part_ID);
    }

    // รับ Install_Date จาก frontend ได้ (format: "yyyy-MM-dd" หรือ "yyyy-MM-dd HH:mm")
    // ถ้าไม่ส่งมาให้ใช้เวลาปัจจุบัน
    let installDateFull = String(d.Install_Date || "").trim();
    if (!installDateFull) {
      installDateFull = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd HH:mm");
    }
    const installDateOnly = installDateFull.substring(0, 10); // "yyyy-MM-dd"

    if (data.mode === "replace" && d.Install_ID) {
      // เปลี่ยน/ย้ายอะไหล่: ปิดตัวเก่า + คำนวณ carry-over + สร้างตัวใหม่
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(h => String(h).trim());
      const colIdx = (name) => headers.indexOf(name);
      let oldCarried = 0, oldInstallShot = 0, oldMachine = "";
      let oldCarriedDays = 0, oldInstallDateStr = "";
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][colIdx("Install_ID")]).trim() === d.Install_ID) {
          oldCarried = parseInt(rows[i][colIdx("Carried_Shots")]) || 0;
          oldInstallShot = parseInt(rows[i][colIdx("Install_Shot")]) || 0;
          oldMachine = String(rows[i][colIdx("Machine")] || "").trim();
          const cdIdx = colIdx("Carried_Days");
          oldCarriedDays = (cdIdx !== -1) ? (parseInt(rows[i][cdIdx]) || 0) : 0;
          const oldInstDateRaw = rows[i][colIdx("Install_Date")];
          if (oldInstDateRaw instanceof Date && !isNaN(oldInstDateRaw.getTime())) {
            oldInstallDateStr = Utilities.formatDate(oldInstDateRaw, "GMT+7", "yyyy-MM-dd");
          } else {
            oldInstallDateStr = String(oldInstDateRaw || "").trim().substring(0, 10);
          }
          sheet.getRange(i + 1, colIdx("Status") + 1).setValue("Replaced");
          sheet.getRange(i + 1, colIdx("Replaced_Date") + 1).setValue(installDateOnly);
          break;
        }
      }
      // คำนวณ Shot ที่ใช้ไปบนเครื่องเก่า (ถึงวันที่ถอดอะไหล่) แล้ว carry ไปยังรายการใหม่
      const oldMachineShots = oldMachine ? calcMachineShots(ss, oldMachine, "2020-01-01", installDateOnly) : 0;
      const shotsOnOld = Math.max(0, oldMachineShots - oldInstallShot);
      const newCarried = oldCarried + shotsOnOld;
      // คำนวณจำนวนวันที่ใช้บนเครื่องเก่า แล้ว carry ไปยังรายการใหม่
      const daysOnOld = (oldInstallDateStr && installDateOnly)
        ? Math.max(0, daysBetween(oldInstallDateStr, installDateOnly))
        : 0;
      const newCarriedDays = oldCarriedDays + daysOnOld;

      const newId = "INS-" + Utilities.formatDate(now, "GMT+7", "yyMMdd") + "-" + Math.random().toString(36).substr(2, 4).toUpperCase();
      // คำนวณ Install_Shot ของเครื่องใหม่ ณ วันที่ติดตั้ง (shot สะสมถึงวันนั้น)
      const newInstallShot = calcMachineShots(ss, d.Machine, "2020-01-01", installDateOnly);
      // Next_Check_Shot = shot สะสมตัวอะไหล่ ณ ปัจจุบัน + interval
      const newNextCheckShot = (checkInterval > 0) ? (newCarried + checkInterval) : 0;
      // appendRow ตาม header order (re-read headers เผื่อเพิ่ม columns ใหม่)
      const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const rowData = newHeaders.map(function(h) {
        switch(h) {
          case "Install_ID": return newId;
          case "Machine": return d.Machine;
          case "Part_ID": return d.Part_ID;
          case "Part_Name": return d.Part_Name || "";
          case "Install_Date": return installDateFull;
          case "Install_Shot": return newInstallShot;
          case "Life_Shots": return parseInt(d.Life_Shots) || 0;
          case "Status": return "Active";
          case "Maint_Job_ID": return d.Maint_Job_ID || "";
          case "Recorder": return d.Recorder || "";
          case "Replaced_Date": return "";
          case "Carried_Shots": return newCarried;
          case "Carried_Days": return newCarriedDays;
          case "Check_Interval_Shots": return checkInterval;
          case "Next_Check_Shot": return newNextCheckShot;
          case "Last_Check_Date": return "";
          case "Check_Count": return 0;
          default: return "";
        }
      });
      sheet.appendRow(rowData);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Replaced", installId: newId, carriedShots: newCarried, carriedDays: newCarriedDays, installShot: newInstallShot, checkInterval: checkInterval, nextCheckShot: newNextCheckShot})).setMimeType(ContentService.MimeType.JSON);
    } else {
      // ติดตั้งอะไหล่ใหม่ (Carried_Shots = 0, Carried_Days = 0)
      const newId = "INS-" + Utilities.formatDate(now, "GMT+7", "yyMMdd") + "-" + Math.random().toString(36).substr(2, 4).toUpperCase();
      const hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      // คำนวณ Install_Shot ณ วันที่ติดตั้ง (shot สะสมถึงวันนั้น)
      const newInstallShot = calcMachineShots(ss, d.Machine, "2020-01-01", installDateOnly);
      const newNextCheckShot = (checkInterval > 0) ? checkInterval : 0;
      const rowData = hdr.map(function(h) {
        switch(h) {
          case "Install_ID": return newId;
          case "Machine": return d.Machine;
          case "Part_ID": return d.Part_ID;
          case "Part_Name": return d.Part_Name || "";
          case "Install_Date": return installDateFull;
          case "Install_Shot": return newInstallShot;
          case "Life_Shots": return parseInt(d.Life_Shots) || 0;
          case "Status": return "Active";
          case "Maint_Job_ID": return d.Maint_Job_ID || "";
          case "Recorder": return d.Recorder || "";
          case "Replaced_Date": return "";
          case "Carried_Shots": return 0;
          case "Carried_Days": return 0;
          case "Check_Interval_Shots": return checkInterval;
          case "Next_Check_Shot": return newNextCheckShot;
          case "Last_Check_Date": return "";
          case "Check_Count": return 0;
          default: return "";
        }
      });
      sheet.appendRow(rowData);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Installed", installId: newId, installShot: newInstallShot, checkInterval: checkInterval, nextCheckShot: newNextCheckShot})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "GET_MACHINE_SHOTS") {
    const machine = data.machine;
    const sinceDate = data.sinceDate || "2020-01-01";
    const totalShots = calcMachineShots(ss, machine, sinceDate);
    return ContentService.createTextOutput(JSON.stringify({status: "success", machine: machine, totalShots: totalShots})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "UPDATE_PARTS_LIFE") {
    // ปรับอายุการใช้งาน (Life_Shots) — sync ทั้ง Parts_Installation + Parts_Master
    let sheet = ss.getSheetByName("Parts_Installation");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Sheet not found"})).setMimeType(ContentService.MimeType.JSON);
    const newLife = parseInt(data.lifeShots) || 0;
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => String(h).trim());
    const colIdx = (name) => headers.indexOf(name);
    let targetPartId = "";
    let targetRowFound = false;
    // 1) หา row ที่ Install_ID ตรง → เก็บ Part_ID + อัพเดต Life_Shots
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colIdx("Install_ID")]).trim() === data.installId) {
        sheet.getRange(i + 1, colIdx("Life_Shots") + 1).setValue(newLife);
        targetPartId = String(rows[i][colIdx("Part_ID")] || "").trim();
        targetRowFound = true;
        break;
      }
    }
    if (!targetRowFound) {
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Install_ID not found"})).setMimeType(ContentService.MimeType.JSON);
    }
    // 2) Sync: อัพเดต Active installation อื่นของ Part_ID เดียวกัน (กรณีมีหลายตัว)
    if (targetPartId) {
      const statusIdx = colIdx("Status");
      const partIdIdx = colIdx("Part_ID");
      const lifeIdx = colIdx("Life_Shots");
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][partIdIdx] || "").trim() === targetPartId
            && String(rows[i][statusIdx] || "").trim() === "Active"
            && String(rows[i][colIdx("Install_ID")]).trim() !== data.installId) {
          sheet.getRange(i + 1, lifeIdx + 1).setValue(newLife);
        }
      }
      // 3) Sync: อัพเดต Parts_Master.Life_Shots ของ Part_ID นั้นด้วย
      const masterSheet = ss.getSheetByName("Parts_Master");
      if (masterSheet) {
        const mRows = masterSheet.getDataRange().getValues();
        const mHdr = mRows[0].map(h => String(h).trim());
        const mPidIdx = mHdr.indexOf("Part_ID");
        const mLifeIdx = mHdr.indexOf("Life_Shots");
        if (mPidIdx !== -1 && mLifeIdx !== -1) {
          for (let i = 1; i < mRows.length; i++) {
            if (String(mRows[i][mPidIdx] || "").trim() === targetPartId) {
              masterSheet.getRange(i + 1, mLifeIdx + 1).setValue(newLife);
              break;
            }
          }
        }
      }
    }
    SpreadsheetApp.flush();
    return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Life updated", partId: targetPartId, lifeShots: newLife})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_PARTS_CHECK") {
    // บันทึกการตรวจเช็คอะไหล่ + upload รูป + อัพเดต Parts_Installation
    let sheet = ss.getSheetByName("Parts_Checks");
    if (!sheet) {
      sheet = ss.insertSheet("Parts_Checks");
      sheet.appendRow(["Check_ID", "Install_ID", "Part_ID", "Part_Name", "Machine", "Check_Date", "Machine_Shot", "Actual_Part_Shot", "Result", "Note", "Photo_URLs", "Next_Check_Shot", "Recorder"]);
    }
    ensureColumns(sheet, ["Check_ID", "Install_ID", "Part_ID", "Part_Name", "Machine", "Check_Date", "Machine_Shot", "Actual_Part_Shot", "Result", "Note", "Photo_URLs", "Next_Check_Shot", "Recorder"]);

    const c = data.check || {};
    const now = new Date();
    let checkDate = String(c.Check_Date || "").trim();
    if (!checkDate) checkDate = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd HH:mm");

    // 1) Upload รูปทีละไฟล์ (รับ array ของ base64)
    const urls = [];
    if (Array.isArray(data.photos)) {
      for (let idx = 0; idx < data.photos.length; idx++) {
        const b64 = data.photos[idx];
        if (!b64) continue;
        const fname = "CHK_" + (c.Install_ID || "NA") + "_" + Utilities.formatDate(now, "GMT+7", "yyMMdd_HHmmss") + "_" + (idx + 1) + ".jpg";
        const url = saveCheckImageToDrive(b64, fname);
        if (url) urls.push(url);
      }
    }

    // 2) Append row ใน Parts_Checks
    const checkId = "CHK-" + Utilities.formatDate(now, "GMT+7", "yyMMdd") + "-" + Math.random().toString(36).substr(2, 4).toUpperCase();
    const hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const rowData = hdr.map(function(h) {
      switch(h) {
        case "Check_ID": return checkId;
        case "Install_ID": return c.Install_ID || "";
        case "Part_ID": return c.Part_ID || "";
        case "Part_Name": return c.Part_Name || "";
        case "Machine": return c.Machine || "";
        case "Check_Date": return checkDate;
        case "Machine_Shot": return parseInt(c.Machine_Shot) || 0;
        case "Actual_Part_Shot": return parseInt(c.Actual_Part_Shot) || 0;
        case "Result": return c.Result || "Passed";
        case "Note": return c.Note || "";
        case "Photo_URLs": return urls.join(",");
        case "Next_Check_Shot": return parseInt(c.Next_Check_Shot) || 0;
        case "Recorder": return c.Recorder || "";
        default: return "";
      }
    });
    sheet.appendRow(rowData);

    // 3) อัพเดต Parts_Installation: Next_Check_Shot, Last_Check_Date, Check_Count
    const instSheet = ss.getSheetByName("Parts_Installation");
    if (instSheet && c.Install_ID) {
      ensureColumns(instSheet, ["Check_Interval_Shots", "Next_Check_Shot", "Last_Check_Date", "Check_Count"]);
      const iRows = instSheet.getDataRange().getValues();
      const iHdr = iRows[0].map(h => String(h).trim());
      const iIdIdx = iHdr.indexOf("Install_ID");
      const iNextIdx = iHdr.indexOf("Next_Check_Shot");
      const iLastIdx = iHdr.indexOf("Last_Check_Date");
      const iCountIdx = iHdr.indexOf("Check_Count");
      for (let i = 1; i < iRows.length; i++) {
        if (String(iRows[i][iIdIdx] || "").trim() === c.Install_ID) {
          if (iNextIdx !== -1) instSheet.getRange(i + 1, iNextIdx + 1).setValue(parseInt(c.Next_Check_Shot) || 0);
          if (iLastIdx !== -1) instSheet.getRange(i + 1, iLastIdx + 1).setValue(checkDate.substring(0, 10));
          if (iCountIdx !== -1) instSheet.getRange(i + 1, iCountIdx + 1).setValue((parseInt(iRows[i][iCountIdx]) || 0) + 1);
          break;
        }
      }
    }
    SpreadsheetApp.flush();
    return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Check saved", checkId: checkId, photoUrls: urls})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "GET_PARTS_CHECKS") {
    const sheet = ss.getSheetByName("Parts_Checks");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return ContentService.createTextOutput(JSON.stringify({status: "success", data: []})).setMimeType(ContentService.MimeType.JSON);
    const headers = rows[0].map(h => String(h).trim());
    const filterInstall = data.installId || "";
    const filterPartId = data.partId || "";
    const filterMachine = data.machine || "";
    const results = [];
    for (let i = 1; i < rows.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = rows[i][idx] !== undefined ? rows[i][idx] : ""; });
      if (!obj.Check_ID) continue;
      if (filterPartId) {
        if (obj.Part_ID !== filterPartId) continue;
      } else if (filterInstall) {
        if (obj.Install_ID !== filterInstall) continue;
      }
      if (filterMachine && obj.Machine !== filterMachine) continue;
      results.push(obj);
    }
    // Sort by Check_Date desc
    results.sort(function(a, b) { return String(b.Check_Date).localeCompare(String(a.Check_Date)); });
    return ContentService.createTextOutput(JSON.stringify({status: "success", data: results})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_RTV") {
    let sheet = ss.getSheetByName("RTV_Data");
    if (!sheet) {
        sheet = ss.insertSheet("RTV_Data");
        sheet.appendRow(["Timestamp", "Date", "Product", "Qty", "Remark", "Recorder", "Customer_Ref"]);
    }

    // เพิ่มคอลัมน์ Customer_Ref ถ้ายังไม่มี
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headers.some(h => h.toString().trim() === "Customer_Ref")) {
        sheet.getRange(1, headers.length + 1).setValue("Customer_Ref");
    }

    const now = new Date();
    sheet.appendRow([
        now.toLocaleString('th-TH'),
        data.date,
        data.product,
        data.qty,
        data.remark,
        data.recorder,
        data.customerRef || ""
    ]);
    
    SpreadsheetApp.flush();
    logUserAction(data.recorder, "System", "SAVE_RTV", `รับเคลม ${data.product} จำนวน ${data.qty} ชิ้น`);
    return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Saved RTV"})).setMimeType(ContentService.MimeType.JSON);
  }

  // --- ระบบงานรอ Sort (บันทึก / แก้ไข / อัปเดตสถานะ QC) ---
  if (action === "SAVE_SORTING") {
      const lock = LockService.getScriptLock();
      try {
          lock.waitLock(10000);
          let sheet = ss.getSheetByName("Sorting_Data");
          if (!sheet) {
              sheet = ss.insertSheet("Sorting_Data");
              // จัดเรียงหัวคอลัมน์ให้ครบ 14 คอลัมน์ (มี Sorter เป็นคนที่ 2 และ Closed_By เป็น QC)
              sheet.appendRow(["Timestamp", "Job_ID", "Date", "Product", "Symptom", "Qty", "Remark", "Recorder", "Status", "Closed_By", "Closed_Date", "FG_Qty", "NG_Qty", "Sorter"]);
          }

          const now = new Date();
          const sortData = data.data;
          let finalDate = sortData.date;
          if (typeof finalDate === 'string' && finalDate.match(/\d{2}:\d{2}:\d{2}/)) finalDate = finalDate.substring(0, finalDate.lastIndexOf(':'));
          const newJobId = "SRT-" + Utilities.formatDate(now, "GMT+7", "yyMMdd") + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();

          // 1. ผู้แจ้ง (Recorder) - เติมช่องให้ครบ 14 ช่องเพื่อป้องกันข้อมูลเหลื่อม
          sheet.appendRow([now.toLocaleString('th-TH'), newJobId, finalDate, sortData.product, sortData.symptom, sortData.qty, sortData.remark, sortData.recorder, "Pending", "", "", "", "", ""]);
          SpreadsheetApp.flush();
          logUserAction(sortData.recorder, "System", "SAVE_SORTING", `บันทึกงานรอ Sort ${sortData.product}`);
          return ContentService.createTextOutput(JSON.stringify({status: "success", message: "บันทึกสำเร็จ", jobId: newJobId})).setMimeType(ContentService.MimeType.JSON);
      } catch (err) { 
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON); 
      } finally { 
          lock.releaseLock(); 
      }
  }

  if (action === "EDIT_SORTING") {
      const lock = LockService.getScriptLock();
      try {
          lock.waitLock(10000);
          let sheet = ss.getSheetByName("Sorting_Data");
          const rows = sheet.getDataRange().getValues();
          const headers = rows[0];
          
          const getCol = (name) => headers.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
          
          let jobCol = getCol("Job_ID");
          let dateCol = getCol("Date") + 1;
          let prodCol = getCol("Product") + 1;
          let sympCol = getCol("Symptom") + 1;
          let qtyCol = getCol("Qty") + 1;
          let remCol = getCol("Remark") + 1;
          
          let foundRow = -1;
          for (let i = 1; i < rows.length; i++) { 
              if (rows[i][jobCol] === data.jobId) { foundRow = i + 1; break; } 
          }

          if (foundRow > -1) {
              const sortData = data.data;
              sheet.getRange(foundRow, dateCol).setValue(sortData.date);
              sheet.getRange(foundRow, prodCol).setValue(sortData.product);
              sheet.getRange(foundRow, sympCol).setValue(sortData.symptom);
              sheet.getRange(foundRow, qtyCol).setValue(sortData.qty);
              sheet.getRange(foundRow, remCol).setValue(sortData.remark);
              SpreadsheetApp.flush();
              return ContentService.createTextOutput(JSON.stringify({status: "success", message: "แก้ไขข้อมูลสำเร็จ"})).setMimeType(ContentService.MimeType.JSON);
          } else { 
              return ContentService.createTextOutput(JSON.stringify({status: "error", message: "ไม่พบรหัสงานนี้"})).setMimeType(ContentService.MimeType.JSON); 
          }
      } catch (err) { 
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON); 
      } finally { 
          lock.releaseLock(); 
      }
  }

  if (action === "UPDATE_SORTING") {
      const lock = LockService.getScriptLock();
      try {
          lock.waitLock(10000);
          let sheet = ss.getSheetByName("Sorting_Data");
          const rows = sheet.getDataRange().getValues();
          let headers = rows[0]; 
          
          const getCol = (name) => headers.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
          
          let fgColIdx = getCol("FG_Qty");
          if (fgColIdx === -1) { fgColIdx = headers.length; sheet.getRange(1, fgColIdx + 1).setValue("FG_Qty"); headers.push("FG_Qty"); }
          
          let ngColIdx = getCol("NG_Qty");
          if (ngColIdx === -1) { ngColIdx = headers.length; sheet.getRange(1, ngColIdx + 1).setValue("NG_Qty"); headers.push("NG_Qty"); }

          let closedByColIdx = getCol("Closed_By");
          if (closedByColIdx === -1) { closedByColIdx = headers.length; sheet.getRange(1, closedByColIdx + 1).setValue("Closed_By"); headers.push("Closed_By"); }

          let closedDateColIdx = getCol("Closed_Date");
          if (closedDateColIdx === -1) { closedDateColIdx = headers.length; sheet.getRange(1, closedDateColIdx + 1).setValue("Closed_Date"); headers.push("Closed_Date"); }

          let sorterColIdx = getCol("Sorter");
          if (sorterColIdx === -1) { sorterColIdx = headers.length; sheet.getRange(1, sorterColIdx + 1).setValue("Sorter"); headers.push("Sorter"); }

          let rejectTargetColIdx = getCol("Reject_Target");
          if (rejectTargetColIdx === -1) { rejectTargetColIdx = headers.length; sheet.getRange(1, rejectTargetColIdx + 1).setValue("Reject_Target"); headers.push("Reject_Target"); }

          let qcFgApprovedColIdx = getCol("QC_FG_Approved");
          if (qcFgApprovedColIdx === -1) { qcFgApprovedColIdx = headers.length; sheet.getRange(1, qcFgApprovedColIdx + 1).setValue("QC_FG_Approved"); headers.push("QC_FG_Approved"); }

          let qcNgApprovedColIdx = getCol("QC_NG_Approved");
          if (qcNgApprovedColIdx === -1) { qcNgApprovedColIdx = headers.length; sheet.getRange(1, qcNgApprovedColIdx + 1).setValue("QC_NG_Approved"); headers.push("QC_NG_Approved"); }

          let jobCol = getCol("Job_ID");
          let statCol = getCol("Status") + 1;
          let remCol = getCol("Remark") + 1;
          
          // บวก 1 เนื่องจาก getRange ของ Apps Script เริ่มนับที่คอลัมน์ 1 ไม่ใช่ 0
          let fgCol = fgColIdx + 1;
          let ngCol = ngColIdx + 1;
          let closedByCol = closedByColIdx + 1;
          let closedDateCol = closedDateColIdx + 1;
          let sorterCol = sorterColIdx + 1;
          let rejectTargetCol = rejectTargetColIdx + 1;
          let qcFgApprovedCol = qcFgApprovedColIdx + 1;
          let qcNgApprovedCol = qcNgApprovedColIdx + 1;

          let foundRow = -1;
          for (let i = 1; i < rows.length; i++) { 
              if (rows[i][jobCol] === data.jobId) { foundRow = i + 1; break; } 
          }

          if (foundRow > -1) {
              const now = new Date();

              // === ป้องกันบันทึกซ้ำ: ถ้า status ปัจจุบันเป็น Completed และไม่ได้ถูก Recall กลับมา ===
              const currentStatus = String(rows[foundRow - 1][getCol("Status")] || "").trim();
              if (data.status === "Completed" && currentStatus === "Completed") {
                  return ContentService.createTextOutput(JSON.stringify({status: "success", message: "งานนี้ถูกอนุมัติไปแล้ว"})).setMimeType(ContentService.MimeType.JSON);
              }
              // ป้องกัน Reject ซ้ำ: ถ้า status ปัจจุบันเป็น Rejected อยู่แล้ว ไม่ต้องทำซ้ำ
              if (data.status === "Rejected" && currentStatus === "Rejected") {
                  return ContentService.createTextOutput(JSON.stringify({status: "success", message: "งานนี้ถูกตีกลับไปแล้ว"})).setMimeType(ContentService.MimeType.JSON);
              }

              // === Batch write: รวมการเขียนหลาย cell เป็นครั้งเดียว ลด API calls ===
              const cellUpdates = []; // เก็บ {row, col, value} แล้วเขียนรวมทีเดียว
              const queueWrite = (row, col, value) => cellUpdates.push({row, col, value});

              const isPartialApprove = !!data.partialApprove;
              const approveTargets = Array.isArray(data.approveTargets) ? data.approveTargets : [];
              let finalStatus = data.status;

              if (data.status === "Wait QC") {
                  if (isPartialApprove) {
                      // QC อนุมัติบางส่วน: งานยังคงอยู่ Wait QC
                      const oldFgApproved = String(rows[foundRow - 1][qcFgApprovedColIdx] || "").toUpperCase() === "TRUE";
                      const oldNgApproved = String(rows[foundRow - 1][qcNgApprovedColIdx] || "").toUpperCase() === "TRUE";
                      const newFgApproved = oldFgApproved || approveTargets.indexOf("FG") > -1;
                      const newNgApproved = oldNgApproved || approveTargets.indexOf("NG") > -1;

                      queueWrite(foundRow, qcFgApprovedCol, newFgApproved);
                      queueWrite(foundRow, qcNgApprovedCol, newNgApproved);
                      queueWrite(foundRow, closedByCol, data.closedBy || "");
                      queueWrite(foundRow, closedDateCol, now.toLocaleString('th-TH'));
                      queueWrite(foundRow, rejectTargetCol, "");

                      // ถ้าอนุมัติครบทั้ง FG และ NG แล้ว ให้ปิดงานทันที
                      if (newFgApproved && newNgApproved) {
                          finalStatus = "Completed";
                      } else {
                          finalStatus = "Wait QC";
                          queueWrite(foundRow, statCol, finalStatus);
                          cellUpdates.forEach(u => sheet.getRange(u.row, u.col).setValue(u.value));
                          SpreadsheetApp.flush();
                          logUserAction(data.closedBy, "System", "QC_PARTIAL_APPROVE", `QC อนุมัติบางส่วนงาน: ${data.jobId} (${approveTargets.join(",")})`);
                      }
                  } else {
                      // 2. ผู้คัด (Sorter) คัดเสร็จ ส่งยอดให้ QC
                      queueWrite(foundRow, statCol, "Wait QC");
                      if (data.fgQty) queueWrite(foundRow, fgCol, data.fgQty);
                      if (data.ngQty) queueWrite(foundRow, ngCol, data.ngQty);
                      queueWrite(foundRow, sorterCol, data.closedBy);
                      queueWrite(foundRow, closedDateCol, now.toLocaleString('th-TH'));
                      queueWrite(foundRow, rejectTargetCol, "");
                      queueWrite(foundRow, qcFgApprovedCol, false);
                      queueWrite(foundRow, qcNgApprovedCol, false);

                      // Batch write ทั้งหมดในครั้งเดียว
                      cellUpdates.forEach(u => sheet.getRange(u.row, u.col).setValue(u.value));
                      SpreadsheetApp.flush();
                      logUserAction(data.closedBy, "System", "SUBMIT_QC", `ส่งงาน ${data.jobId} ให้ QC ตรวจ`);
                  }
              }
              if (finalStatus === "Completed") {
                  // 3. QC อนุมัติผ่าน (เก็บชื่อ QC ลงคอลัมน์ Closed_By)
                  queueWrite(foundRow, statCol, "Completed");
                  queueWrite(foundRow, closedByCol, data.closedBy);
                  queueWrite(foundRow, closedDateCol, now.toLocaleString('th-TH'));
                  queueWrite(foundRow, qcFgApprovedCol, true);
                  queueWrite(foundRow, qcNgApprovedCol, true);

                  // Batch write Sorting_Data ก่อน — ให้ QC เห็นผลทันที
                  cellUpdates.forEach(u => sheet.getRange(u.row, u.col).setValue(u.value));
                  SpreadsheetApp.flush();

                  logUserAction(data.closedBy, "System", "QC_APPROVE", `QC อนุมัติงาน: ${data.jobId}`);

                  // === เพิ่ม NG หลัง Sort เข้า Production_Data เป็น row ใหม่ (ทำหลัง flush เพื่อไม่บล็อก QC) ===
                  try {
                      const sortRow = rows[foundRow - 1];
                      const productStr = String(sortRow[getCol("Product")] || "");
                      const symptom = String(sortRow[getCol("Symptom")] || "");
                      const ngQtyRaw = String(sortRow[getCol("NG_Qty")] || "");
                      const fgQtyRaw = String(sortRow[getCol("FG_Qty")] || "");
                      const sortDateRaw = sortRow[getCol("Date")];
                      const recorder = String(sortRow[getCol("Sorter")] || sortRow[getCol("Recorder")] || "");
                      const remarkStr = String(sortRow[getCol("Remark")] || "");

                      // แยก Machine และ Product จาก "CWM-01 : S1B29288-JR (10A)"
                      const pParts = productStr.split(" : ");
                      const sortMachine = pParts[0] ? pParts[0].trim() : "-";
                      const sortProduct = pParts[1] ? pParts[1].trim() : productStr.trim();

                      // แปลง NG_Qty เป็น kg
                      let ngKg = 0;
                      const ngVal = parseFloat(ngQtyRaw) || 0;
                      if (ngVal > 0) {
                          if (String(ngQtyRaw).includes("ชิ้น")) {
                              let wpp = 0.003;
                              if (sortProduct.includes("10A")) wpp = 0.00228;
                              else if (sortProduct.includes("16A")) wpp = 0.00279;
                              else if (sortProduct.includes("20A")) wpp = 0.00357;
                              else if (sortProduct.includes("25/32A")) wpp = 0.005335;
                              ngKg = ngVal * wpp;
                          } else {
                              ngKg = ngVal;
                          }
                      }

                      // แปลง FG_Qty เป็นชิ้น (สำหรับ FG ใน Production_Data)
                      // ถ้าพบที่ FG หรือ RTV → NG มาจากของที่เคยนับเป็น FG แล้ว → ต้องหัก FG ออกเท่ากับ NG ที่พบ
                      let fgPcs = 0;
                      const isFoundAtFGorRTV = /พบที่:\s*(FG|RTV)/i.test(remarkStr);
                      if (isFoundAtFGorRTV) {
                          // หัก FG ออก = จำนวน NG (ชิ้น) ที่พบจาก FG เดิม
                          fgPcs = -getPcsFromKg(sortProduct, ngKg);
                      } else {
                          const fgVal = parseFloat(fgQtyRaw) || 0;
                          if (fgVal > 0) {
                              if (String(fgQtyRaw).includes("kg")) {
                                  fgPcs = getPcsFromKg(sortProduct, fgVal);
                              } else {
                                  fgPcs = Math.round(fgVal);
                              }
                          }
                      }

                      // === แปลงวันที่จาก Sorting_Data (ตัดวัน 08:00) ===
                      let dateStr = "";
                      let hourNum = 0;
                      if (sortDateRaw instanceof Date && !isNaN(sortDateRaw.getTime())) {
                          hourNum = parseInt(Utilities.formatDate(sortDateRaw, "GMT+7", "HH")) || 0;
                          // ตัดวัน 08:00 — ก่อน 08:00 นับเป็นวันก่อนหน้า
                          let shiftD = new Date(sortDateRaw.getTime());
                          if (hourNum < 8) shiftD.setDate(shiftD.getDate() - 1);
                          dateStr = Utilities.formatDate(shiftD, "GMT+7", "yyyy-MM-dd");
                      } else if (sortDateRaw) {
                          const dateParts = String(sortDateRaw).split(" ");
                          dateStr = dateParts[0] || Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
                          const rawTime = dateParts[1] || "";
                          hourNum = parseInt(rawTime.split(":")[0]) || 0;
                          // ตัดวัน 08:00
                          if (hourNum < 8 && rawTime) {
                              const tmpD = new Date(dateStr + "T00:00:00");
                              tmpD.setDate(tmpD.getDate() - 1);
                              dateStr = tmpD.getFullYear() + "-" + String(tmpD.getMonth() + 1).padStart(2, '0') + "-" + String(tmpD.getDate()).padStart(2, '0');
                          }
                      } else {
                          dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
                      }
                      const shiftType = (hourNum >= 8 && hourNum < 20) ? "Day" : "Night";

                      const hStart = String(hourNum).padStart(2, '0') + ":00";
                      const nextHour = (hourNum + 1) % 24;
                      const hEnd = String(nextHour).padStart(2, '0') + ":00";
                      const hourSlot = hStart + "-" + hEnd;

                      // === ค้นหา Shift (A/B) — รวมเป็นลูปเดียว แทนที่จะวน 2 รอบ ===
                      let matchedShift = "-";
                      let fallbackShift = "-";
                      try {
                          let prodSheet = ss.getSheetByName("Production_Data");
                          if (prodSheet && prodSheet.getLastRow() > 1) {
                              const prodRows = prodSheet.getDataRange().getValues();
                              const prodHeaders = prodRows[0].map(h => h.toString().trim().toLowerCase());
                              const pDateIdx = prodHeaders.indexOf("date");
                              const pMachIdx = prodHeaders.indexOf("machine");
                              const pShiftIdx = prodHeaders.indexOf("shift");
                              const pHourIdx = prodHeaders.indexOf("hour");
                              const baseMachine = sortMachine.replace(/\([AB]\)$/, "").trim();

                              const formatProdDate = (val) => {
                                  if (val instanceof Date && !isNaN(val.getTime())) {
                                      return Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
                                  }
                                  return String(val || "").trim();
                              };

                              if (pDateIdx !== -1 && pMachIdx !== -1 && pShiftIdx !== -1) {
                                  // ลูปเดียว: หาทั้ง exact match (Machine+Date+Hour) และ fallback (Machine+Date)
                                  for (let p = prodRows.length - 1; p >= 1; p--) {
                                      const pDate = formatProdDate(prodRows[p][pDateIdx]);
                                      const pMach = String(prodRows[p][pMachIdx] || "").trim();
                                      const pShift = String(prodRows[p][pShiftIdx] || "").trim();
                                      if (pDate === dateStr && pMach === baseMachine && (pShift === "A" || pShift === "B")) {
                                          // เก็บ fallback ไว้เผื่อ exact match ไม่เจอ
                                          if (fallbackShift === "-") fallbackShift = pShift;
                                          if (pHourIdx !== -1) {
                                              const pHour = String(prodRows[p][pHourIdx] || "").trim();
                                              const hParts = pHour.split("-");
                                              if (hParts.length === 2) {
                                                  const rangeStart = parseInt(hParts[0].split(":")[0]) || 0;
                                                  const rangeEnd = parseInt(hParts[1].split(":")[0]) || 0;
                                                  if (hourNum >= rangeStart && hourNum < rangeEnd) {
                                                      matchedShift = pShift;
                                                      break;
                                                  }
                                              } else {
                                                  matchedShift = pShift;
                                                  break;
                                              }
                                          } else {
                                              matchedShift = pShift;
                                              break;
                                          }
                                      }
                                  }
                                  // ใช้ fallback ถ้า exact match ไม่เจอ
                                  if (matchedShift === "-") matchedShift = fallbackShift;
                              }

                              // === เขียน/อัปเดต Production_Data — รองรับ Recall ===
                              syncHeaders(prodSheet);
                              const freshHeaders = prodSheet.getRange(1, 1, 1, prodSheet.getLastColumn()).getValues()[0];
                              const getProdCol = (name) => freshHeaders.findIndex(h => h.toString().trim().toLowerCase() === name.toLowerCase());
                              const batchId = "SORT-" + data.jobId;

                              // ค้นหาแถวเดิมที่มี Batch_ID ตรงกัน (กรณี recall)
                              const batchIdx = getProdCol("Batch_ID");
                              let existingProdRow = -1;
                              if (batchIdx !== -1) {
                                  const prodAllData = prodSheet.getDataRange().getValues();
                                  for (let p = prodAllData.length - 1; p >= 1; p--) {
                                      if (String(prodAllData[p][batchIdx] || "").trim() === batchId) {
                                          existingProdRow = p + 1;
                                          break;
                                      }
                                  }
                              }

                              if (ngKg > 0) {
                                  const ngDetails = [{ type: symptom, qty: parseFloat(ngKg.toFixed(4)), unit: "kg" }];

                                  if (existingProdRow > 0) {
                                      // === Recall: อัปเดตแถวเดิมแทนการ append ===
                                      const updateCell = (colName, value) => {
                                          const idx = getProdCol(colName);
                                          if (idx !== -1) prodSheet.getRange(existingProdRow, idx + 1).setValue(value);
                                      };
                                      updateCell("Timestamp", now.toLocaleString('th-TH'));
                                      updateCell("Date", dateStr);
                                      updateCell("Machine", sortMachine);
                                      updateCell("Shift", matchedShift);
                                      updateCell("Recorder", recorder);
                                      updateCell("Product", sortProduct);
                                      updateCell("Hour", hourSlot);
                                      updateCell("FG", fgPcs);
                                      updateCell("NG_Total", parseFloat(ngKg.toFixed(4)));
                                      updateCell("NG_Details_JSON", JSON.stringify(ngDetails));
                                      updateCell("Shift_Type", shiftType);
                                  } else {
                                      // === งานปกติ: append แถวใหม่ ===
                                      const newRow = new Array(freshHeaders.length).fill("");
                                      const mapData = (colName, value) => { const idx = getProdCol(colName); if (idx !== -1) newRow[idx] = value; };

                                      mapData("Timestamp", now.toLocaleString('th-TH'));
                                      mapData("Date", dateStr);
                                      mapData("Machine", sortMachine);
                                      mapData("Shift", matchedShift);
                                      mapData("Recorder", recorder);
                                      mapData("Product", sortProduct);
                                      mapData("Hour", hourSlot);
                                      mapData("FG", fgPcs);
                                      mapData("NG_Total", parseFloat(ngKg.toFixed(4)));
                                      mapData("NG_Details_JSON", JSON.stringify(ngDetails));
                                      mapData("Shift_Type", shiftType);
                                      mapData("Batch_ID", batchId);

                                      prodSheet.appendRow(newRow);
                                  }
                              } else if (existingProdRow > 0) {
                                  // Recall แล้วคัดใหม่ได้ NG = 0 → ลบแถวเดิมออกจาก Production_Data
                                  prodSheet.deleteRow(existingProdRow);
                              }
                          }
                      } catch (lookupErr) {
                          console.error("Error looking up shift from Production_Data: " + lookupErr.toString());
                      }
                  } catch (sortErr) {
                      console.error("Error writing sorting NG to Production_Data: " + sortErr.toString());
                  }
              }
              else if (data.status === "Rejected") {
                  // 3. QC ตีกลับ
                  queueWrite(foundRow, statCol, data.status);
                  queueWrite(foundRow, qcFgApprovedCol, false);
                  queueWrite(foundRow, qcNgApprovedCol, false);
                  let oldRemark = sheet.getRange(foundRow, remCol).getValue();
                  let rejectNote = `[QC ${data.closedBy} ตีกลับ ${data.rejectTarget}: ${data.rejectReason}]`;
                  queueWrite(foundRow, remCol, `${rejectNote} | ${oldRemark}`);
                  queueWrite(foundRow, rejectTargetCol, data.rejectTarget || "");

                  cellUpdates.forEach(u => sheet.getRange(u.row, u.col).setValue(u.value));
                  SpreadsheetApp.flush();

                  logUserAction(data.closedBy, "System", "QC_REJECT", `QC ตีกลับงาน: ${data.jobId} (${data.rejectTarget})`);
              }
              return ContentService.createTextOutput(JSON.stringify({status: "success", message: "อัปเดตสถานะสำเร็จ"})).setMimeType(ContentService.MimeType.JSON);
          } else {
              return ContentService.createTextOutput(JSON.stringify({status: "error", message: "ไม่พบรหัสงานนี้"})).setMimeType(ContentService.MimeType.JSON);
          }
      } catch (err) {
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
      } finally {
          lock.releaseLock();
      }
  }

  // --- ระบบ Recall งาน Sort ที่ QC อนุมัติแล้ว กลับมาแก้ไข/อนุมัติใหม่ ---
  if (action === "RECALL_SORTING") {
      const lock = LockService.getScriptLock();
      try {
          lock.waitLock(10000);
          let sheet = ss.getSheetByName("Sorting_Data");
          if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "error", message: "ไม่พบ Sheet Sorting_Data"})).setMimeType(ContentService.MimeType.JSON);

          const rows = sheet.getDataRange().getValues();
          const headers = rows[0];
          const getCol = (name) => headers.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());

          let jobCol = getCol("Job_ID");
          let statCol = getCol("Status") + 1;
          let closedByCol = getCol("Closed_By") + 1;
          let closedDateCol = getCol("Closed_Date") + 1;
          let remCol = getCol("Remark") + 1;

          let foundRow = -1;
          for (let i = 1; i < rows.length; i++) {
              if (rows[i][jobCol] === data.jobId) { foundRow = i + 1; break; }
          }

          if (foundRow === -1) {
              return ContentService.createTextOutput(JSON.stringify({status: "error", message: "ไม่พบรหัสงานนี้"})).setMimeType(ContentService.MimeType.JSON);
          }

          const currentStatus = String(rows[foundRow - 1][getCol("Status")] || "").trim();
          if (currentStatus !== "Completed") {
              return ContentService.createTextOutput(JSON.stringify({status: "error", message: "งานนี้ยังไม่ได้อนุมัติ ไม่สามารถ Recall ได้"})).setMimeType(ContentService.MimeType.JSON);
          }

          // 1. เปลี่ยนสถานะกลับเป็น Wait QC
          sheet.getRange(foundRow, statCol).setValue("Wait QC");
          // 2. ล้าง Closed_By (QC) แต่เก็บ Sorter ไว้
          if (closedByCol > 0) sheet.getRange(foundRow, closedByCol).setValue("");
          // 3. ล้าง Closed_Date
          if (closedDateCol > 0) sheet.getRange(foundRow, closedDateCol).setValue("");
          // 4. เพิ่ม Remark ว่า Recall โดยใคร
          let oldRemark = sheet.getRange(foundRow, remCol).getValue();
          const now = new Date();
          let recallNote = `[Recall โดย ${data.recalledBy} เมื่อ ${Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy HH:mm")}${data.reason ? ': ' + data.reason : ''}]`;
          sheet.getRange(foundRow, remCol).setValue(recallNote + " | " + oldRemark);

          SpreadsheetApp.flush();

          // 5. ลบ row NG ที่เขียนเข้า Production_Data ตอนอนุมัติ (Batch_ID = "SORT-" + jobId)
          try {
              let prodSheet = ss.getSheetByName("Production_Data");
              if (prodSheet && prodSheet.getLastRow() > 1) {
                  const prodRows = prodSheet.getDataRange().getValues();
                  const prodHeaders = prodRows[0];
                  const batchIdx = prodHeaders.findIndex(h => String(h).trim().toLowerCase() === "batch_id");
                  if (batchIdx !== -1) {
                      // ลบจากล่างขึ้นบนเพื่อไม่ให้ index เลื่อน
                      for (let p = prodRows.length - 1; p >= 1; p--) {
                          if (String(prodRows[p][batchIdx]).trim() === "SORT-" + data.jobId) {
                              prodSheet.deleteRow(p + 1);
                          }
                      }
                      SpreadsheetApp.flush();
                  }
              }
          } catch (prodErr) {
              console.error("Recall: ลบ Production_Data row error: " + prodErr.toString());
          }

          logUserAction(data.recalledBy, data.role || "QC", "RECALL_SORTING", `Recall งาน ${data.jobId}${data.reason ? ' เหตุผล: ' + data.reason : ''}`);
          return ContentService.createTextOutput(JSON.stringify({status: "success", message: `Recall งาน ${data.jobId} สำเร็จ กลับสู่สถานะ Wait QC`})).setMimeType(ContentService.MimeType.JSON);

      } catch (err) {
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
      } finally {
          lock.releaseLock();
      }
  }

  // --- ส่วนที่ 2.6: ระบบ Packing ลงพาเลท ---
  if (action === "SAVE_PACKING") {
      const lock = LockService.getScriptLock();
      try {
          lock.waitLock(10000);
          
          let sheet = ss.getSheetByName("Packing_Data");
          if (!sheet) {
              sheet = ss.insertSheet("Packing_Data");
              sheet.appendRow(["Timestamp", "Date", "Pallet_No", "Category", "Machine", "Product", "Qty", "Recorder"]);
          }

          const now = new Date();
          const timestamp = now.toLocaleString('th-TH');
          const packData = data.data; 
          
          const items = packData.items || [];
          
          items.forEach(item => {
              sheet.appendRow([
                  timestamp,
                  packData.date,
                  packData.palletNo,
                  packData.category,
                  item.machine,
                  item.product,
                  item.qty,
                  packData.recorder
              ]);
          });
          
          SpreadsheetApp.flush();
          logUserAction(packData.recorder, "System", "SAVE_PACKING", `บันทึกข้อมูล Packing พาเลท ${packData.palletNo} จำนวน ${items.length} รายการ`);
          
          return ContentService.createTextOutput(JSON.stringify({status: "success", message: "บันทึกข้อมูล Packing สำเร็จ!"})).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
      } finally {
          lock.releaseLock();
      }
  }

  // --- ส่วนที่ 3: ระบบบันทึกข้อมูลการผลิต (Production) ---
  if (action === 'SAVE_PRODUCTION' || action === 'SAVE_BATCH_PRODUCTION') {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);

        let sheet = ss.getSheetByName("Production_Data") || ss.insertSheet("Production_Data");
        syncHeaders(sheet);
        
        const now = new Date();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const getColIndex = (name) => headers.findIndex(h => h.toString().trim().toLowerCase() === name.toLowerCase());
        
        const items = data.items || [data];
        const common = data.common || data;

        items.forEach(item => {
             const newRow = new Array(headers.length).fill("");
             const mapData = (colName, value) => { const idx = getColIndex(colName); if (idx !== -1) newRow[idx] = value; };
             
             const machine = item.machine || common.machine || "-";
             const product = item.productCode || common.productCode || "-";
             const fg = parseInt(item.fgAmount || common.fgAmount) || 0;
             const ngDetails = item.ngDetails || common.ngDetails || [];
             
             mapData("Timestamp", common.timestamp || now.toLocaleString('th-TH'));
             mapData("Date", common.productionDate || Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd"));
             mapData("Machine", machine);
             mapData("Shift", common.shift || "A");
             mapData("Recorder", common.recorder || "-");
             mapData("Product", product);
             mapData("Hour", common.hourSlot || "-");
             mapData("FG", fg);
             
             const totalNgKg = ngDetails.reduce((sum, d) => sum + (parseFloat(d.qty) || 0), 0);
             mapData("NG_Total", totalNgKg);
             mapData("NG_Details_JSON", JSON.stringify(ngDetails));
             mapData("Shift_Type", common.shiftType || "Day");
             mapData("Batch_ID", common.batchId || "-");

             sheet.appendRow(newRow);
        });

        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Saved"})).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
      } finally {
        lock.releaseLock();
      }
  }

  else if (action === 'UNDO_BATCH_PRODUCTION') {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
        let sheet = ss.getSheetByName("Production_Data");
        if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Sheet not found"})).setMimeType(ContentService.MimeType.JSON);

        const rows = sheet.getDataRange().getValues();
        if (rows.length <= 1) return ContentService.createTextOutput(JSON.stringify({status: "error", message: "No data to delete"})).setMimeType(ContentService.MimeType.JSON);

        const headers = rows[0].map(h => h.toString().trim());
        const batchIdCol = headers.indexOf('Batch_ID');

        if (batchIdCol !== -1) {
            let deletedCount = 0;
            for (let i = rows.length - 1; i > 0; i--) {
                if (rows[i][batchIdCol] === data.batchId) {
                    sheet.deleteRow(i + 1); 
                    deletedCount++;
                }
            }
            if (deletedCount > 0) {
                SpreadsheetApp.flush();
                return ContentService.createTextOutput(JSON.stringify({status: "success", message: `Deleted ${deletedCount} rows`})).setMimeType(ContentService.MimeType.JSON);
            } else {
                return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Batch ID not found"})).setMimeType(ContentService.MimeType.JSON);
            }
        } else {
            return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Batch_ID column missing"})).setMimeType(ContentService.MimeType.JSON);
        }
      } catch(err) {
        return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
      } finally {
        lock.releaseLock();
      }
  }

  else if (action === 'SAVE_PLAN') {
    let sheet = ss.getSheetByName("Plan_Data");
    if (!sheet) {
      sheet = ss.insertSheet("Plan_Data");
      sheet.appendRow(["Date", "Product", "Target_Qty", "Shift", "Timestamp"]);
    }
    sheet.appendRow([
      data.planDate,          
      data.product,           
      parseInt(data.qty) || 0,
      data.shift || "All",    
      new Date().toLocaleString('th-TH') 
    ]);
    SpreadsheetApp.flush();
    return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Plan Saved"})).setMimeType(ContentService.MimeType.JSON);
  }

  else if (action === 'SAVE_ASSIGNMENT') {
      let logSheet = ss.getSheetByName("Machine_Assignment_Log");
      if (!logSheet) {
          logSheet = ss.insertSheet("Machine_Assignment_Log");
          logSheet.appendRow(["Timestamp", "Recorder", "Machine", "Product"]);
      }
      
      let configSheet = ss.getSheetByName("Config");
      if (!configSheet) {
          configSheet = ss.insertSheet("Config");
          configSheet.appendRow(["Key", "Value"]);
      }
      
      const configData = configSheet.getDataRange().getValues();
      
      if (data.logs && Array.isArray(data.logs)) {
          data.logs.forEach(log => {
              logSheet.appendRow([data.timestamp, data.recorder, log.machine, log.product]);
              const keyName = "Machine_" + log.machine;
              let found = false;
              for(let i = 1; i < configData.length; i++) {
                 if(configData[i][0] === keyName) {
                    configSheet.getRange(i + 1, 2).setValue(log.product === "Unassigned" ? "" : log.product);
                    found = true; 
                    break;
                 }
              }
              if(!found && log.product !== "Unassigned") {
                 configSheet.appendRow([keyName, log.product]);
                 configData.push([keyName, log.product]); 
              }
          });
          SpreadsheetApp.flush();
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Assignment Saved"})).setMimeType(ContentService.MimeType.JSON);
  }

  else if (action === 'SAVE_NG_SYMPTOMS' || action === 'SAVE_RECORDERS' || action === 'SAVE_HIDDEN_WIDGETS') {
     let configSheet = ss.getSheetByName("Config");
     if (!configSheet) {
       configSheet = ss.insertSheet("Config");
       configSheet.appendRow(["Key", "Value"]);
     }

     let keyName = "";
     if (action === 'SAVE_NG_SYMPTOMS') keyName = 'MASTER_NG_SYMPTOMS';
     else if (action === 'SAVE_RECORDERS') keyName = 'MASTER_RECORDERS';
     else if (action === 'SAVE_HIDDEN_WIDGETS') keyName = 'MASTER_HIDDEN_WIDGETS';

     const valueStr = JSON.stringify(data.data);

     const configData = configSheet.getDataRange().getValues();
     let found = false;
     for (let i = 1; i < configData.length; i++) {
       if (configData[i][0] === keyName) {
         configSheet.getRange(i + 1, 2).setValue(valueStr);
         found = true;
         break;
       }
     }
     if (!found) {
       configSheet.appendRow([keyName, valueStr]);
     }
     SpreadsheetApp.flush();

     return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Cloud settings updated" })).setMimeType(ContentService.MimeType.JSON);
  }

  // 🌟 บันทึกผลนับ Stock 🌟
  if (action === "SAVE_STOCK_COUNT") {
    const items = data.items || [];
    if (items.length === 0) return ContentService.createTextOutput(JSON.stringify({status: "error", message: "No items"})).setMimeType(ContentService.MimeType.JSON);

    let scSheet = ss.getSheetByName("Stock_Count");
    if (!scSheet) {
      scSheet = ss.insertSheet("Stock_Count");
      scSheet.appendRow(["Count_ID", "Timestamp", "Source", "Ref_ID", "Product", "Symptom", "Expected_Qty", "Actual_Qty", "Diff", "Status", "Pallet", "Counter", "Remark"]);
    }

    const now = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    const countId = data.countId || ("SC-" + Utilities.formatDate(new Date(), "GMT+7", "yyMMdd") + "-" + Math.random().toString(36).substring(2, 6).toUpperCase());

    const newRows = items.map(item => [
      countId,
      now,
      item.source || "",
      item.refId || "",
      item.product || "",
      item.symptom || "",
      item.expectedQty || "",
      item.actualQty || "",
      item.diff || "",
      item.status || "",
      item.pallet || "",
      item.counter || "",
      item.remark || ""
    ]);

    if (newRows.length > 0) {
      scSheet.getRange(scSheet.getLastRow() + 1, 1, newRows.length, 13).setValues(newRows);
      SpreadsheetApp.flush();
    }

    return ContentService.createTextOutput(JSON.stringify({status: "success", countId: countId, saved: newRows.length})).setMimeType(ContentService.MimeType.JSON);
  }

  // === 📬 Inbox: รวบรวมงานค้างจากหลาย sheet ส่งให้ frontend แสดงแบบ Email ===
  if (action === "GET_INBOX") {
    const role = data.role || "";
    const userName = data.userName || "";
    const todayISO = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const result = { maintenance: [], partsCheck: [], partsNearEnd: [], sortingWaitQC: [] };

    // 1) งานซ่อมค้าง (Maintenance_Data: End_Time ว่าง)
    try {
      const mSheet = ss.getSheetByName("Maintenance_Data");
      if (mSheet && mSheet.getLastRow() > 1) {
        const mRows = mSheet.getDataRange().getValues();
        const mH = mRows[0].map(h => String(h).trim());
        const mi = (n) => mH.indexOf(n);
        for (let i = 1; i < mRows.length; i++) {
          const endTime = String(mRows[i][mi("End_Time")] || "").trim();
          if (endTime && endTime !== "-") continue;
          const dateRaw = mRows[i][mi("Date")];
          let dateStr = "";
          if (dateRaw instanceof Date) dateStr = Utilities.formatDate(dateRaw, "GMT+7", "yyyy-MM-dd");
          else dateStr = String(dateRaw || "").trim().substring(0, 10);
          const daysAgo = dateStr ? daysBetween(dateStr, todayISO) : 0;
          result.maintenance.push({
            jobId: String(mRows[i][mi("Job_ID")] || ""),
            machine: String(mRows[i][mi("Machine")] || ""),
            issueType: String(mRows[i][mi("Issue_Type")] || ""),
            remark: String(mRows[i][mi("Remark")] || ""),
            recorder: String(mRows[i][mi("Recorder")] || ""),
            date: dateStr,
            startTime: String(mRows[i][mi("Start_Time")] || ""),
            daysAgo: daysAgo
          });
        }
      }
    } catch (e) { console.error("Inbox maint err: " + e); }

    // 2) อะไหล่ถึงรอบเช็ค + ใกล้หมดอายุ (Parts_Installation: Active only)
    try {
      const pSheet = ss.getSheetByName("Parts_Installation");
      if (pSheet && pSheet.getLastRow() > 1) {
        const pRows = pSheet.getDataRange().getValues();
        const pH = pRows[0].map(h => String(h).trim());
        const pi = (n) => pH.indexOf(n);
        const activeMachines = [];
        const activeRows = [];
        for (let i = 1; i < pRows.length; i++) {
          if (String(pRows[i][pi("Status")] || "").trim() !== "Active") continue;
          const mac = String(pRows[i][pi("Machine")] || "").trim();
          if (mac && activeMachines.indexOf(mac) === -1) activeMachines.push(mac);
          activeRows.push(pRows[i]);
        }
        const macShots = activeMachines.length > 0 ? calcMultiMachineShots(ss, activeMachines) : {};
        activeRows.forEach(r => {
          const mac = String(r[pi("Machine")] || "").trim();
          const installShot = parseInt(r[pi("Install_Shot")]) || 0;
          const carried = parseInt(r[pi("Carried_Shots")]) || 0;
          const lifeShots = parseInt(r[pi("Life_Shots")]) || 0;
          const machineShot = macShots[mac] || 0;
          const actualShots = carried + Math.max(0, machineShot - installShot);
          const nextCheck = parseInt(r[pi("Next_Check_Shot")]) || 0;
          const checkCount = parseInt(r[pi("Check_Count")]) || 0;
          const effectiveLife = lifeShots * (checkCount + 1);
          const pct = effectiveLife > 0 ? (actualShots / effectiveLife) * 100 : 0;
          const autoNextCheck = lifeShots > 0 ? lifeShots * (checkCount + 1) : 0;
          const item = {
            installId: String(r[pi("Install_ID")] || ""),
            machine: mac,
            partId: String(r[pi("Part_ID")] || ""),
            partName: String(r[pi("Part_Name")] || ""),
            actualShots: actualShots,
            lifeShots: lifeShots,
            effectiveLife: effectiveLife,
            pct: Math.round(pct * 10) / 10,
            nextCheckShot: autoNextCheck,
            checkCount: checkCount
          };
          if (autoNextCheck > 0 && actualShots >= autoNextCheck) {
            result.partsCheck.push(item);
          } else if (lifeShots > 0 && pct >= 90) {
            result.partsNearEnd.push(item);
          }
        });
      }
    } catch (e) { console.error("Inbox parts err: " + e); }

    // 3) งาน Sort รอ QC (Sorting_Data: status = "Wait QC")
    if (role === "QC" || role === "Admin") {
      try {
        const sSheet = ss.getSheetByName("Sorting_Data");
        if (sSheet && sSheet.getLastRow() > 1) {
          const sRows = sSheet.getDataRange().getValues();
          const sH = sRows[0].map(h => String(h).trim());
          const si = (n) => sH.indexOf(n);
          for (let i = 1; i < sRows.length; i++) {
            if (String(sRows[i][si("Status")] || "").trim() !== "Wait QC") continue;
            let product = String(sRows[i][si("Product")] || "").trim();
            if (product.includes(" : ")) product = product.split(" : ").slice(1).join(" : ").trim();
            result.sortingWaitQC.push({
              jobId: String(sRows[i][si("Job_ID")] || ""),
              product: product,
              symptom: String(sRows[i][si("Symptom")] || ""),
              qty: String(sRows[i][si("Qty")] || ""),
              sorter: String(sRows[i][si("Sorter")] || ""),
              fgQty: String(sRows[i][si("FG_Qty")] || ""),
              ngQty: String(sRows[i][si("NG_Qty")] || "")
            });
          }
        }
      } catch (e) { console.error("Inbox sort err: " + e); }
    }

    const counts = {
      maintenance: result.maintenance.length,
      partsCheck: result.partsCheck.length,
      partsNearEnd: result.partsNearEnd.length,
      sortingWaitQC: result.sortingWaitQC.length,
      total: result.maintenance.length + result.partsCheck.length + result.partsNearEnd.length + result.sortingWaitQC.length
    };
    return ContentService.createTextOutput(JSON.stringify({ status: "success", categories: result, counts: counts })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Unknown Action"})).setMimeType(ContentService.MimeType.JSON);
}

// ==================================================
// 🌟 ส่วนที่ 4: ฟังก์ชันช่วยเหลือ (Helper Functions)
// ==================================================

function logUserAction(username, role, actionType, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName("Logs");
    if (!logSheet) {
      logSheet = ss.insertSheet("Logs");
      logSheet.appendRow(["Timestamp", "Username", "Role", "Action", "Details"]);
    }
    const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    logSheet.appendRow([timestamp, username, role, actionType, details]);
  } catch(e) { 
    console.error("Log error: " + e); 
  }
}

function syncHeaders(sheet) {
  if (sheet.getLastRow() === 0) { sheet.appendRow(REQUIRED_COLUMNS); return; }
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim());
  const missingHeaders = REQUIRED_COLUMNS.filter(h => !currentHeaders.includes(h));
  if (missingHeaders.length > 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function getWeightPerPc(productName) {
    if (!productName) return 0.003;
    if (productName.includes("10A")) return 0.00228;
    if (productName.includes("16A")) return 0.00279;
    if (productName.includes("20A")) return 0.00357;
    if (productName.includes("25/32A")) return 0.005335;
    return 0.003;
}

function getPcsFromKg(productName, kg) {
    if (!kg || kg <= 0) return 0;
    return Math.round(kg / getWeightPerPc(productName));
}

// คำนวณจำนวนวันระหว่างวันที่ 2 ตัว (inclusive, format "yyyy-MM-dd")
function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  try {
    var s = new Date(startStr + "T00:00:00+07:00");
    var e = new Date(endStr + "T00:00:00+07:00");
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    var diffMs = e.getTime() - s.getTime();
    return Math.max(0, Math.round(diffMs / 86400000));
  } catch (err) {
    return 0;
  }
}

// คำนวณ Shot สะสมของเครื่อง (FG + NG pcs) ตั้งแต่วันที่ระบุ
// sinceDate / upToDate: "yyyy-MM-dd" (inclusive ทั้งคู่)
function calcMachineShots(ss, machine, sinceDate, upToDate) {
  sinceDate = sinceDate || "2020-01-01";
  upToDate = upToDate || "";
  let totalShots = 0;
  const prodSheet = ss.getSheetByName("Production_Data");
  if (!prodSheet || prodSheet.getLastRow() <= 1) return 0;
  const pRows = prodSheet.getDataRange().getValues();
  const pH = pRows[0].map(function(h) { return String(h).trim().toLowerCase(); });
  const pDateIdx = pH.indexOf("date");
  const pMachIdx = pH.indexOf("machine");
  const pFgIdx = pH.indexOf("fg");
  const pNgIdx = pH.indexOf("ng_total");
  const pProdIdx = pH.indexOf("product");
  if (pDateIdx === -1 || pMachIdx === -1 || pFgIdx === -1) return 0;
  for (var i = 1; i < pRows.length; i++) {
    var pMach = String(pRows[i][pMachIdx] || "").trim();
    if (pMach !== machine) continue;
    var pDateRaw = pRows[i][pDateIdx];
    var pDateStr = "";
    if (pDateRaw instanceof Date && !isNaN(pDateRaw.getTime())) {
      pDateStr = Utilities.formatDate(pDateRaw, "GMT+7", "yyyy-MM-dd");
    } else {
      pDateStr = String(pDateRaw || "").trim().substring(0, 10);
    }
    if (pDateStr < sinceDate) continue;
    if (upToDate && pDateStr > upToDate) continue;
    var fg = parseInt(pRows[i][pFgIdx]) || 0;
    var ngKg = parseFloat(pRows[i][pNgIdx]) || 0;
    var prod = String(pRows[i][pProdIdx] || "");
    var ngPcs = getPcsFromKg(prod, ngKg);
    totalShots += (fg + ngPcs);
  }
  return totalShots;
}

// คำนวณ Shot สะสมของหลายเครื่องพร้อมกัน (อ่าน Production_Data ครั้งเดียว)
function calcMultiMachineShots(ss, machineList) {
  var result = {};
  machineList.forEach(function(m) { result[m] = 0; });
  var prodSheet = ss.getSheetByName("Production_Data");
  if (!prodSheet || prodSheet.getLastRow() <= 1) return result;
  var pRows = prodSheet.getDataRange().getValues();
  var pH = pRows[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var pMachIdx = pH.indexOf("machine");
  var pFgIdx = pH.indexOf("fg");
  var pNgIdx = pH.indexOf("ng_total");
  var pProdIdx = pH.indexOf("product");
  if (pMachIdx === -1 || pFgIdx === -1) return result;
  for (var i = 1; i < pRows.length; i++) {
    var mac = String(pRows[i][pMachIdx] || "").trim();
    if (result[mac] === undefined) continue;
    var fg = parseInt(pRows[i][pFgIdx]) || 0;
    var ngKg = parseFloat(pRows[i][pNgIdx]) || 0;
    var prod = String(pRows[i][pProdIdx] || "");
    var ngPcs = getPcsFromKg(prod, ngKg);
    result[mac] += (fg + ngPcs);
  }
  return result;
}

function getUniqueOptionsFromHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Production_Data");
  const configSheet = ss.getSheetByName("Config");
  
  const recorders = new Set();
  const ngTypes = new Set();
  const machineMapping = {};
  let hiddenWidgets = [];
  
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    for (let i = 1; i < configData.length; i++) {
      const key = String(configData[i][0]).trim();
      const val = String(configData[i][1]).trim();
      
      if (key.startsWith("Machine_")) {
          const machineName = key.replace("Machine_", "");
          if (val !== "" && val !== "Unassigned") {
              machineMapping[machineName] = val;
          }
      } 
      else if (key === "MASTER_NG_SYMPTOMS" && val !== "") {
         try {
           JSON.parse(val).forEach(item => {
             const symptom = normalizeNgSymptomName(item);
             if (symptom) ngTypes.add(symptom);
           });
         } catch(e) {}
      } 
      else if (key === "MASTER_RECORDERS" && val !== "") {
         try { JSON.parse(val).forEach(item => recorders.add(item)); } catch(e) {}
      }
      else if (key === "MASTER_HIDDEN_WIDGETS" && val !== "") {
         try { hiddenWidgets = JSON.parse(val); } catch(e) {}
      }
    }
  }

  if (sheet) {
      const data = sheet.getDataRange().getValues();
      if (data.length > 1) {
          const headers = data[0].map(h => h.toString().toLowerCase().trim());
          const idxRec = headers.indexOf("recorder");
          const idxJson = headers.indexOf("ng_details_json");
          
          const start = Math.max(1, data.length - 500);
          for (let i = start; i < data.length; i++) {
             if(idxRec !== -1 && data[i][idxRec]) recorders.add(String(data[i][idxRec]).trim());
             if(idxJson !== -1 && data[i][idxJson]) {
                try {
                  JSON.parse(data[i][idxJson]).forEach(d => {
                    const symptom = normalizeNgSymptomName(d.type);
                    if (symptom) ngTypes.add(symptom);
                  });
                } catch(e){}
             }
          }
      }
  }
  ngTypes.add("Setup");
  
  return { 
      recorders: Array.from(recorders).sort(), 
      ngTypes: Array.from(ngTypes).sort(), 
      machineMapping: machineMapping,
      hiddenWidgets: hiddenWidgets 
  };
}

function getProductionTarget(startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let planSheet = ss.getSheetByName("Plan_Data");
  if (!planSheet) return { total: 0, byProduct: {} };
  
  const data = planSheet.getDataRange().getValues();
  if (data.length <= 1) return { total: 0, byProduct: {} };
  
  let totalTarget = 0;
  let byProduct = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let rowDate = row[0];
    let rowDateStr = (rowDate instanceof Date) ? Utilities.formatDate(rowDate, "GMT+7", "yyyy-MM-dd") : String(rowDate).trim().substring(0, 10);
    
    if (rowDateStr >= startDate && rowDateStr <= endDate) {
       let target = parseInt(row[1]); 
       let product = "All";
       
       if (isNaN(target)) { 
           product = String(row[1]).trim();
           target = parseInt(row[2]) || 0;
       } else {
           target = target || 0;
       }

       totalTarget += target;
       if (!byProduct[product]) byProduct[product] = 0;
       byProduct[product] += target;
    }
  }
  return { total: totalTarget, byProduct: byProduct };
}

// 🌟 สร้าง Dashboard 🌟
function getAdvancedDashboardData(reqStart, reqEnd, reqShift, reqType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Production_Data");
  
  const today = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  const startDate = reqStart || today;
  const endDate = reqEnd || today;
  
  const filterShift = (reqShift || "All").trim();
  const filterType = (reqType || "All").trim();

  const DAY_HOURS = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "OT 17:30-18:00", "OT 18:00-19:00", "OT 19:00-20:00"];
  const NIGHT_HOURS = ["20:00-21:00", "21:00-22:00", "22:00-23:00", "23:00-00:00", "00:00-01:00", "01:00-02:00", "02:00-03:00", "03:00-04:00", "04:00-05:00", "OT 05:00-06:30", "OT 06:00-07:30", "OT 07:00-08:00"];
  
  let displayLabels = (filterType === "Day") ? DAY_HOURS : (filterType === "Night" ? NIGHT_HOURS : [...DAY_HOURS, ...NIGHT_HOURS]);

  const planData = getProductionTarget(startDate, endDate);

  const result = {
    productionTarget: planData.total,
    productionPlanByModel: planData.byProduct,
    totalFg: 0,
    totalFgKg: 0,
    totalNgPcs: 0, 
    totalNgKg: 0,
    hourlyLabels: displayLabels,
    hourlyData: Array(displayLabels.length).fill(0),
    hourlyNgPcsData: Array(displayLabels.length).fill(0),
    hourlyByModel: {}, 
    ngLabels: [], ngValuesPcs: [], ngValuesKg: [],
    machineData: {}, productData: {}, dailyTrend: [],
    maintenanceLogs: [], 
    rtvLogs: []          
  };

  // --- อ่านข้อมูลแจ้งซ่อม (Maintenance) ---
  const maintSheet = ss.getSheetByName("Maintenance_Data");
  if (maintSheet) {
    const maintData = maintSheet.getDataRange().getValues();
    if (maintData.length > 1) {
      const mHeaders = maintData[0];
      const mCol = {};
      mHeaders.forEach((name, idx) => mCol[name.toString().trim().toLowerCase()] = idx);

      for (let i = 1; i < maintData.length; i++) {
        const mRow = maintData[i];
        const rawDate = mRow[mCol["date"]];
        if (!rawDate) continue;
        let mDateStr = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "GMT+7", "yyyy-MM-dd") : String(rawDate).trim().substring(0, 10);

        if (mDateStr >= startDate && mDateStr <= endDate) {
          const mac = String(mRow[mCol["machine"]] || "").trim();
          
          // ดึงข้อมูลสร้าง Log Object
          const logObj = {
            jobId: mRow[mCol["job_id"]],
            date: mDateStr,
            machine: mac,
            issueType: mRow[mCol["issue_type"]],
            startTime: mRow[mCol["start_time"]],
            endTime: mRow[mCol["end_time"]],
            remark: mRow[mCol["remark"]],
            imageUrl: mRow[mCol["image_url"]],
            recorder: mRow[mCol["recorder"]]
          };

          result.maintenanceLogs.push(logObj);

          if (!result.machineData[mac]) {
              result.machineData[mac] = {
                  fg: 0, ngTotalPcs: 0, ngTotalKg: 0,
                  ngBreakdownPcs: {}, ngBreakdownKg: {}, remarks: [],
                  hourlyFg: Array(displayLabels.length).fill(0),
                  hourlyNgPcs: Array(displayLabels.length).fill(0),
                  hourlyNgBreakdown: Array(displayLabels.length).fill(null).map(() => ({})), 
                  daily: {}, maintenanceLogs: []
              };
          }
          if (!result.machineData[mac].maintenanceLogs) result.machineData[mac].maintenanceLogs = [];
          result.machineData[mac].maintenanceLogs.push(logObj);
        }
      }
    }
  }

  // --- อ่านข้อมูลเคลม RTV ---
  const rtvSheet = ss.getSheetByName("RTV_Data");
  if (rtvSheet) {
    const rtvData = rtvSheet.getDataRange().getValues();
    if (rtvData.length > 1) {
      const rHeaders = rtvData[0];
      const rCol = {};
      rHeaders.forEach((name, idx) => rCol[name.toString().trim().toLowerCase()] = idx);

      for (let i = 1; i < rtvData.length; i++) {
        const rRow = rtvData[i];
        const rawDate = rRow[rCol["date"]];
        if (!rawDate) continue;
        let rDateStr = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "GMT+7", "yyyy-MM-dd") : String(rawDate).trim().substring(0, 10);

        if (rDateStr >= startDate && rDateStr <= endDate) {
           result.rtvLogs.push({
             date: rDateStr,
             product: rRow[rCol["product"]],
             qty: rRow[rCol["qty"]],
             remark: rRow[rCol["remark"]],
             recorder: rRow[rCol["recorder"]],
             customerRef: rCol["customer_ref"] !== undefined ? (rRow[rCol["customer_ref"]] || "") : ""
           });
        }
      }
    }
  }

  if (!sheet) return result;
  const dataRange = sheet.getDataRange().getValues();
  if (dataRange.length <= 1) return result; 
  
  const headers = dataRange[0];
  const rows = dataRange.slice(1);
  const col = {};
  headers.forEach((name, index) => { col[name.toString().trim().toLowerCase()] = index; });
  const getVal = (row, colName) => { const idx = col[colName.toLowerCase()]; return (idx !== undefined) ? row[idx] : undefined; };

  const ngTempMapPcs = {};
  const ngTempMapKg = {};
  const dailyStats = {};

  rows.forEach(row => {
    try {
      const rowDateRaw = getVal(row, "Date");
      if (!rowDateRaw) return;
      
      let rowDateStr = (rowDateRaw instanceof Date) ? Utilities.formatDate(rowDateRaw, "GMT+7", "yyyy-MM-dd") : String(rowDateRaw).trim().substring(0, 10);
      
      if (rowDateStr >= startDate && rowDateStr <= endDate) {
        const shiftName = String(getVal(row, "Shift") || "A").trim();
        let shiftType = String(getVal(row, "Shift_Type") || "Day").trim();
        if (shiftType === "Morning") shiftType = "Day"; 

        if (filterShift !== "All" && shiftName !== filterShift) return;
        if (filterType !== "All" && shiftType !== filterType) return;

        const machine = String(getVal(row, "Machine") || "Unknown").trim();
        const product = String(getVal(row, "Product") || "Unknown").trim();
        const hour = String(getVal(row, "Hour") || "-").trim();
        
        const fg = parseInt(getVal(row, "FG")) || 0;
        const ngKg = parseFloat(getVal(row, "NG_Total")) || 0;
        const ngPcs = getPcsFromKg(product, ngKg);
        
        let details = []; try { const j = getVal(row, "NG_Details_JSON"); if(j) details = JSON.parse(j); } catch (e) {}

        result.totalFg += fg;
        result.totalFgKg += fg * getWeightPerPc(product);
        result.totalNgKg += ngKg;
        result.totalNgPcs += ngPcs;

        if (!dailyStats[rowDateStr]) dailyStats[rowDateStr] = { fg: 0, ng: 0, ngBreakdown: {} };
        dailyStats[rowDateStr].fg += fg;
        dailyStats[rowDateStr].ng += ngPcs;

        const hIdx = displayLabels.indexOf(hour);
        if (hIdx !== -1) {
           result.hourlyData[hIdx] += fg;
           result.hourlyNgPcsData[hIdx] += ngPcs;
           
           if (!result.hourlyByModel[product]) {
               result.hourlyByModel[product] = { fg: Array(displayLabels.length).fill(0), ng: Array(displayLabels.length).fill(0) };
           }
           result.hourlyByModel[product].fg[hIdx] += fg;
           result.hourlyByModel[product].ng[hIdx] += ngPcs;
        }

        if (!result.machineData[machine]) {
          result.machineData[machine] = { 
            fg: 0, ngTotalPcs: 0, ngTotalKg: 0, 
            ngBreakdownPcs: {}, ngBreakdownKg: {}, remarks: [],
            hourlyFg: Array(displayLabels.length).fill(0), 
            hourlyNgPcs: Array(displayLabels.length).fill(0),
            hourlyNgBreakdown: Array(displayLabels.length).fill(null).map(() => ({})), 
            daily: {}, maintenanceLogs: [] 
          };
        }
        
        result.machineData[machine].fg += fg;
        result.machineData[machine].ngTotalKg += ngKg;
        result.machineData[machine].ngTotalPcs += ngPcs;
        
        if (hIdx !== -1) {
            result.machineData[machine].hourlyFg[hIdx] += fg;
            result.machineData[machine].hourlyNgPcs[hIdx] += ngPcs;
        }

        if (!result.machineData[machine].daily[rowDateStr]) {
            result.machineData[machine].daily[rowDateStr] = { fg: 0, ngPcs: 0, ngBreakdown: {} };
        }
        result.machineData[machine].daily[rowDateStr].fg += fg;
        result.machineData[machine].daily[rowDateStr].ngPcs += ngPcs;

        if (!result.productData[product]) result.productData[product] = { fg: 0, ngTotalPcs: 0, ngBreakdownPcs: {} };
        result.productData[product].fg += fg;
        result.productData[product].ngTotalPcs += ngPcs;

        details.forEach(item => {
          if (item.type) {
            const itemKg = parseFloat(item.qty) || 0;
            const itemPcs = getPcsFromKg(product, itemKg);
            const typeTrimmed = capitalizeFirst(item.type);
            
            ngTempMapKg[typeTrimmed] = (ngTempMapKg[typeTrimmed] || 0) + itemKg;
            ngTempMapPcs[typeTrimmed] = (ngTempMapPcs[typeTrimmed] || 0) + itemPcs;
            
            result.machineData[machine].ngBreakdownKg[typeTrimmed] = (result.machineData[machine].ngBreakdownKg[typeTrimmed] || 0) + itemKg;
            result.machineData[machine].ngBreakdownPcs[typeTrimmed] = (result.machineData[machine].ngBreakdownPcs[typeTrimmed] || 0) + itemPcs;
            
            if (hIdx !== -1) {
                result.machineData[machine].hourlyNgBreakdown[hIdx][typeTrimmed] = 
                    (result.machineData[machine].hourlyNgBreakdown[hIdx][typeTrimmed] || 0) + itemPcs;
            }

            result.machineData[machine].daily[rowDateStr].ngBreakdown[typeTrimmed] = (result.machineData[machine].daily[rowDateStr].ngBreakdown[typeTrimmed] || 0) + itemPcs;
            result.productData[product].ngBreakdownPcs[typeTrimmed] = (result.productData[product].ngBreakdownPcs[typeTrimmed] || 0) + itemPcs;
            dailyStats[rowDateStr].ngBreakdown[typeTrimmed] = (dailyStats[rowDateStr].ngBreakdown[typeTrimmed] || 0) + itemPcs;
            
            if (item.remark) result.machineData[machine].remarks.push(`[${typeTrimmed}] ${item.remark}`);
          }
        });
      }
    } catch (e) { console.log("Row error: " + e); }
  });

  result.ngLabels = Object.keys(ngTempMapPcs);
  result.ngValuesPcs = Object.values(ngTempMapPcs);
  result.ngValuesKg = result.ngLabels.map(label => ngTempMapKg[label]);

  // === อ่านยอดงานรอ Sorting (Pending/Rejected) + ผลการ Sort จริง (Completed/Wait QC) แยกตามวันที่ ===
// === อ่านยอดงานรอ Sorting และผล Sort จริง พร้อมคำนวณค่าน้ำหนักอาการ (Dynamic Weights) ===
 // === อ่านยอดงานรอ Sorting และผล Sort จริง พร้อมคำนวณค่าน้ำหนักอาการ (Dynamic Weights) ===
  const pendingSortByDate = {};
  const sortResultByDate = {};   // เก็บผล sort จริง: { fgPcs, ngPcs }
  const sortResultByMachine = {}; // แยกตามเครื่อง+วัน
  const sortYieldBySymptom = {};  // อัตรา sort แยกตามอาการ: symptom → { fgPcs, ngPcs }
  const pendingByDateSymptom = {}; // pending แยกตามวัน+อาการ: date → [ { symptom, pcs } ]
  let globalSortFg = 0, globalSortNg = 0;

  const symptomRawStats = {}; // เก็บค่าดิบของงานคัดแยกตามอาการ
  const dynamicSymptomWeights = {}; // เก็บ % การได้ FG ของแต่ละอาการ

  try {
    const sortSheet = ss.getSheetByName("Sorting_Data");
    if (sortSheet && sortSheet.getLastRow() > 1) {
      const sortData = sortSheet.getDataRange().getValues();
      const sHeaders = sortData[0];
      const sCol = {};
      sHeaders.forEach((name, idx) => sCol[name.toString().trim().toLowerCase()] = idx);

      for (let i = 1; i < sortData.length; i++) {
        const sRow = sortData[i];
        const sStatus = String(sRow[sCol["status"]] || "").trim();
        if (!sStatus) continue;

        const sDateRaw = sRow[sCol["date"]];
        if (!sDateRaw) continue;
        let sDateStr = "";
        if (sDateRaw instanceof Date && !isNaN(sDateRaw.getTime())) {
          // ตัดวัน 08:00 — ก่อน 08:00 นับเป็นวันก่อนหน้า
          let shiftDate = new Date(sDateRaw.getTime());
          let hourCheck = parseInt(Utilities.formatDate(shiftDate, "GMT+7", "HH")) || 0;
          if (hourCheck < 8) {
            shiftDate.setDate(shiftDate.getDate() - 1);
          }
          let yyyy = parseInt(Utilities.formatDate(shiftDate, "GMT+7", "yyyy"));
          if (yyyy > 2500) yyyy -= 543;
          sDateStr = yyyy + "-" + Utilities.formatDate(shiftDate, "GMT+7", "MM") + "-" + Utilities.formatDate(shiftDate, "GMT+7", "dd");
        } else {
          // string format: "2026-04-06 02:30" or "2026-04-06"
          const sDateParts = String(sDateRaw).trim().split(" ");
          sDateStr = sDateParts[0].substring(0, 10);
          // ถ้ามี time component → ตัดวัน 08:00
          if (sDateParts[1]) {
            const sHour = parseInt(sDateParts[1].split(":")[0]) || 0;
            if (sHour < 8) {
              const tmpDate = new Date(sDateStr + "T00:00:00");
              tmpDate.setDate(tmpDate.getDate() - 1);
              sDateStr = tmpDate.getFullYear() + "-" + String(tmpDate.getMonth() + 1).padStart(2, '0') + "-" + String(tmpDate.getDate()).padStart(2, '0');
            }
          }
        }

        if (sDateStr < startDate || sDateStr > endDate) continue;

        const sQtyRaw = String(sRow[sCol["qty"]] || "").trim();
        const sProduct = String(sRow[sCol["product"]] || "").trim();
        const sSymptom = String(sRow[sCol["symptom"]] || "").trim();
        const pParts = sProduct.split(" : ");
        const machineName = pParts[0] ? pParts[0].trim() : "";
        const prodName = pParts[1] ? pParts[1].trim() : sProduct;

        // 🌟 งาน Pending/Rejected → ยอดรอ sort
        if (sStatus === "Pending" || sStatus === "Rejected") {
          const numVal = parseFloat(sQtyRaw) || 0;
          let pcs = 0;
          if (numVal > 0) {
            if (sQtyRaw.toLowerCase().includes("kg")) {
              pcs = getPcsFromKg(prodName, numVal);
            } else {
              pcs = Math.round(numVal);
            }
          }
          if (pcs > 0) {
            if (!pendingSortByDate[sDateStr]) pendingSortByDate[sDateStr] = { qty: 0 };
            pendingSortByDate[sDateStr].qty += pcs;
            // pending per symptom per date
            if (!pendingByDateSymptom[sDateStr]) pendingByDateSymptom[sDateStr] = [];
            pendingByDateSymptom[sDateStr].push({ symptom: sSymptom, pcs: pcs });
            // pending per machine
            if (machineName) {
              const pmKey = machineName + "|" + sDateStr;
              if (!sortResultByMachine[pmKey]) sortResultByMachine[pmKey] = { fgPcs: 0, ngPcs: 0 };
              if (!sortResultByMachine[pmKey].pendingPcs) sortResultByMachine[pmKey].pendingPcs = 0;
              sortResultByMachine[pmKey].pendingPcs += pcs;
              // เก็บ pending แยกตามอาการจริง
              if (sSymptom) {
                if (!sortResultByMachine[pmKey].pendingBySymptom) sortResultByMachine[pmKey].pendingBySymptom = {};
                sortResultByMachine[pmKey].pendingBySymptom[sSymptom] = (sortResultByMachine[pmKey].pendingBySymptom[sSymptom] || 0) + pcs;
              }
            }
          }
        }

        // 🌟 งาน Completed/Wait QC → ผลการ Sort จริง (มี FG/NG)
        if (sStatus === "Completed" || sStatus === "Wait QC") {
          const fgRaw = String(sRow[sCol["fg_qty"]] || "").trim();
          const ngRaw = String(sRow[sCol["ng_qty"]] || "").trim();

          const fgVal = parseFloat(fgRaw) || 0;
          const ngVal = parseFloat(ngRaw) || 0;
          let fgPcs = 0, ngPcs = 0;
          if (fgVal > 0) { fgPcs = fgRaw.toLowerCase().includes("kg") ? getPcsFromKg(prodName, fgVal) : Math.round(fgVal); }
          if (ngVal > 0) { ngPcs = ngRaw.toLowerCase().includes("kg") ? getPcsFromKg(prodName, ngVal) : Math.round(ngVal); }

          if (fgPcs > 0 || ngPcs > 0) {
            if (!sortResultByDate[sDateStr]) sortResultByDate[sDateStr] = { fgPcs: 0, ngPcs: 0 };
            sortResultByDate[sDateStr].fgPcs += fgPcs;
            sortResultByDate[sDateStr].ngPcs += ngPcs;
            globalSortFg += fgPcs;
            globalSortNg += ngPcs;

            // อัตรา sort แยกตามอาการ
            if (sSymptom) {
              if (!sortYieldBySymptom[sSymptom]) sortYieldBySymptom[sSymptom] = { fgPcs: 0, ngPcs: 0 };
              sortYieldBySymptom[sSymptom].fgPcs += fgPcs;
              sortYieldBySymptom[sSymptom].ngPcs += ngPcs;
            }

            // แยกตามเครื่อง
            if (machineName) {
              const mKey = machineName + "|" + sDateStr;
              if (!sortResultByMachine[mKey]) sortResultByMachine[mKey] = { fgPcs: 0, ngPcs: 0 };
              sortResultByMachine[mKey].fgPcs += fgPcs;
              sortResultByMachine[mKey].ngPcs += ngPcs;
            }

            // เก็บสถิติแยกตามอาการ
            if (sSymptom) {
                if (!symptomRawStats[sSymptom]) symptomRawStats[sSymptom] = { fg: 0, total: 0 };
                symptomRawStats[sSymptom].fg += fgPcs;
                symptomRawStats[sSymptom].total += (fgPcs + ngPcs);
            }
          }
        }
      }
    }
  } catch (sortErr) {
    console.error("Error reading sorting data for trend: " + sortErr.toString());
  }

  // คำนวณค่าน้ำหนักอาการส่งไปให้หน้าเว็บ
  Object.keys(symptomRawStats).forEach(symp => {
      if (symptomRawStats[symp].total > 0) {
          dynamicSymptomWeights[symp] = parseFloat((symptomRawStats[symp].fg / symptomRawStats[symp].total).toFixed(4));
      }
  });
  result.dynamicSymptomWeights = dynamicSymptomWeights;

  // 🌟 ดึงข้อมูลเปลี่ยนม้วน (Coil Changes) จาก RawMaterial — นับจำนวนครั้งต่อวัน+แยกเครื่อง 🌟
  const coilChangesByDate = {};       // date → total count
  const coilChangesByDateMachine = {}; // date → { machine: count }
  try {
    const rmSheet = ss.getSheetByName("RawMaterial");
    if (rmSheet && rmSheet.getLastRow() > 1) {
      const rmData = rmSheet.getDataRange().getValues();
      // Column A = Date Time, F = Machine
      for (let i = 1; i < rmData.length; i++) {
        const rmDateRaw = rmData[i][0]; // Column A: Date Time
        const rmMachine = String(rmData[i][5] || "").trim(); // Column F: Machine
        if (!rmDateRaw) continue;
        let rmDateStr = "";
        if (rmDateRaw instanceof Date && !isNaN(rmDateRaw.getTime())) {
          // ตัดวัน 08:00 — ก่อน 08:00 นับเป็นวันก่อนหน้า
          let rmShiftDate = new Date(rmDateRaw.getTime());
          let rmHour = parseInt(Utilities.formatDate(rmShiftDate, "GMT+7", "HH")) || 0;
          if (rmHour < 8) rmShiftDate.setDate(rmShiftDate.getDate() - 1);
          rmDateStr = Utilities.formatDate(rmShiftDate, "GMT+7", "yyyy-MM-dd");
        } else {
          const rmStr = String(rmDateRaw).trim();
          const rmParts = rmStr.split(" ");
          rmDateStr = rmParts[0].substring(0, 10);
          if (rmParts[1]) {
            const rmH = parseInt(rmParts[1].split(":")[0]) || 0;
            if (rmH < 8) {
              const tmpD = new Date(rmDateStr + "T00:00:00");
              tmpD.setDate(tmpD.getDate() - 1);
              rmDateStr = tmpD.getFullYear() + "-" + String(tmpD.getMonth() + 1).padStart(2, '0') + "-" + String(tmpD.getDate()).padStart(2, '0');
            }
          }
        }
        if (rmDateStr < startDate || rmDateStr > endDate) continue;
        // รวมยอดทั้งวัน
        if (!coilChangesByDate[rmDateStr]) coilChangesByDate[rmDateStr] = 0;
        coilChangesByDate[rmDateStr]++;
        // แยกตามเครื่อง
        if (rmMachine) {
          if (!coilChangesByDateMachine[rmDateStr]) coilChangesByDateMachine[rmDateStr] = {};
          coilChangesByDateMachine[rmDateStr][rmMachine] = (coilChangesByDateMachine[rmDateStr][rmMachine] || 0) + 1;
        }
      }
    }
  } catch (rmErr) {
    console.error("Error reading RawMaterial: " + rmErr.toString());
  }

  const globalSortTotal = globalSortFg + globalSortNg;
  const globalSortNgRatio = globalSortTotal > 0 ? (globalSortNg / globalSortTotal) : 0.5;

  const sortedDates = Object.keys(dailyStats).sort();
  Object.keys(pendingSortByDate).forEach(d => { if (!dailyStats[d]) sortedDates.push(d); });
  sortedDates.sort();
  const uniqueDates = [...new Set(sortedDates)];

  result.dailyTrend = uniqueDates.map(date => {
    const d = dailyStats[date] || { fg: 0, ng: 0, ngBreakdown: {} };
    const total = d.fg + d.ng;
    const rate = total > 0 ? ((d.ng / total) * 100).toFixed(2) : 0;
    const pending = pendingSortByDate[date] || null;
    const sortResult = sortResultByDate[date] || null;
    let worstNgRate = null;  
    let bestNgRate = null;   
    let forecastNgRate = null; 
    
    if (pending && pending.qty > 0 && total > 0) {
      const projTotal = total + pending.qty;
      worstNgRate = parseFloat(((( d.ng + pending.qty) / projTotal) * 100).toFixed(2));
      bestNgRate = parseFloat(((d.ng / projTotal) * 100).toFixed(2));
      
      if (d.ngBreakdown && Object.keys(d.ngBreakdown).length > 0 && d.ng > 0) {
          let totalWeightedNgRatio = 0;
          for (const [symp, pcs] of Object.entries(d.ngBreakdown)) {
              const fgRate = dynamicSymptomWeights[symp] !== undefined ? dynamicSymptomWeights[symp] : (1 - globalSortNgRatio);
              const ngRateForSymp = 1 - fgRate;
              const proportion = pcs / d.ng; 
              totalWeightedNgRatio += (proportion * ngRateForSymp);
          }
          const projNg = d.ng + Math.round(pending.qty * totalWeightedNgRatio);
          forecastNgRate = parseFloat(((projNg / projTotal) * 100).toFixed(2));
      } else {
          let ngRatio = globalSortNgRatio;
          if (sortResult && (sortResult.fgPcs + sortResult.ngPcs) > 0) {
            ngRatio = sortResult.ngPcs / (sortResult.fgPcs + sortResult.ngPcs);
          }
          const projNg = d.ng + Math.round(pending.qty * ngRatio);
          forecastNgRate = parseFloat(((projNg / projTotal) * 100).toFixed(2));
      }
    }
    
    return {
      date: date, fg: d.fg, ng: d.ng, ngRate: parseFloat(rate), ngBreakdown: d.ngBreakdown,
      pendingSortQty: pending ? pending.qty : 0,
      worstNgRate: worstNgRate,
      bestNgRate: bestNgRate,
      forecastNgRate: forecastNgRate,
      sortYield: sortResult ? { fg: sortResult.fgPcs, ng: sortResult.ngPcs } : null,
      coilChanges: coilChangesByDate[date] || 0,
      coilChangesByMachine: coilChangesByDateMachine[date] || {}
    };
  });

  result.globalSortNgRatio = parseFloat((globalSortNgRatio * 100).toFixed(2));
  for (const machine in result.machineData) {
    const mData = result.machineData[machine];
    mData.sortData = {};
    for (const mKey in sortResultByMachine) {
      const parts = mKey.split("|");
      if (parts[0] === machine) {
        mData.sortData[parts[1]] = sortResultByMachine[mKey];
      }
    }
  }

  return result;
}

function debugSheetData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Production_Data");
  const today = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  
  if (!sheet) return { error: "Production_Data not found" };
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const col = {};
  headers.forEach((h, i) => col[h.toString().trim().toLowerCase()] = i);
  
  const stats = { 
    serverToday: today,
    datesFound: {}, shiftsFound: {}, typesFound: {}, totalRows: values.length - 1
  };
  
  const detailedAnalysis = [];
  for (let i = Math.max(1, values.length - 10); i < values.length; i++) {
      const row = values[i];
      const rawDate = row[col["date"]];
      const dateStr = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "GMT+7", "yyyy-MM-dd") : String(rawDate).trim().substring(0, 10);
      const shift = String(row[col["shift"]] || "").trim();
      const type = String(row[col["shift_type"]] || "").trim();
      
      stats.datesFound[dateStr] = (stats.datesFound[dateStr] || 0) + 1;
      stats.shiftsFound[shift] = (stats.shiftsFound[shift] || 0) + 1;
      stats.typesFound[type] = (stats.typesFound[type] || 0) + 1;
      
      detailedAnalysis.push({
          row: i + 1, date: dateStr, shift: shift, type: type, fg: row[col["fg"]], ng: row[col["ng_total"]], isMatchToday: dateStr === today
      });
  }
  
  return { status: "DEBUG_V3.55_Auth", summary: stats, last10Rows: detailedAnalysis };
}
