window.openAssignModal = function() {
    const container = document.getElementById('assign-list-container');
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
            hasChanges = true;
            if(v) {
                machineMapping[m] = v;
                logEntries.push({machine: m, product: v});
            } else {
                delete machineMapping[m];
                logEntries.push({machine: m, product: "Unassigned"});
            }
        }
    });
    
    localStorage.setItem('CWM_MACHINE_MAPPING', JSON.stringify(machineMapping));
    window.closeAssignModal();
    
    const rows = document.getElementById('batchList').children;
    for(let r of rows) {
        const mSel = r.querySelector('.machine-select-trigger');
        const pSel = r.querySelector('.product-select-target');
        if(mSel && mSel.value && machineMapping[mSel.value]) {
            pSel.value = machineMapping[mSel.value];
            pSel.dispatchEvent(new Event('change'));
        }
    }

    if(hasChanges && logEntries.length > 0) {
        const payload = { 
            action: 'SAVE_ASSIGNMENT', 
            timestamp: new Date().toLocaleString('th-TH'),
            logs: logEntries,
            recorder: document.getElementById('recorder').value || "System"
        };
        fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) })
        .catch(e => console.log("Error logging assignment:", e));

        systemLog('ASSIGN_MACHINE', `บันทึกการตั้งค่าเครื่องจักร ${logEntries.length} รายการ`);
    }
};

window.addBatchRow = function() {
    const container = document.getElementById('batchList');
    const rowId = 'row-' + Date.now() + Math.random().toString(36).substr(2, 5);
    let machineOpts = '<option value="">เลือกเครื่อง...</option>';
    for(let i=1; i<=16; i++) {
        machineOpts += `<option value="CWM-${String(i).padStart(2,'0')}">CWM-${String(i).padStart(2,'0')}</option>`;
    }
    let prodOpts = productList.map(p => `<option value="${p}">${p}</option>`).join('');

    const div = document.createElement('div');
    div.id = rowId;
    div.className = "bg-white p-3 border border-gray-200 rounded-lg shadow-sm flex flex-col md:flex-row gap-3 items-end md:items-center";
    div.innerHTML = `
        <div class="flex-1 w-full">
            <label class="text-[10px] text-gray-400 font-bold uppercase">Machine</label>
            <select name="machine" class="machine-select-trigger w-full p-2 border rounded bg-gray-50 text-sm font-bold">${machineOpts}</select>
        </div>
        <div class="flex-1 w-full">
            <label class="text-[10px] text-gray-400 font-bold uppercase">Product</label>
            <select name="productCode" class="product-select-target w-full p-2 border rounded bg-gray-50 text-sm">${prodOpts}</select>
        </div>
        <div class="w-24">
            <label class="text-[10px] text-gray-400 font-bold uppercase">FG</label>
            <input type="number" name="fgAmount" value="1000" class="w-full p-2 border rounded text-center font-bold text-green-600 bg-green-50 focus:bg-white" min="0">
        </div>
        <div class="w-full md:w-auto flex gap-2">
            <button type="button" onclick="window.openNgModal('${rowId}')" class="flex-1 md:flex-none bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded font-bold text-sm hover:bg-red-100 relative">
                NG (Kg) <span id="ng-badge-${rowId}" class="hidden absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">0</span>
            </button>
            <button type="button" onclick="window.removeBatchRow('${rowId}')" class="text-gray-400 hover:text-red-500 px-2 text-xl">&times;</button>
        </div>
    `;
    container.appendChild(div);
    batchNgData[rowId] = [];

    const mSelect = div.querySelector('.machine-select-trigger');
    const pSelect = div.querySelector('.product-select-target');
    const fgInput = div.querySelector('input[name="fgAmount"]');
    
    const checkProductForFg = () => {
        if(pSelect.value === "51207080HC-JR (25/32A)") {
            fgInput.value = "800";
        } else {
            fgInput.value = "1000";
        }
    };

    mSelect.addEventListener('change', function() {
        const selectedM = this.value;
        if(selectedM && machineMapping[selectedM]) {
            pSelect.value = machineMapping[selectedM];
            checkProductForFg(); 
        }
    });

    pSelect.addEventListener('change', checkProductForFg);
    checkProductForFg();
};

window.removeBatchRow = function(id) { 
    const el = document.getElementById(id);
    if(el) el.remove(); 
    delete batchNgData[id]; 
};

