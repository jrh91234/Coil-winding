// ⚙️ ระบบจัดการอะไหล่เครื่องจักร (Parts Tracking)

let partsCache = [];
let partLocationsCache = {}; // { Part_ID: ['CWM-01', 'CWM-05', ...] }

window.openPartsManager = function() {
    document.getElementById('modal-parts-manager').classList.remove('hidden');
    window.loadPartsMaster();
};

window.loadPartsMaster = async function() {
    const tbody = document.getElementById('parts-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-400 py-4">กำลังโหลด...</td></tr>';
    try {
        // โหลด Parts_Master + Parts_Installation พร้อมกัน
        const [masterRes, instRes] = await Promise.all([
            fetch(`${SCRIPT_URL}?action=GET_PARTS_MASTER&_t=${Date.now()}`),
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'GET_PARTS_INSTALLATION' }) })
        ]);
        const masterResult = await masterRes.json();
        const instResult = await instRes.json();
        partsCache = masterResult.data || [];

        // สร้าง map: Part_ID → [machines] (เฉพาะ Active)
        partLocationsCache = {};
        (instResult.data || []).forEach(inst => {
            if (inst.Status !== 'Active') return;
            const pid = inst.Part_ID;
            if (!pid) return;
            if (!partLocationsCache[pid]) partLocationsCache[pid] = [];
            if (inst.Machine && !partLocationsCache[pid].includes(inst.Machine)) {
                partLocationsCache[pid].push(inst.Machine);
            }
        });

        renderPartsTable();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-red-500 py-4">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
};

