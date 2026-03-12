// ----------------------------------------------------
// CWM Production System - form.js (v3.55)
// ----------------------------------------------------

function getShiftDateStr() {
    const now = new Date();
    if (now.getHours() < 8) {
        now.setDate(now.getDate() - 1);
    }
    return now.toISOString().split('T')[0];
}

window.updateHourSlots = function(shiftType) {
    const slotSelect = document.getElementById('hourSlot');
    if (!slotSelect) return;
    slotSelect.innerHTML = '';
    
    let hours = [];
    if (shiftType === 'Day') {
        hours = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "OT 17:30-18:00", "OT 18:00-19:00", "OT 19:00-20:00"];
    } else {
        hours = ["20:00-21:00", "21:00-22:00", "22:00-23:00", "23:00-00:00", "00:00-01:00", "01:00-02:00", "02:00-03:00", "03:00-04:00", "04:00-05:00", "OT 05:30-06:00", "OT 06:00-07:00", "OT 07:00-08:00"];
    }
    
    hours.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h;
        opt.text = h;
        slotSelect.appendChild(opt);
    });
    
    const now = new Date();
    const currentHour = now.getHours();
    let defaultIndex = 0;
    
    if (shiftType === 'Day') {
        if (currentHour >= 8 && currentHour < 17) defaultIndex = currentHour - 8;
        else if (currentHour >= 17 && currentHour < 20) defaultIndex = 8 + (currentHour - 17);
    } else {
        if (currentHour >= 20) defaultIndex = currentHour - 20;
        else if (currentHour < 5) defaultIndex = currentHour + 4;
        else if (currentHour >= 5 && currentHour < 8) defaultIndex = 8 + (currentHour - 5);
    }
    
    if(slotSelect.options.length > defaultIndex) {
        slotSelect.selectedIndex = defaultIndex;
    }
};

// 🌟 เพิ่มฟังก์ชันที่หายไปสำหรับเรนเดอร์รายชื่อพนักงาน (แก้ Error auth.js) 🌟
window.renderRecorderOptions = function() {
    const recorderSelect = document.getElementById('recorder');
    if (!recorderSelect) return;
    
    const currentVal = recorderSelect.value;
    recorderSelect.innerHTML = '<option value="">เลือกพนักงาน...</option>';
    
    if (typeof recorderList !== 'undefined' && Array.isArray(recorderList)) {
        recorderList.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.text = r;
            recorderSelect.appendChild(opt);
        });
        
        // คืนค่าเดิมที่เคยเลือกไว้ ถ้ายังมีอยู่ในลิสต์
        if (currentVal && recorderList.includes(currentVal)) {
            recorderSelect.value = currentVal;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const pDate = document.getElementById('productionDate');
    const planDate = document.getElementById('planDate');
    if(pDate) pDate.value = getShiftDateStr();
    if(planDate) planDate.value = getShiftDateStr();
    
    const currentHour = new Date().getHours();
    const isDay = (currentHour >= 8 && currentHour < 20);
    const shiftTypeRadio = document.querySelector(`input[name="shift_type_toggle"][value="${isDay ? 'Day' : 'Night'}"]`);
    if(shiftTypeRadio) shiftTypeRadio.checked = true;
    updateHourSlots(isDay ? 'Day' : 'Night');
    
    setTimeout(() => { if (document.getElementById('batchList') && document.getElementById('batchList').children.length === 0) window.addBatchRow(); }, 500);
});