window.openNgModal = function(rowId) {
    currentRowIdForNg = rowId;
    const modal = document.getElementById('modal-ng');
    const list = document.getElementById('modal-ng-list');
    list.innerHTML = '';
    
    ngSymptoms.forEach(s => {
        const existing = batchNgData[rowId].find(x => x.type === s);
        const val = existing ? existing.qty : '';
        const remark = existing ? existing.remark : '';
        window.renderNgItem(list, s, val, remark);
    });

    const customItems = batchNgData[rowId].filter(x => !ngSymptoms.some(s => s.toLowerCase() === x.type.toLowerCase()));
    customItems.forEach(item => { 
        window.renderNgItem(list, item.type, item.qty, item.remark, true); 
    });

    modal.classList.remove('hidden');
};

window.renderNgItem = function(container, label, qty, remark, isCustom=false) {
    const div = document.createElement('div'); 
    div.className = "border-b pb-2 mb-2 ng-item-row";
    
    const typeInput = isCustom 
        ? `<input type="text" class="ng-type-name w-full p-1 border rounded text-sm font-bold text-red-700 mb-1" value="${label}" placeholder="ระบุชื่ออาการ...">` 
        : `<span class="text-sm font-medium text-gray-700 ng-type-label" data-label="${label}">${label}</span>`;
    
    div.innerHTML = `
        <div class="flex justify-between items-center mb-1">
            <div class="flex-1">${typeInput}</div>
            <div class="flex items-center ml-2">
                <input type="number" class="ng-input-qty w-20 p-1 border rounded text-right" value="${qty}" placeholder="0.00" min="0" step="0.01">
                <span class="text-xs text-gray-500 ml-1">Kg</span>
            </div>
        </div>
        <input type="text" class="ng-input-remark w-full p-1 border rounded text-xs bg-gray-50" value="${remark}" placeholder="หมายเหตุ...">
    `;
    container.appendChild(div);
};

window.addCustomNgField = function() { 
    const list = document.getElementById('modal-ng-list'); 
    window.renderNgItem(list, "", "", "", true); 
    list.scrollTop = list.scrollHeight; 
};

window.saveCurrentNgInputs = function() {
    if(!currentRowIdForNg) return;
    const rows = document.querySelectorAll('.ng-item-row');
    const newData = [];
    let total = 0;

    rows.forEach(row => {
        let type = "";
        const labelSpan = row.querySelector('.ng-type-label');
        const nameInput = row.querySelector('.ng-type-name');
        if (labelSpan) type = labelSpan.dataset.label; 
        else if (nameInput) type = nameInput.value.trim();
        
        const qty = parseFloat(row.querySelector('.ng-input-qty').value);
        const remark = row.querySelector('.ng-input-remark').value;
        if (type && qty > 0) { 
            newData.push({ type: capitalizeFirst(type), qty, remark }); 
            total += qty; 
        }
    });

    batchNgData[currentRowIdForNg] = newData;
    const badge = document.getElementById(`ng-badge-${currentRowIdForNg}`);
    const fgInput = document.querySelector(`#${currentRowIdForNg} input[name="fgAmount"]`);
    
    if(total > 0) { 
        badge.innerText = total.toFixed(2); 
        badge.classList.remove('hidden'); 
        if (fgInput) {
            fgInput.value = 0;
            fgInput.readOnly = true;
            fgInput.classList.remove('bg-green-50', 'text-green-600', 'focus:bg-white');
            fgInput.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed', 'opacity-60');
            fgInput.title = "ช่องนี้ถูกล็อคเนื่องจากมีการลง NG (หากต้องการลง FG กรุณาเพิ่มรายการใหม่)";
        }
    } else { 
        badge.classList.add('hidden'); 
        if (fgInput && fgInput.readOnly) {
            fgInput.readOnly = false;
            fgInput.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed', 'opacity-60');
            fgInput.classList.add('bg-green-50', 'text-green-600', 'focus:bg-white');
            fgInput.title = "";
        }
    }
};

window.closeNgModal = function(save) {
    if(save) window.saveCurrentNgInputs();
    document.getElementById('modal-ng').classList.add('hidden');
    currentRowIdForNg = null;
};

window.manageSymptomsFromModal = function() {
    window.saveCurrentNgInputs(); 
    window.manageSymptoms(); 
};

window.renderRecorderOptions = function() { 
    const select = document.getElementById('recorder'); 
    const currentVal = select.value;
    select.innerHTML = '<option value="">เลือกพนักงาน...</option>'; 
    recorderList.forEach(r => { 
        const opt = document.createElement('option'); 
        opt.value = r; 
        opt.text = r; 
        select.appendChild(opt); 
    }); 
    if (recorderList.includes(currentVal)) {
        select.value = currentVal;
    }
};