function renderPartsTable() {
    const tbody = document.getElementById('parts-table-body');
    if (partsCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-400 py-4">ยังไม่มีข้อมูลอะไหล่ กรุณาเพิ่มรายการ</td></tr>';
        return;
    }
    let html = '';
    partsCache.forEach(p => {
        const life = parseInt(p.Life_Shots) || 0;
        const cost = parseFloat(p.Unit_Cost) || 0;
        const locations = partLocationsCache[p.Part_ID] || [];
        let locationHtml;
        if (locations.length === 0) {
            locationHtml = '<span class="text-gray-300 text-xs">-</span>';
        } else {
            locationHtml = locations.map(m =>
                `<span class="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full mr-1 mb-0.5 font-mono">${m}</span>`
            ).join('');
            locationHtml = `<div class="flex flex-wrap max-w-[180px]">${locationHtml}<span class="text-xs text-gray-500 ml-1">(${locations.length})</span></div>`;
        }
        html += `<tr class="border-b hover:bg-gray-50">
            <td class="p-2 font-mono text-xs text-gray-500">${p.Part_ID}</td>
            <td class="p-2 font-bold">${p.Part_Name || '-'}</td>
            <td class="p-2"><span class="bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5 rounded-full">${p.Category || '-'}</span></td>
            <td class="p-2 text-right font-mono">${life > 0 ? life.toLocaleString() : '-'}</td>
            <td class="p-2 text-right font-mono">${cost > 0 ? cost.toLocaleString(undefined, {minimumFractionDigits: 0}) : '-'}</td>
            <td class="p-2 text-xs text-gray-600">${p.Supplier || '-'}</td>
            <td class="p-2">${locationHtml}</td>
            <td class="p-2 text-center">
                <button onclick="window.editPart('${p.Part_ID}')" class="text-blue-600 hover:underline text-xs mr-2">✏️ แก้ไข</button>
                <button onclick="window.deletePart('${p.Part_ID}', '${(p.Part_Name || '').replace(/'/g, "\\'")}')" class="text-red-600 hover:underline text-xs">🗑️ ลบ</button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// ฟอร์มเพิ่ม/แก้ไขอะไหล่
document.getElementById('parts-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-part');
    const origText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '⏳ กำลังบันทึก...';

    const editId = document.getElementById('parts-edit-id').value;
    const payload = {
        action: editId ? 'SAVE_PARTS_MASTER' : 'SAVE_PARTS_MASTER',
        mode: editId ? 'edit' : 'new',
        part: {
            Part_ID: editId || '',
            Part_Name: document.getElementById('parts-name').value.trim(),
            Category: document.getElementById('parts-category').value,
            Life_Shots: document.getElementById('parts-life').value || 0,
            Unit_Cost: document.getElementById('parts-cost').value || 0,
            Supplier: document.getElementById('parts-supplier').value.trim(),
            Remark: document.getElementById('parts-remark').value.trim()
        }
    };

    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.status === 'success') {
            window.cancelPartEdit();
            window.loadPartsMaster();
        } else {
            alert('บันทึกไม่สำเร็จ: ' + (result.message || ''));
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = origText;
    }
});

window.editPart = function(partId) {
    const p = partsCache.find(x => x.Part_ID === partId);
    if (!p) return;
    document.getElementById('parts-edit-id').value = p.Part_ID;
    document.getElementById('parts-name').value = p.Part_Name || '';
    document.getElementById('parts-category').value = p.Category || 'Other';
    document.getElementById('parts-life').value = p.Life_Shots || '';
    document.getElementById('parts-cost').value = p.Unit_Cost || '';
    document.getElementById('parts-supplier').value = p.Supplier || '';
    document.getElementById('parts-remark').value = p.Remark || '';
    document.getElementById('btn-save-part').innerText = '💾 บันทึกแก้ไข';
    document.getElementById('btn-cancel-part').classList.remove('hidden');
    document.getElementById('parts-name').focus();
};

window.cancelPartEdit = function() {
    document.getElementById('parts-edit-id').value = '';
    document.getElementById('parts-form').reset();
    document.getElementById('btn-save-part').innerText = '+ เพิ่มอะไหล่';
    document.getElementById('btn-cancel-part').classList.add('hidden');
};

window.deletePart = async function(partId, partName) {
    if (!confirm(`ต้องการลบอะไหล่ "${partName}" (${partId}) ใช่หรือไม่?`)) return;
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'DELETE_PARTS_MASTER', partId: partId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            window.loadPartsMaster();
        } else {
            alert('ลบไม่สำเร็จ: ' + (result.message || ''));
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    }
};

// === ระบบติดตั้งอะไหล่ (Installation) ===
window.installPartToMachine = async function(machine, partId, partName, lifeShots, maintJobId) {
    // คำนวณ Shot ปัจจุบันของเครื่อง
    let currentShot = 0;
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_MACHINE_SHOTS', machine: machine, sinceDate: '2020-01-01' })
        });
        const result = await res.json();
        currentShot = result.totalShots || 0;
    } catch (e) { /* ใช้ 0 */ }

    const recorder = (window.currentUser && window.currentUser.name) || 'System';
    const payload = {
        action: 'SAVE_PARTS_INSTALLATION',
        mode: 'new',
        installation: {
            Machine: machine,
            Part_ID: partId,
            Part_Name: partName,
            Current_Shot: currentShot,
            Life_Shots: lifeShots,
            Maint_Job_ID: maintJobId || '',
            Recorder: recorder
        }
    };

    const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    return await res.json();
};

window.replacePartOnMachine = async function(installId, machine, partId, partName, lifeShots, maintJobId) {
    let currentShot = 0;
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_MACHINE_SHOTS', machine: machine, sinceDate: '2020-01-01' })
        });
        const result = await res.json();
        currentShot = result.totalShots || 0;
    } catch (e) { /* ใช้ 0 */ }

    const recorder = (window.currentUser && window.currentUser.name) || 'System';
    const payload = {
        action: 'SAVE_PARTS_INSTALLATION',
        mode: 'replace',
        installation: {
            Install_ID: installId,
            Machine: machine,
            Part_ID: partId,
            Part_Name: partName,
            Current_Shot: currentShot,
            Life_Shots: lifeShots,
            Maint_Job_ID: maintJobId || '',
            Recorder: recorder
        }
    };

    const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    return await res.json();
};

// === แสดงอะไหล่ของเครื่องใน Machine Detail (Tab) ===
window.loadMachineParts = async function(machine) {
    const container = document.getElementById('md-section-parts');
    if (!container) return;
    container.innerHTML = '<div class="text-center text-gray-400 py-8">⏳ กำลังโหลดข้อมูลอะไหล่...</div>';

    try {
        // โหลด Installation + Shot ปัจจุบัน พร้อมกัน
        const [instRes, shotRes] = await Promise.all([
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'GET_PARTS_INSTALLATION', machine: machine }) }),
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'GET_MACHINE_SHOTS', machine: machine, sinceDate: '2020-01-01' }) })
        ]);
        const instData = await instRes.json();
        const shotData = await shotRes.json();
        const installations = (instData.data || []).filter(x => x.Status === 'Active');
        const totalShots = shotData.totalShots || 0;

        if (installations.length === 0) {
            container.innerHTML = `<div class="text-center py-8">
                <p class="text-gray-400 mb-2">ยังไม่มีอะไหล่ที่ติดตั้งในเครื่องนี้</p>
                <p class="text-xs text-gray-400">Shot สะสม: <b>${totalShots.toLocaleString()}</b></p>
            </div>`;
            return;
        }

        let html = `<div class="text-xs text-gray-500 mb-2 px-2">Shot สะสมทั้งหมด: <b class="text-gray-800">${totalShots.toLocaleString()}</b> (FG+NG)</div>`;
        html += '<div class="space-y-2 px-2">';
        installations.forEach(inst => {
            const installShot = parseInt(inst.Install_Shot) || 0;
            const lifeShots = parseInt(inst.Life_Shots) || 0;
            const usedShots = totalShots - installShot;
            const pct = lifeShots > 0 ? Math.min((usedShots / lifeShots) * 100, 100) : 0;
            const remaining = lifeShots > 0 ? Math.max(lifeShots - usedShots, 0) : 0;

            let statusColor = 'bg-green-500'; let statusText = '🟢 ปกติ';
            if (pct >= 95) { statusColor = 'bg-red-500'; statusText = '🔴 ต้องเปลี่ยน'; }
            else if (pct >= 80) { statusColor = 'bg-yellow-500'; statusText = '🟡 ใกล้หมดอายุ'; }

            html += `<div class="border rounded-lg p-3 bg-white">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-sm">${inst.Part_Name || inst.Part_ID}</span>
                    <span class="text-xs ${pct >= 95 ? 'text-red-600 font-bold' : pct >= 80 ? 'text-yellow-600 font-bold' : 'text-green-600'}">${statusText}</span>
                </div>
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span>ติดตั้ง: ${inst.Install_Date || '-'}</span>
                    <span>ใช้ไป: <b>${usedShots.toLocaleString()}</b> / ${lifeShots > 0 ? lifeShots.toLocaleString() : '∞'} shot</span>
                </div>
                ${lifeShots > 0 ? `<div class="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div class="${statusColor} h-2 rounded-full transition-all" style="width: ${pct.toFixed(1)}%"></div>
                </div>
                <div class="flex justify-between text-xs text-gray-400">
                    <span>${pct.toFixed(1)}%</span>
                    <span>เหลือ: ${remaining.toLocaleString()} shot</span>
                </div>` : ''}
                <div class="flex gap-2 mt-2">
                    <button onclick="window.promptReplacepart('${inst.Install_ID}', '${machine}', '${inst.Part_ID}', '${(inst.Part_Name || '').replace(/'/g, "\\'")}', ${lifeShots})" class="text-xs text-orange-600 hover:underline">🔄 เปลี่ยนอะไหล่</button>
                    <button onclick="window.promptUpdateLife('${inst.Install_ID}', ${lifeShots})" class="text-xs text-blue-600 hover:underline">📏 ปรับอายุ</button>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<div class="text-center text-red-500 py-4">โหลดข้อมูลไม่สำเร็จ: ' + err.message + '</div>';
    }
};