window.addBatchRow = function() {
    const list = document.getElementById('batchList');
    if(!list) return;
    const rowCount = list.children.length;
    const div = document.createElement('div');
    div.className = 'batch-row bg-gray-50 p-3 rounded-lg border border-gray-200 relative animate-fade-in flex flex-col md:flex-row gap-3 items-end';
    
    let macOpts = '<option value="">- เลือก -</option>';
    for(let i=1; i<=16; i++) {
        let m = `CWM-${String(i).padStart(2,'0')}`;
        macOpts += `<option value="${m}">${m}</option>`;
    }
    
    let prodOpts = '<option value="">- เลือกรุ่น -</option>';
    productList.forEach(p => prodOpts += `<option value="${p}">${p}</option>`);

    div.innerHTML = `
        <div class="w-full md:w-1/4">
            <label class="block text-[10px] font-bold text-gray-500 mb-0.5">เครื่องจักร (Machine)</label>
            <select class="w-full p-2 border rounded text-sm bg-white font-bold text-blue-700 select-machine" required onchange="window.autoAssignProduct(this)">
                ${macOpts}
            </select>
        </div>
        <div class="w-full md:w-2/4">
            <label class="block text-[10px] font-bold text-gray-500 mb-0.5">รุ่นสินค้า (Product Model)</label>
            <select class="w-full p-2 border rounded text-sm bg-white select-product" required>
                ${prodOpts}
            </select>
        </div>
        <div class="w-full md:w-1/4 flex gap-2">
            <div class="flex-1">
                <label class="block text-[10px] font-bold text-green-600 mb-0.5">FG (งานดี)</label>
                <input type="number" min="0" class="w-full p-2 border rounded text-sm text-center font-bold text-green-700 bg-green-50 focus:bg-white input-fg" placeholder="0" required onchange="window.updateTotalFields(this.closest('.batch-row'))">
            </div>
            <div class="flex-1 relative">
                <label class="block text-[10px] font-bold text-red-600 mb-0.5">NG (ของเสีย)</label>
                <div class="flex">
                    <input type="number" min="0" readonly class="w-full p-2 border rounded-l text-sm text-center font-bold text-red-700 bg-red-50 input-ng cursor-pointer" placeholder="0" onclick="window.openNgModal(this)">
                    <input type="hidden" class="input-ng-json" value="{}">
                    <button type="button" class="bg-red-100 border border-l-0 border-red-200 px-2 rounded-r text-red-600 hover:bg-red-200" onclick="window.openNgModal(this)">📝</button>
                </div>
            </div>
        </div>
        ${rowCount > 0 ? `<button type="button" onclick="window.removeBatchRow(this)" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow hover:bg-red-600">&times;</button>` : ''}
    `;
    list.appendChild(div);
};

window.removeBatchRow = function(btn) {
    btn.closest('.batch-row').remove();
};

window.autoAssignProduct = function(selectEl) {
    const m = selectEl.value;
    const row = selectEl.closest('.batch-row');
    const prodSelect = row.querySelector('.select-product');
    if(m && machineMapping[m]) {
        prodSelect.value = machineMapping[m];
    }
};

window.updateTotalFields = function(row) {
    const fg = parseInt(row.querySelector('.input-fg').value) || 0;
    const ng = parseInt(row.querySelector('.input-ng').value) || 0;
    // เพิ่ม Logic คำนวณเพิ่มเติมได้ที่นี่
};

// --- Assign Modal ---
window.openAssignModal = function() {
    const container = document.getElementById('assign-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    for(let i=1; i<=16; i++) {
        const m = `CWM-${String(i).padStart(2,'0')}`;
        const currentVal = machineMapping[m] || '';
        let opts = `<option value="">-- ไม่ได้ระบุ --</option>`;
        opts += productList.map(p => `<option value="${p}" ${currentVal===p?'selected':''}>${p}</option>`).join('');
        
        container.innerHTML += `
            <div class="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-100 mb-1">
                <label class="font-bold text-gray-700 w-20 flex-none">${m}</label>
                <select class="assign-select-input w-full p-1.5 border rounded text-sm bg-white" data-machine="${m}">
                    ${opts}
                </select>
            </div>
        `;
    }
    document.getElementById('modal-assign').classList.remove('hidden');
};

window.closeAssignModal = function() {
    document.getElementById('modal-assign').classList.add('hidden');
};

window.saveAssignment = async function() {
    const selects = document.querySelectorAll('.assign-select-input');
    let hasChanges = false;
    let logEntries = [];
    
    selects.forEach(sel => {
        const m = sel.dataset.machine;
        const v = sel.value;
        if(machineMapping[m] !== v) {
            machineMapping[m] = v;
            hasChanges = true;
            logEntries.push({machine: m, product: v});
        }
    });
    
    if(!hasChanges) {
        window.closeAssignModal();
        return;
    }
    
    const btn = document.querySelector('#modal-assign button[onclick="window.saveAssignment()"]');
    const oriText = btn.innerText;
    btn.innerText = "⏳ Saving...";
    btn.disabled = true;
    
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'SAVE_MAPPING', data: machineMapping })
        });
        alert("✅ บันทึกการตั้งค่าเครื่องจักรสำเร็จ");
        window.closeAssignModal();
        
        const rows = document.querySelectorAll('.batch-row');
        rows.forEach(row => {
            const mSel = row.querySelector('.select-machine');
            if(mSel && mSel.value) window.autoAssignProduct(mSel);
        });
    } catch(e) {
        alert("Error saving: " + e.message);
    } finally {
        btn.innerText = oriText;
        btn.disabled = false;
    }
};

// --- NG Modal ---
let currentNgTargetInput = null;

window.openNgModal = function(triggerEl) {
    const row = triggerEl.closest('.batch-row');
    currentNgTargetInput = row.querySelector('.input-ng');
    const jsonInput = row.querySelector('.input-ng-json');
    let currentData = {};
    try { currentData = JSON.parse(jsonInput.value || '{}'); } catch(e){}
    
    const list = document.getElementById('modal-ng-list');
    list.innerHTML = '';
    
    ngSymptoms.forEach((sym, idx) => {
        const val = currentData[sym] || '';
        list.innerHTML += `
            <div class="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded border border-gray-100">
                <label class="flex-1 text-sm text-gray-700">${sym}</label>
                <input type="number" min="0" class="w-20 p-1.5 border rounded text-center text-red-600 font-bold modal-ng-val" data-sym="${sym}" value="${val}" placeholder="0">
            </div>
        `;
    });
    
    for(let k in currentData) {
        if(!ngSymptoms.includes(k)) {
            list.innerHTML += `
                <div class="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded border border-gray-100">
                    <input type="text" class="flex-1 p-1.5 border rounded text-sm text-gray-700 modal-ng-sym-custom" value="${k}">
                    <input type="number" min="0" class="w-20 p-1.5 border rounded text-center text-red-600 font-bold modal-ng-val-custom" value="${currentData[k]}" placeholder="0">
                    <button type="button" onclick="this.parentElement.remove()" class="text-red-500 font-bold px-2">&times;</button>
                </div>
            `;
        }
    }
    
    document.getElementById('modal-ng').classList.remove('hidden');
};

window.closeNgModal = function(save) {
    if(save && currentNgTargetInput) {
        const row = currentNgTargetInput.closest('.batch-row');
        const jsonInput = row.querySelector('.input-ng-json');
        
        let newData = {};
        let totalNg = 0;
        
        document.querySelectorAll('.modal-ng-val').forEach(inp => {
            const v = parseInt(inp.value);
            if(v > 0) {
                newData[inp.dataset.sym] = v;
                totalNg += v;
            }
        });
        
        document.querySelectorAll('.modal-ng-sym-custom').forEach(inp => {
            const sym = inp.value.trim();
            const valInp = inp.nextElementSibling;
            const v = parseInt(valInp.value);
            if(sym && v > 0) {
                newData[sym] = (newData[sym] || 0) + v;
                totalNg += v;
            }
        });
        
        currentNgTargetInput.value = totalNg > 0 ? totalNg : '';
        jsonInput.value = JSON.stringify(newData);
        window.updateTotalFields(row);
    }
    document.getElementById('modal-ng').classList.add('hidden');
    currentNgTargetInput = null;
};

window.addCustomNgField = function() {
    const list = document.getElementById('modal-ng-list');
    list.innerHTML += `
        <div class="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded border border-gray-100">
            <input type="text" class="flex-1 p-1.5 border rounded text-sm text-gray-700 modal-ng-sym-custom" placeholder="ระบุอาการ...">
            <input type="number" min="0" class="w-20 p-1.5 border rounded text-center text-red-600 font-bold modal-ng-val-custom" placeholder="0">
            <button type="button" onclick="this.parentElement.remove()" class="text-red-500 font-bold px-2">&times;</button>
        </div>
    `;
};

// --- Manage List ---
let currentManageListType = '';

window.manageRecorders = function() {
    currentManageListType = 'recorder';
    document.getElementById('manage-list-title').innerText = 'จัดการรายชื่อพนักงาน';
    renderManageList(recorderList);
    document.getElementById('modal-manage-list').classList.remove('hidden');
};

window.manageSymptomsFromModal = function() {
    document.getElementById('modal-ng').classList.add('hidden');
    currentManageListType = 'symptom';
    document.getElementById('manage-list-title').innerText = 'จัดการรายการอาการเสีย (NG)';
    renderManageList(ngSymptoms);
    document.getElementById('modal-manage-list').classList.remove('hidden');
};

function renderManageList(arr) {
    const c = document.getElementById('manage-list-content');
    c.innerHTML = '';
    arr.forEach((item, idx) => {
        c.innerHTML += `
            <div class="flex justify-between items-center p-2 bg-gray-50 border-b last:border-0">
                <span class="text-sm text-gray-700">${item}</span>
                <button type="button" onclick="window.removeItemFromList(${idx})" class="text-red-500 hover:bg-red-100 px-2 py-0.5 rounded font-bold text-xs">ลบ</button>
            </div>
        `;
    });
}

window.addNewItemToList = function() {
    const inp = document.getElementById('new-item-input');
    const val = inp.value.trim();
    if(!val) return;
    
    if(currentManageListType === 'recorder') {
        if(!recorderList.includes(val)) recorderList.push(val);
        renderManageList(recorderList);
    } else {
        if(!ngSymptoms.includes(val)) ngSymptoms.push(val);
        renderManageList(ngSymptoms);
    }
    inp.value = '';
};

window.removeItemFromList = function(idx) {
    if(currentManageListType === 'recorder') {
        recorderList.splice(idx, 1);
        renderManageList(recorderList);
    } else {
        ngSymptoms.splice(idx, 1);
        renderManageList(ngSymptoms);
    }
};

window.saveListToCloud = async function() {
    const btn = document.getElementById('btn-save-cloud');
    const oriText = btn.innerText;
    btn.innerText = '⏳ กำลังอัปเดต...';
    btn.disabled = true;
    
    try {
        const payload = { action: 'UPDATE_GLOBALS' };
        if(currentManageListType === 'recorder') payload.recorders = recorderList;
        else payload.ngSymptoms = ngSymptoms;
        
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
        
        alert("✅ อัปเดตข้อมูลขึ้น Cloud สำเร็จ");
        if(currentManageListType === 'recorder') window.renderRecorderOptions();
        window.closeManageListModal();
    } catch(e) {
        alert("❌ ผิดพลาด: " + e.message);
    } finally {
        btn.innerText = oriText;
        btn.disabled = false;
    }
};

window.closeManageListModal = function() {
    document.getElementById('modal-manage-list').classList.add('hidden');
    if(currentManageListType === 'symptom') {
        document.getElementById('modal-ng').classList.remove('hidden');
    }
};

// --- Undo System ---
let lastSubmitData = null;

window.showUndoToast = function() {
    const toast = document.getElementById('undo-toast');
    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    setTimeout(() => window.closeUndoToast(), 15000);
};

window.closeUndoToast = function() {
    const toast = document.getElementById('undo-toast');
    toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
};

window.undoLastSubmit = async function() {
    if(!lastSubmitData) return;
    const btn = document.getElementById('btn-undo-action');
    btn.innerHTML = "⏳ กำลังยกเลิก...";
    btn.disabled = true;
    
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'UNDO_BATCH', batchId: lastSubmitData.batchId })
        });
        alert("✅ ยกเลิกข้อมูลชุดล่าสุดเรียบร้อยแล้ว");
        window.closeUndoToast();
        lastSubmitData = null;
    } catch(e) {
        alert("❌ ไม่สามารถยกเลิกได้: " + e.message);
    } finally {
        btn.innerHTML = "↩️ ยกเลิก (Undo)";
        btn.disabled = false;
    }
};

// --- Form Submit: Production ---
document.getElementById('productionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.currentUser) {
        alert("กรุณาล็อคอินก่อนบันทึกข้อมูล");
        return;
    }

    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ กำลังบันทึกข้อมูล...";
    btn.disabled = true;

    const date = document.getElementById('productionDate').value;
    const shift = document.getElementById('shift').value;
    const isDay = document.querySelector('input[name="shift_type_toggle"][value="Day"]').checked;
    const shiftType = isDay ? "Day" : "Night";
    const hourSlot = document.getElementById('hourSlot').value;
    const recorder = document.getElementById('recorder').value;
    
    const rows = document.querySelectorAll('.batch-row');
    let batchData = [];
    
    rows.forEach(row => {
        const m = row.querySelector('.select-machine').value;
        const p = row.querySelector('.select-product').value;
        const fg = parseInt(row.querySelector('.input-fg').value) || 0;
        const ng = parseInt(row.querySelector('.input-ng').value) || 0;
        const ngJson = row.querySelector('.input-ng-json').value;
        
        if (m && p && (fg > 0 || ng > 0)) {
            batchData.push({ machine: m, product: p, fg: fg, ng: ng, ngDetails: ngJson });
        }
    });
    
    if (batchData.length === 0) {
        alert("❌ กรุณากรอกข้อมูลให้ครบถ้วนอย่างน้อย 1 รายการ (ต้องมียอด FG หรือ NG)");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    const batchId = "B_" + Date.now();
    const payload = {
        action: 'SAVE_PRODUCTION_BATCH',
        username: window.currentUser.username,
        role: window.currentUser.role,
        date: date,
        shift: shift,
        shiftType: shiftType,
        hour: hourSlot,
        recorder: recorder,
        batchId: batchId,
        data: batchData
    };

    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
            document.getElementById('batchList').innerHTML = '';
            window.addBatchRow();
            
            // Advance Time Slot
            const sel = document.getElementById('hourSlot');
            if(sel.selectedIndex < sel.options.length - 1) sel.selectedIndex++;
            
            lastSubmitData = { batchId: batchId, count: batchData.length };
            window.showUndoToast();
        } else {
            alert("❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + result.message);
        }
    } catch(err) {
        alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// --- Form Submit: Planning ---
document.getElementById('planningForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.currentUser) return;
    
    const btn = document.getElementById('planSubmitBtn');
    const ori = btn.innerText;
    btn.innerText = "⏳ กำลังบันทึก...";
    btn.disabled = true;
    
    const payload = {
        action: 'SAVE_PLAN',
        username: window.currentUser.username,
        role: window.currentUser.role,
        date: document.getElementById('planDate').value,
        product: document.getElementById('planProduct').value,
        shift: document.getElementById('planShift').value,
        qty: document.getElementById('planQty').value
    };
    
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.status === 'success') {
            alert('✅ บันทึกแผนสำเร็จ');
            document.getElementById('planningForm').reset();
            document.getElementById('planDate').value = getShiftDateStr();
        } else {
            alert('❌ ' + result.message);
        }
    } catch(e) {
        alert('❌ Error connection');
    } finally {
        btn.innerText = ori;
        btn.disabled = false;
    }
});

// ----------------------------------------------------
// 🌟 ส่วนที่ปรับปรุง: ฟอร์มแจ้งซ่อม (Double Submit Lock, Spell Check, Downtime) 🌟
// ----------------------------------------------------

// ใช้ window.isSubmittingMaintenance เพื่อป้องกันปัญหา SyntaxError จากการประกาศซ้ำ
window.isSubmittingMaintenance = window.isSubmittingMaintenance || false;

document.getElementById('maintenanceForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    // 1. ป้องกันการกดเบิ้ล (บันทึกซ้ำ)
    if (window.isSubmittingMaintenance) {
        console.log("บล็อกการส่งข้อมูลซ้ำ");
        return;
    }

    const jobId = document.getElementById('maint-job-id')?.value || '';
    const startDateStr = document.getElementById('maint-date').value;
    const machine = document.getElementById('maint-machine').value;
    const issueType = document.getElementById('maint-issue-type').value;
    const startTimeStr = document.getElementById('maint-start-time').value;
    
    // เช็คกรณีปิดจ๊อบข้ามวัน
    const endDateInput = document.getElementById('maint-end-date');
    const endDateStr = (endDateInput && !endDateInput.parentElement.classList.contains('hidden')) ? endDateInput.value : startDateStr;
    const endTimeStr = document.getElementById('maint-end-time').value;
    let remark = document.getElementById('maint-remark').value;

    // ตรวจสอบการปิดจ๊อบ
    if (jobId && !endTimeStr) {
        alert("❌ กรุณาระบุ 'ทำงานต่อ (End)' เพื่อปิดจ๊อบ");
        return;
    }

    // 2. ระบบตรวจคำผิด (Smart Spell Checker สำหรับช่าง)
    const spellCheckDict = {
        "เปลียน": "เปลี่ยน", "เซนเซอ": "เซ็นเซอร์", "เซนเซอร์": "เซ็นเซอร์",
        "มอเตอ": "มอเตอร์", "ทำความสอาด": "ทำความสะอาด", "สอาด": "สะอาด",
        "ปั้ม": "ปั๊ม", "น๊อต": "น็อต", "ล๊อค": "ล็อก", "ล้อค": "ล็อก",
        "ช๊อต": "ช็อต", "ชาจ": "ชาร์จ", "รีเซท": "รีเซ็ต", "เบรคดาว": "เบรกดาวน์", 
        "เบรค": "เบรก", "พังง": "พัง", "อคิลิค": "อะคริลิก"
    };
    
    let correctedRemark = remark;
    let typoFound = false;
    for (let wrongWord in spellCheckDict) {
        if (correctedRemark.includes(wrongWord)) {
            correctedRemark = correctedRemark.replace(new RegExp(wrongWord, 'g'), spellCheckDict[wrongWord]);
            typoFound = true;
        }
    }

    // 3. คำนวณ Downtime เพื่อยืนยัน
    let downtimeMsg = "ยังไม่ระบุเวลาเสร็จ (เปิดงานค้างไว้)";
    if (startTimeStr && endTimeStr) {
        try {
            let start = new Date(`${startDateStr}T${startTimeStr}`);
            let end = new Date(`${endDateStr}T${endTimeStr}`);
            
            // ถ้าระบุเวลาเสร็จน้อยกว่าเวลาเริ่ม แสดงว่าข้ามวัน
            if (end < start) end.setDate(end.getDate() + 1); 
            
            let diffMins = Math.round((end - start) / 60000);
            let h = Math.floor(diffMins / 60);
            let m = diffMins % 60;
            downtimeMsg = diffMins > 0 ? (h > 0 ? `${h} ชั่วโมง ${m} นาที` : `${m} นาที`) : "0 นาที";
        } catch(err) {
            downtimeMsg = "ไม่สามารถคำนวณเวลาได้";
        }
    }

    // 4. แสดง Pop-up ทวนข้อมูลก่อนบันทึก
    let confirmMsg = `📋 ทวนสอบข้อมูลการแจ้งซ่อม (กรุณาตรวจสอบก่อนบันทึก):\n`;
    confirmMsg += `----------------------------------------\n`;
    confirmMsg += `🏭 เครื่องจักร: ${machine}\n`;
    confirmMsg += `⚠️ อาการปัญหา: ${issueType}\n`;
    confirmMsg += `⏱️ เวลาหยุด: ${startTimeStr} น.\n`;
    if (endTimeStr) confirmMsg += `✅ เวลาทำงานต่อ: ${endTimeStr} น.\n`;
    confirmMsg += `⏳ รวมเวลา Downtime: ${downtimeMsg}\n`;
    confirmMsg += `----------------------------------------\n`;
    
    if (typoFound) {
        confirmMsg += `✨ ระบบตรวจพบคำผิดและปรับแก้ให้อัตโนมัติ:\n[เดิม]: "${remark}"\n[ใหม่]: "${correctedRemark}"\n\n`;
        remark = correctedRemark; 
        document.getElementById('maint-remark').value = correctedRemark; // อัปเดต UI กลับไปเป็นคำที่ถูก
    } else {
        confirmMsg += `📝 รายละเอียด: ${remark || '-'}\n\n`;
    }

    confirmMsg += `กด 'ตกลง (OK)' เพื่อยืนยันการบันทึกข้อมูล`;

    // รอกดยืนยันจากผู้ใช้
    if (!confirm(confirmMsg)) {
        return; // หากกดยกเลิก ให้หยุดการทำงาน
    }

    // เริ่มดำเนินการบันทึก (ล็อคปุ่ม)
    window.isSubmittingMaintenance = true; 
    const btn = document.getElementById('btn-save-maint');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ กำลังบันทึกข้อมูล...";
    btn.disabled = true;

    let base64String = "";
    const fileInput = document.getElementById('maint-photo');
    
    // ฟังก์ชันบีบอัดรูปภาพ
    async function compressImage(file, maxSizeKB) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function(event) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_DIMENSION = 1200;
                    if (width > height && width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    } else if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    let quality = 0.8;
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    while (Math.round((dataUrl.length * 3 / 4) / 1024) > maxSizeKB && quality > 0.1) {
                        quality -= 0.1;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                    }
                    resolve(dataUrl);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    if (fileInput && fileInput.files.length > 0) {
        try {
            btn.innerHTML = "⏳ กำลังบีบอัดรูปภาพ...";
            base64String = await compressImage(fileInput.files[0], 256);
            btn.innerHTML = "⏳ กำลังบันทึกข้อมูล...";
        } catch (err) {
            alert("❌ ไม่สามารถประมวลผลไฟล์ภาพได้");
            btn.innerHTML = originalText;
            btn.disabled = false;
            window.isSubmittingMaintenance = false;
            return;
        }
    }

    const payload = {
        action: 'SAVE_MAINTENANCE',
        jobId: jobId,
        username: window.currentUser ? window.currentUser.username : "Unknown",
        role: window.currentUser ? window.currentUser.role : "Unknown",
        date: startDateStr,
        machine: machine,
        issueType: issueType,
        startTime: startTimeStr,
        endDate: endDateStr,
        endTime: endTimeStr,
        remark: remark,
        imageBase64: base64String
    };

    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
            alert("✅ " + result.message);
            if (typeof window.clearPendingSelection === 'function') window.clearPendingSelection();
            document.getElementById('maintenanceForm').reset();
            const photoPreview = document.getElementById('maint-photo-preview');
            if (photoPreview) photoPreview.classList.add('hidden');
            document.getElementById('modal-maintenance').classList.add('hidden');
        } else {
            alert("❌ เกิดข้อผิดพลาด: " + result.message);
        }
    } catch(err) {
        alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        window.isSubmittingMaintenance = false; // ปลดล็อค
    }
});

// --- RTV Form Submit ---
document.addEventListener('DOMContentLoaded', () => {
    const rtvForm = document.getElementById('rtvForm');
    if (rtvForm) {
        rtvForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save-rtv');
            const originalText = btn.innerHTML;
            btn.innerHTML = "⏳ กำลังบันทึก...";
            btn.disabled = true;

            const payload = {
                action: 'SAVE_RTV',
                date: document.getElementById('rtvDate').value,
                recorder: document.getElementById('rtvRecorder').value,
                source: '-', 
                product: document.getElementById('rtvProduct').value,
                qty: document.getElementById('rtvQty').value,
                remark: document.getElementById('rtvRemark').value
            };

            try {
                const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
                const result = await res.json();
                
                if (result.status === 'success') {
                    alert("✅ บันทึกงานเคลม (RTV) สำเร็จ");
                    rtvForm.reset();
                    document.getElementById('rtvDate').value = getShiftDateStr();
                    if(window.currentUser) {
                        document.getElementById('rtvRecorder').value = window.currentUser.name || window.currentUser.username;
                    }
                } else {
                    alert("❌ เกิดข้อผิดพลาด: " + result.message);
                }
            } catch(err) {
                alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };
    }
});