window.renderProductOptions = function() { 
    const s = document.getElementById('planProduct'); 
    if(s) s.innerHTML = productList.map(p=>`<option value="${p}">${p}</option>`).join(''); 
};

window.manageRecorders = function() { 
    currentManageType = 'recorder'; 
    window.openManageListModal('จัดการรายชื่อผู้บันทึก', recorderList); 
};

window.manageSymptoms = function() { 
    currentManageType = 'symptom'; 
    window.openManageListModal('จัดการรายการอาการ NG', ngSymptoms); 
};

window.openManageListModal = function(title, list) { 
    const modal = document.getElementById('modal-manage-list'); 
    document.getElementById('manage-list-title').innerText = title; 
    window.renderManageListContent(list); 
    modal.classList.remove('hidden'); 
};

window.renderManageListContent = function(list) { 
    const container = document.getElementById('manage-list-content'); 
    container.innerHTML = list.map((item, i) => `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded mb-1">
            <span class="text-sm font-medium text-gray-700">${item}</span>
            <button onclick="window.deleteListItem(${i})" class="text-red-500 hover:bg-red-100 px-2 py-1 rounded text-xs">🗑️ ลบ</button>
        </div>
    `).join(''); 
};

window.addNewItemToList = function() {
     const rawVal = document.getElementById('new-item-input').value.trim();
     if(!rawVal) return;
     
     if (currentManageType === 'recorder') { 
         if (!recorderList.some(r => r.toLowerCase() === rawVal.toLowerCase())) { 
             recorderList.push(rawVal); 
             localStorage.setItem('CWM_RECORDERS', JSON.stringify(recorderList)); 
             window.renderRecorderOptions(); 
             window.renderManageListContent(recorderList); 
         } 
     } else if (currentManageType === 'symptom') { 
         const stdVal = capitalizeFirst(rawVal);
         if (!ngSymptoms.some(s => s.toLowerCase() === stdVal.toLowerCase())) { 
             ngSymptoms.push(stdVal); 
             localStorage.setItem('CWM_CUSTOM_NG', JSON.stringify(ngSymptoms)); 
             window.renderManageListContent(ngSymptoms); 
             
             // 🌟 อัปเดต Dropdown RTV ทันทีที่มีการเพิ่มรายการอาการเสียใหม่ใน Modal 🌟
             if (typeof window.renderRtvSymptomsOptions === 'function') {
                 window.renderRtvSymptomsOptions();
             }
         } 
     }
     document.getElementById('new-item-input').value = '';

     if (!document.getElementById('modal-ng').classList.contains('hidden') && currentRowIdForNg) {
         window.openNgModal(currentRowIdForNg);
     }
};

window.deleteListItem = function(index) {
     if (!confirm('ยืนยันการลบรายการนี้ (ออกจาก Local)?')) return;
     
     if (currentManageType === 'recorder') { 
         recorderList.splice(index, 1); 
         localStorage.setItem('CWM_RECORDERS', JSON.stringify(recorderList)); 
         window.renderRecorderOptions(); 
         window.renderManageListContent(recorderList); 
     } else if (currentManageType === 'symptom') { 
         ngSymptoms.splice(index, 1); 
         localStorage.setItem('CWM_CUSTOM_NG', JSON.stringify(ngSymptoms)); 
         window.renderManageListContent(ngSymptoms); 
         
         // 🌟 อัปเดต Dropdown RTV ทันทีที่มีการลบรายการอาการเสียออก 🌟
         if (typeof window.renderRtvSymptomsOptions === 'function') {
             window.renderRtvSymptomsOptions();
         }
     }

     if (!document.getElementById('modal-ng').classList.contains('hidden') && currentRowIdForNg) {
         window.openNgModal(currentRowIdForNg);
     }
};

window.deleteListItem = function(index) {
     if (!confirm('ยืนยันการลบรายการนี้ (ออกจาก Local)?')) return;
     if (currentManageType === 'recorder') { 
         recorderList.splice(index, 1); 
         localStorage.setItem('CWM_RECORDERS', JSON.stringify(recorderList)); 
         window.renderRecorderOptions(); 
         window.renderManageListContent(recorderList); 
     } else if (currentManageType === 'symptom') { 
         ngSymptoms.splice(index, 1); 
         localStorage.setItem('CWM_CUSTOM_NG', JSON.stringify(ngSymptoms)); 
         window.renderManageListContent(ngSymptoms); 
     }
     if (!document.getElementById('modal-ng').classList.contains('hidden') && currentRowIdForNg) {
         window.openNgModal(currentRowIdForNg);
     }
};