window.promptReplacepart = async function(installId, machine, partId, partName, lifeShots) {
    if (!confirm(`เปลี่ยนอะไหล่ "${partName}" ของ ${machine}?\nระบบจะบันทึก Shot ปัจจุบันและสร้างรายการใหม่`)) return;
    try {
        const result = await window.replacePartOnMachine(installId, machine, partId, partName, lifeShots, '');
        if (result.status === 'success') {
            alert('✅ เปลี่ยนอะไหล่สำเร็จ');
            window.loadMachineParts(machine);
        } else {
            alert('เกิดข้อผิดพลาด: ' + (result.message || ''));
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    }
};

window.promptUpdateLife = async function(installId, currentLife) {
    const newLife = prompt(`ปรับอายุการใช้งาน (Shot):\nค่าปัจจุบัน: ${currentLife.toLocaleString()}`, currentLife);
    if (newLife === null) return;
    const val = parseInt(newLife);
    if (isNaN(val) || val < 0) { alert('กรุณาใส่ตัวเลขที่ถูกต้อง'); return; }
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'UPDATE_PARTS_LIFE', installId: installId, lifeShots: val })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert('✅ ปรับอายุสำเร็จ');
            // reload the tab
            const macTitle = document.getElementById('machine-detail-title');
            if (macTitle) {
                const mac = macTitle.innerText.match(/CWM-\d+/);
                if (mac) window.loadMachineParts(mac[0]);
            }
        } else {
            alert('เกิดข้อผิดพลาด: ' + (result.message || ''));
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    }
};
