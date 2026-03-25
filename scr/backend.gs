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
            rejectTarget: rejectTargetCol > -1 ? r[rejectTargetCol] : ""
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
                sortDate: summaryTargetISO
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
  if (action === "SAVE_RTV") {
    let sheet = ss.getSheetByName("RTV_Data");
    if (!sheet) {
        sheet = ss.insertSheet("RTV_Data");
        sheet.appendRow(["Timestamp", "Date", "Product", "Qty", "Remark", "Recorder"]);
    }

    const now = new Date();
    sheet.appendRow([
        now.toLocaleString('th-TH'),
        data.date,
        data.product,
        data.qty,
        data.remark,
        data.recorder
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

          let foundRow = -1;
          for (let i = 1; i < rows.length; i++) { 
              if (rows[i][jobCol] === data.jobId) { foundRow = i + 1; break; } 
          }

          if (foundRow > -1) {
              const now = new Date();

              // === ป้องกันบันทึกซ้ำ: ถ้า status ปัจจุบันเป็น Completed อยู่แล้ว ไม่ต้องทำซ้ำ ===
              const currentStatus = String(rows[foundRow - 1][getCol("Status")] || "").trim();
              if (data.status === "Completed" && currentStatus === "Completed") {
                  return ContentService.createTextOutput(JSON.stringify({status: "success", message: "งานนี้ถูกอนุมัติไปแล้ว"})).setMimeType(ContentService.MimeType.JSON);
              }

              // === Batch write: รวมการเขียนหลาย cell เป็นครั้งเดียว ลด API calls ===
              const cellUpdates = []; // เก็บ {row, col, value} แล้วเขียนรวมทีเดียว
              const queueWrite = (row, col, value) => cellUpdates.push({row, col, value});

              queueWrite(foundRow, statCol, data.status);

              if (data.status === "Wait QC") {
                  // 2. ผู้คัด (Sorter) คัดเสร็จ ส่งยอดให้ QC
                  if (data.fgQty) queueWrite(foundRow, fgCol, data.fgQty);
                  if (data.ngQty) queueWrite(foundRow, ngCol, data.ngQty);
                  queueWrite(foundRow, sorterCol, data.closedBy);
                  queueWrite(foundRow, closedDateCol, now.toLocaleString('th-TH'));
                  queueWrite(foundRow, rejectTargetCol, "");

                  // Batch write ทั้งหมดในครั้งเดียว
                  cellUpdates.forEach(u => sheet.getRange(u.row, u.col).setValue(u.value));
                  SpreadsheetApp.flush();

                  logUserAction(data.closedBy, "System", "SUBMIT_QC", `ส่งงาน ${data.jobId} ให้ QC ตรวจ`);
              }
              else if (data.status === "Completed") {
                  // 3. QC อนุมัติผ่าน (เก็บชื่อ QC ลงคอลัมน์ Closed_By)
                  queueWrite(foundRow, closedByCol, data.closedBy);
                  queueWrite(foundRow, closedDateCol, now.toLocaleString('th-TH'));

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
                      let fgPcs = 0;
                      const fgVal = parseFloat(fgQtyRaw) || 0;
                      if (fgVal > 0) {
                          if (String(fgQtyRaw).includes("kg")) {
                              fgPcs = getPcsFromKg(sortProduct, fgVal);
                          } else {
                              fgPcs = Math.round(fgVal);
                          }
                      }

                      // === แปลงวันที่จาก Sorting_Data ===
                      let dateStr = "";
                      let hourNum = 0;
                      if (sortDateRaw instanceof Date && !isNaN(sortDateRaw.getTime())) {
                          dateStr = Utilities.formatDate(sortDateRaw, "GMT+7", "yyyy-MM-dd");
                          hourNum = parseInt(Utilities.formatDate(sortDateRaw, "GMT+7", "HH")) || 0;
                      } else if (sortDateRaw) {
                          const dateParts = String(sortDateRaw).split(" ");
                          dateStr = dateParts[0] || Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
                          const rawTime = dateParts[1] || "";
                          hourNum = parseInt(rawTime.split(":")[0]) || 0;
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

                              // เขียน row ใหม่ลง Production_Data (ใช้ prodHeaders ที่อ่านไว้แล้ว ไม่อ่านซ้ำ)
                              if (ngKg > 0) {
                                  syncHeaders(prodSheet);
                                  const freshHeaders = prodSheet.getRange(1, 1, 1, prodSheet.getLastColumn()).getValues()[0];
                                  const getProdCol = (name) => freshHeaders.findIndex(h => h.toString().trim().toLowerCase() === name.toLowerCase());

                                  const newRow = new Array(freshHeaders.length).fill("");
                                  const mapData = (colName, value) => { const idx = getProdCol(colName); if (idx !== -1) newRow[idx] = value; };

                                  const ngDetails = [{ type: symptom, qty: parseFloat(ngKg.toFixed(4)), unit: "kg" }];

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
                                  mapData("Batch_ID", "SORT-" + data.jobId);

                                  prodSheet.appendRow(newRow);
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

function getPcsFromKg(productName, kg) {
    if (!kg || kg <= 0) return 0;
    
    let weightPerPc = 0.003; 
    if (productName.includes("10A")) weightPerPc = 0.00228;
    else if (productName.includes("16A")) weightPerPc = 0.00279;
    else if (productName.includes("20A")) weightPerPc = 0.00357;
    else if (productName.includes("25/32A")) weightPerPc = 0.005335; 
    
    return Math.round(kg / weightPerPc);
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
         try { JSON.parse(val).forEach(item => ngTypes.add(capitalizeFirst(item))); } catch(e) {}
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
                try { JSON.parse(data[i][idxJson]).forEach(d => { if(d.type) ngTypes.add(capitalizeFirst(d.type)); }); } catch(e){}
             }
          }
      }
  }
  
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
             recorder: rRow[rCol["recorder"]]
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

  const sortedDates = Object.keys(dailyStats).sort();
  result.dailyTrend = sortedDates.map(date => {
    const d = dailyStats[date];
    const total = d.fg + d.ng;
    const rate = total > 0 ? ((d.ng / total) * 100).toFixed(2) : 0;
    return { date: date, fg: d.fg, ng: d.ng, ngRate: parseFloat(rate), ngBreakdown: d.ngBreakdown };
  });

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