window.saveListToCloud = async function() {
    const btn = document.getElementById('btn-save-cloud');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ กำลังอัปเดต...";
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    try {
        const actionName = (currentManageType === 'symptom') ? 'SAVE_NG_SYMPTOMS' : 'SAVE_RECORDERS';
        const dataList = (currentManageType === 'symptom') ? ngSymptoms : recorderList;
        const payload = { 
            action: actionName, 
            timestamp: new Date().toLocaleString('th-TH'),
            data: dataList,
            recorder: document.getElementById('recorder').value || "System"
        };
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }); 
        systemLog('UPDATE_MASTER_LIST', `บันทึก Master List: ${actionName}`);
        alert("☁️ อัปเดตข้อมูลขึ้น Cloud เรียบร้อยแล้ว!\n(ระบบจะจำรายการเหล่านี้ไปใช้กับเครื่องอื่นด้วย)");
    } catch (error) {
        alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Cloud: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};

window.closeManageListModal = function() { 
    document.getElementById('modal-manage-list').classList.add('hidden'); 
};

window.showUndoToast = function() {
    const toast = document.getElementById('undo-toast');
    const btn = document.getElementById('btn-undo-action');
    btn.innerHTML = "↩️ ยกเลิก (Undo)";
    btn.disabled = false;
    btn.classList.remove('bg-green-600', 'hover:bg-green-700');
    btn.classList.add('bg-red-600', 'hover:bg-red-700');
    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
};

window.closeUndoToast = function() {
    const toast = document.getElementById('undo-toast');
    toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    window.lastBatchId = null;
};

window.undoLastSubmit = async function() {
    if(!window.lastBatchId) return;
    const btn = document.getElementById('btn-undo-action');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ กำลังยกเลิก...";
    btn.disabled = true;
    try {
        const payload = { action: 'UNDO_BATCH_PRODUCTION', batchId: window.lastBatchId };
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }); 
        systemLog('UNDO_PRODUCTION', `ยกเลิกรายการผลิต Batch: ${window.lastBatchId}`);
        btn.innerHTML = "✅ ยกเลิกสำเร็จ!";
        btn.classList.remove('bg-red-600', 'hover:bg-red-700');
        btn.classList.add('bg-green-600', 'hover:bg-green-700');
        setTimeout(() => {
            window.closeUndoToast();
            setTimeout(() => {
                btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                btn.classList.add('bg-red-600', 'hover:bg-red-700');
            }, 500);
        }, 1500);
    } catch(e) { 
        alert("❌ เกิดข้อผิดพลาดในการยกเลิก: " + e.message); 
        btn.innerHTML = "↩️ ยกเลิก (Undo)";
        btn.disabled = false;
    } 
};

document.getElementById('productionForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn'); 
    const txt = btn.innerText;
    btn.disabled = true; 
    btn.innerText = "⏳ กำลังตรวจสอบยอดปัจจุบัน...";
    
    const fd = new FormData(e.target);
    const shiftType = document.querySelector('input[name="shift_type_toggle"]:checked').value;
    const currentRec = fd.get('recorder');
    const date = fd.get('productionDate');
    const hourSlot = fd.get('hourSlot');
    
    if(currentRec && !recorderList.some(r => r.toLowerCase() === currentRec.toLowerCase())) { 
        recorderList.push(currentRec); 
        localStorage.setItem('CWM_RECORDERS', JSON.stringify(recorderList)); 
        window.renderRecorderOptions(); 
    }
    
    const newBatchId = 'BATCH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

    const common = { 
        timestamp: new Date().toLocaleString('th-TH'), 
        productionDate: date, shift: fd.get('shift'), shiftType: shiftType, 
        recorder: currentRec, hourSlot: hourSlot, batchId: newBatchId 
    };
    
    const items = []; 
    const rowDivs = document.getElementById('batchList').children;
    let newNgTypes = [];
    
    for(let div of rowDivs) {
        const machine = div.querySelector('[name="machine"]').value;
        const product = div.querySelector('[name="productCode"]').value;
        const fg = parseInt(div.querySelector('[name="fgAmount"]').value) || 0;
        if(!machine) continue;
        const ngDetails = batchNgData[div.id] || [];
        ngDetails.forEach(ng => { 
            if (ng.type) {
                const stdType = capitalizeFirst(ng.type);
                ng.type = stdType; 
                if (!ngSymptoms.some(s => s.toLowerCase() === stdType.toLowerCase()) && !newNgTypes.some(s => s.toLowerCase() === stdType.toLowerCase())) {
                    newNgTypes.push(stdType);
                } 
            }
        });
        items.push({ machine, productCode: product, fgAmount: fg, ngDetails });
    }

    if(newNgTypes.length > 0) { 
        ngSymptoms = [...ngSymptoms, ...newNgTypes]; 
        localStorage.setItem('CWM_CUSTOM_NG', JSON.stringify(ngSymptoms)); 
    }

    if(items.length === 0) { 
        alert("กรุณาเพิ่มรายการ"); 
        btn.disabled = false; 
        btn.innerText = txt; 
        return; 
    }

    try {
        const res = await fetch(`${SCRIPT_URL}?action=GET_DASHBOARD&start=${date}&end=${date}&shift=All&shiftType=All&_t=${Date.now()}`);
        const dbData = await res.json();
        const hourIdx = dbData.hourlyLabels ? dbData.hourlyLabels.indexOf(hourSlot) : -1;
        let validationMsg = `📊 สรุปยอดผลิตในระบบ ช่วงเวลา [${hourSlot}]\n\n`;
        let hasError = false;
        let errorMsg = "";

        for (let item of items) {
            let existingFg = 0;
            if (hourIdx !== -1 && dbData.machineData && dbData.machineData[item.machine]) {
                existingFg = dbData.machineData[item.machine].hourlyFg[hourIdx] || 0;
            }
            let totalFg = existingFg + item.fgAmount;
            validationMsg += `▶ ${item.machine}:\n   - ยอดในระบบมีแล้ว: ${existingFg} ตัว\n   - กำลังบันทึกเพิ่ม: ${item.fgAmount} ตัว\n   - รวมเป็น: ${totalFg} ตัว\n\n`;

            if (totalFg > 2000) {
                hasError = true;
                errorMsg += `❌ ${item.machine}: ยอดรวม (${totalFg} ตัว) เกิน 2,000 ตัว/ชั่วโมง\n`;
            }
        }

        if (hasError) {
            alert("⚠️ ปฏิเสธการบันทึก!\n\n" + errorMsg + "\nไม่อนุญาตให้บันทึกยอด FG เกิน 2,000 ตัวในชั่วโมงเดียวกัน กรุณาตรวจสอบใหม่อีกครั้ง");
            btn.disabled = false; 
            btn.innerText = txt; 
            return; 
        }

        const confirmSave = confirm(validationMsg + "✅ ข้อมูลถูกต้อง ยืนยันที่จะบันทึกใช่หรือไม่?");
        if (!confirmSave) {
            btn.disabled = false; 
            btn.innerText = txt; 
            return; 
        }

        btn.innerText = "กำลังบันทึกข้อมูลเข้าฐานข้อมูล...";
        const payload = { action: 'SAVE_BATCH_PRODUCTION', common, items };
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }); 
        systemLog('SAVE_PRODUCTION', `บันทึกรายการผลิต ${items.length} รายการ (Batch: ${newBatchId})`);

        document.getElementById('batchList').innerHTML = ''; 
        batchNgData = {}; 
        window.addBatchRow(); 
        btn.disabled = false; 
        btn.innerText = txt;
        window.lastBatchId = newBatchId;
        window.showUndoToast();

    } catch(e) { 
        alert("Error ระหว่างตรวจสอบ: " + e.message); 
        btn.disabled = false; 
        btn.innerText = txt; 
    } 
};

document.getElementById('planningForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('planSubmitBtn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "⏳ กำลังบันทึกแผน...";
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    const fd = new FormData(e.target);
    const payload = { 
        action: 'SAVE_PLAN', 
        planDate: fd.get('planDate'), 
        product: fd.get('planProduct'), 
        shift: fd.get('planShift'), 
        qty: fd.get('planQty') 
    };
    
    try {
        await fetch(SCRIPT_URL, {method:'POST', mode:'no-cors', body:JSON.stringify(payload)}); 
        systemLog('SAVE_PLAN', `บันทึกแผนการผลิต ${fd.get('planProduct')} จำนวน ${fd.get('planQty')} ชิ้น`);
        alert("✅ บันทึกแผนสำเร็จ"); 
        e.target.reset();
        document.getElementById('planDate').value = getShiftDateStr();
    } catch (error) {
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};
