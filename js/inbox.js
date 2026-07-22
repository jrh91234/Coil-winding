// === 📬 Inbox — Email-client style task center ===
let inboxData = null;
let inboxActiveCategory = 'all';

window.inboxCloseJob = function(jobId) {
    const job = inboxData && inboxData.categories.maintenance.find(m => m.jobId === jobId);
    if (!job) { alert('ไม่พบข้อมูลงาน ' + jobId); return; }
    if (typeof window.openMaintenanceModal === 'function') window.openMaintenanceModal();
    if (typeof window.loadPendingJob === 'function') window.loadPendingJob(job);
};

window.loadInbox = async function() {
    const container = document.getElementById('inbox-content');
    const sidebar = document.getElementById('inbox-sidebar');
    if (!container) return;

    const user = window.currentUser;
    if (!user) {
        container.innerHTML = '<div class="flex items-center justify-center h-64 text-gray-400">กรุณา Login ก่อนใช้งาน Inbox</div>';
        return;
    }

    container.innerHTML = '<div class="flex items-center justify-center h-64 text-gray-400 animate-pulse">⏳ กำลังโหลดข้อมูล...</div>';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_INBOX', role: user.role, userName: user.name })
        });
        inboxData = await res.json();
        if (inboxData.status !== 'success') throw new Error(inboxData.message || 'Unknown error');
        renderInboxSidebar();
        renderInboxList('all');
        updateInboxBadge(inboxData.counts.total);
    } catch (err) {
        container.innerHTML = `<div class="flex items-center justify-center h-64 text-red-500">❌ โหลดไม่สำเร็จ: ${err.message}</div>`;
    }
};

function updateInboxBadge(count) {
    const badge = document.getElementById('inbox-badge');
    const badgeMobile = document.getElementById('inbox-badge-mobile');
    [badge, badgeMobile].forEach(b => {
        if (!b) return;
        if (count > 0) {
            b.innerText = count > 99 ? '99+' : count;
            b.classList.remove('hidden');
        } else {
            b.classList.add('hidden');
        }
    });
}

function renderInboxSidebar() {
    const sidebar = document.getElementById('inbox-sidebar');
    if (!sidebar || !inboxData) return;
    const c = inboxData.counts;
    const role = (window.currentUser && window.currentUser.role) || '';

    const cats = [
        { key: 'all', icon: '📥', label: 'ทั้งหมด', count: c.total, color: 'blue' },
        { key: 'maintenance', icon: '⚡', label: 'งานซ่อมค้าง', count: c.maintenance, color: 'orange' },
        { key: 'pmTasks', icon: '📋', label: 'แผน PM', count: c.pmTasks, color: 'indigo' },
        { key: 'partsCheck', icon: '🔍', label: 'อะไหล่รอเช็ค', count: c.partsCheck, color: 'amber' },
        { key: 'partsNearEnd', icon: '🔴', label: 'ใกล้หมดอายุ', count: c.partsNearEnd, color: 'red' },
    ];
    if (role === 'QC' || role === 'Admin') {
        cats.push({ key: 'sortingWaitQC', icon: '🗂️', label: 'Sort รอ QC', count: c.sortingWaitQC, color: 'pink' });
    }

    sidebar.innerHTML = cats.map(cat => {
        const active = inboxActiveCategory === cat.key;
        const bg = active ? `bg-${cat.color}-50 border-${cat.color}-500 text-${cat.color}-800` : 'border-transparent text-gray-600 hover:bg-gray-50';
        return `<button onclick="window.filterInbox('${cat.key}')" class="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium border-l-4 ${bg} transition-all rounded-r-lg">
            <span class="flex items-center gap-2">${cat.icon} ${cat.label}</span>
            ${cat.count > 0 ? `<span class="bg-${cat.color}-100 text-${cat.color}-700 text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">${cat.count}</span>` : ''}
        </button>`;
    }).join('');

    sidebar.innerHTML += `<div class="border-t mt-3 pt-3">
        <button onclick="window.showPmGantt()" class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all">
            📊 Gantt Chart PM
        </button>
    </div>`;
}

window.filterInbox = function(category) {
    inboxActiveCategory = category;
    renderInboxSidebar();
    renderInboxList(category);
};

function renderInboxList(category) {
    const container = document.getElementById('inbox-content');
    if (!container || !inboxData) return;
    const cats = inboxData.categories;
    let items = [];

    if (category === 'all') {
        cats.maintenance.forEach(m => items.push({ type: 'maintenance', data: m, priority: m.daysAgo >= 3 ? 1 : 2 }));
        (cats.pmTasks || []).forEach(p => items.push({ type: 'pmTasks', data: p, priority: p.daysOverdue >= 3 ? 1 : 2 }));
        cats.partsCheck.forEach(p => items.push({ type: 'partsCheck', data: p, priority: 1 }));
        cats.partsNearEnd.forEach(p => items.push({ type: 'partsNearEnd', data: p, priority: p.pct >= 95 ? 1 : 3 }));
        cats.sortingWaitQC.forEach(s => items.push({ type: 'sortingWaitQC', data: s, priority: 2 }));
        items.sort((a, b) => a.priority - b.priority);
    } else if (cats[category]) {
        cats[category].forEach(d => items.push({ type: category, data: d }));
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-gray-400">
            <div class="text-5xl mb-3">✅</div>
            <div class="text-lg font-bold">ไม่มีรายการค้าง</div>
            <div class="text-sm">หมวดนี้ว่างเปล่า — ทุกอย่างเรียบร้อย</div>
        </div>`;
        return;
    }

    container.innerHTML = items.map((item, idx) => renderInboxItem(item, idx)).join('');
}

function renderInboxItem(item, idx) {
    const d = item.data;
    switch (item.type) {
        case 'maintenance': return renderMaintenanceItem(d, idx);
        case 'pmTasks': return renderPmTaskItem(d, idx);
        case 'partsCheck': return renderPartsCheckItem(d, idx);
        case 'partsNearEnd': return renderPartsNearEndItem(d, idx);
        case 'sortingWaitQC': return renderSortingItem(d, idx);
        default: return '';
    }
}

function renderMaintenanceItem(d) {
    const urgency = d.daysAgo >= 3 ? 'border-l-red-500 bg-red-50/30' : d.daysAgo >= 1 ? 'border-l-orange-500' : 'border-l-yellow-400';
    const daysLabel = d.daysAgo === 0 ? 'วันนี้' : `ค้าง ${d.daysAgo} วัน`;
    return `<div class="border-l-4 ${urgency} bg-white rounded-r-lg shadow-sm p-4 mb-2 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg">⚡</span>
                    <span class="font-bold text-gray-800 text-sm">${d.jobId}</span>
                    <span class="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-mono">${d.machine}</span>
                    <span class="text-[10px] ${d.daysAgo >= 3 ? 'text-red-600 font-bold' : 'text-orange-600'}">${daysLabel}</span>
                </div>
                <div class="text-sm text-gray-700 font-medium">${d.issueType}</div>
                <div class="text-xs text-gray-500 mt-1 truncate">${d.remark || '-'}</div>
                <div class="text-[10px] text-gray-400 mt-1">แจ้งโดย: ${d.recorder} · ${d.date} ${d.startTime}</div>
            </div>
            <div class="flex flex-col gap-1 ml-3 shrink-0">
                <button onclick="window.inboxCloseJob('${d.jobId}')" class="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 font-bold">✅ ปิดงาน</button>
            </div>
        </div>
    </div>`;
}

function renderPartsCheckItem(d) {
    const escName = (d.partName || '').replace(/'/g, "\\'");
    const reasonBadge = d.checkReason === 'overdue_life'
        ? `<span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold" title="ใช้งานเกินอายุที่คำนวณได้แล้ว (${d.pct}%) จึงเข้าคิวตรวจเช็คทันที แม้ยังไม่ถึง Next Check ที่ตั้งไว้">🔴 เกินอายุใช้งาน (${d.pct}%)</span>`
        : `<span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold" title="ใช้งานถึงรอบ Next Check ที่ตั้งไว้แล้ว">🟡 ถึงรอบตรวจตามกำหนด</span>`;
    return `<div class="border-l-4 border-l-amber-500 bg-white rounded-r-lg shadow-sm p-4 mb-2 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="text-lg">🔍</span>
                    <span class="font-bold text-gray-800 text-sm">${d.partName}</span>
                    <span class="text-[10px] text-gray-400 font-mono">(${d.partId})</span>
                    <span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-mono">${d.machine}</span>
                    ${reasonBadge}
                </div>
                <div class="text-xs text-gray-600">Actual: <b class="text-amber-700">${Number(d.actualShots).toLocaleString()}</b> / Next Check: <b>${Number(d.nextCheckShot).toLocaleString()}</b> shot</div>
                <div class="text-xs text-gray-500 mt-0.5">Life: ${d.lifeShots > 0 ? Number(d.lifeShots).toLocaleString() : '∞'} · ตรวจแล้ว ${d.checkCount} ครั้ง</div>
            </div>
            <div class="flex flex-col gap-1 ml-3 shrink-0">
                <button onclick="window.openCheckPartDialog('${d.installId}', '${d.partId}', '${escName}', '${d.machine}', ${d.actualShots}, ${d.lifeShots}, ${d.nextCheckShot}, 0)" class="text-xs bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 font-bold">🔍 ตรวจเช็ค</button>
                <button onclick="window.showCheckHistory('${d.installId}', '${escName}', '${d.partId}')" class="text-xs text-gray-500 hover:underline">📋 ประวัติ</button>
            </div>
        </div>
    </div>`;
}

function renderPartsNearEndItem(d) {
    const isOver95 = d.pct >= 95;
    const borderColor = isOver95 ? 'border-l-red-600' : 'border-l-red-400';
    const pctColor = isOver95 ? 'text-red-700 font-black' : 'text-red-600 font-bold';
    const escName = (d.partName || '').replace(/'/g, "\\'");
    return `<div class="border-l-4 ${borderColor} bg-white rounded-r-lg shadow-sm p-4 mb-2 hover:shadow-md transition-shadow ${isOver95 ? 'bg-red-50/40' : ''}">
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg">${isOver95 ? '🔴' : '🟡'}</span>
                    <span class="font-bold text-gray-800 text-sm">${d.partName}</span>
                    <span class="text-[10px] text-gray-400 font-mono">(${d.partId})</span>
                    <span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-mono">${d.machine}</span>
                </div>
                <div class="text-xs text-gray-600">Actual: <b class="${pctColor}">${Number(d.actualShots).toLocaleString()}</b> / Life: <b>${Number(d.effectiveLife || d.lifeShots).toLocaleString()}</b> shot${d.checkCount > 0 ? ` <span class="text-green-600">(ตรวจผ่าน ${d.checkCount} ครั้ง)</span>` : ''}</div>
                <div class="mt-1 w-full bg-gray-200 rounded-full h-2">
                    <div class="h-2 rounded-full ${isOver95 ? 'bg-red-600' : 'bg-yellow-500'}" style="width: ${Math.min(d.pct, 100)}%"></div>
                </div>
                <div class="text-[10px] ${pctColor} mt-0.5">${d.pct}% ของอายุใช้งาน</div>
            </div>
            <div class="flex flex-col gap-1 ml-3 shrink-0">
                <button onclick="window.promptReplacepart('${d.installId}', '${d.machine}', '${d.partId}', '${escName}', ${d.lifeShots})" class="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-bold">🔄 เปลี่ยน</button>
            </div>
        </div>
    </div>`;
}

function renderSortingItem(d) {
    return `<div class="border-l-4 border-l-pink-500 bg-white rounded-r-lg shadow-sm p-4 mb-2 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg">🗂️</span>
                    <span class="font-bold text-gray-800 text-sm">${d.jobId}</span>
                    <span class="bg-pink-100 text-pink-700 text-[10px] px-2 py-0.5 rounded-full">${d.product}</span>
                </div>
                <div class="text-xs text-gray-600">อาการ: <b>${d.symptom}</b> · จำนวน: ${d.qty}</div>
                <div class="text-xs text-gray-500 mt-0.5">ผู้คัด: ${d.sorter || '-'} · FG: ${d.fgQty || '-'} / NG: ${d.ngQty || '-'}</div>
            </div>
            <div class="flex flex-col gap-1 ml-3 shrink-0">
                <span class="text-xs bg-pink-100 text-pink-700 px-3 py-1 rounded font-bold text-center">⏳ รอ QC</span>
            </div>
        </div>
    </div>`;
}

function renderPmTaskItem(d) {
    const urgency = d.daysOverdue >= 3 ? 'border-l-red-500 bg-red-50/30' : d.daysOverdue >= 1 ? 'border-l-indigo-500' : 'border-l-indigo-400';
    const daysLabel = d.daysOverdue === 0 ? 'ถึงกำหนดวันนี้' : `เกินกำหนด ${d.daysOverdue} วัน`;
    const thumb = d.photoUrl && typeof getThumbUrl === 'function' ? getThumbUrl(d.photoUrl) : null;
    const photoHtml = thumb
        ? `<img src="${thumb}" onclick="window.open('${d.photoUrl}', '_blank')" onerror="this.style.display='none'" class="w-14 h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0" title="แนบรูปอ้างอิง คลิกเพื่อดูขนาดเต็ม">`
        : '';
    return `<div class="border-l-4 ${urgency} bg-white rounded-r-lg shadow-sm p-4 mb-2 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg">📋</span>
                    <span class="font-bold text-gray-800 text-sm">${d.taskName}</span>
                    <span class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full">${d.planType}</span>
                    <span class="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-mono">${d.machine}</span>
                </div>
                <div class="text-xs text-gray-600">กำหนด: <b>${d.dueDate}</b> · <span class="${d.daysOverdue >= 3 ? 'text-red-600 font-bold' : 'text-indigo-600'}">${daysLabel}</span></div>
                <div class="text-[10px] text-gray-400 mt-1">ความถี่: ${d.frequency} · ${d.planId}${d.note ? ' · ' + d.note : ''}</div>
                ${d.instruction ? `<div class="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-2 whitespace-pre-line">📝 ${d.instruction}</div>` : ''}
            </div>
            ${photoHtml}
            <div class="flex flex-col gap-1 ml-1 shrink-0">
                <button onclick="window.openPmCompleteModal('${d.planId}')" class="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 font-bold">📸 ทำเสร็จ</button>
            </div>
        </div>
    </div>`;
}

window.openPmCompleteModal = function(planId) {
    const task = inboxData && inboxData.categories.pmTasks.find(t => t.planId === planId);
    if (!task) { alert('ไม่พบแผน ' + planId); return; }
    const html = `<div id="modal-pm-complete" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white w-full max-w-sm rounded-xl shadow-2xl p-5">
            <h3 class="text-lg font-bold mb-3">📸 ยืนยันทำเสร็จ</h3>
            <div class="bg-indigo-50 p-3 rounded-lg mb-3 text-sm">
                <div class="font-bold text-indigo-800">${task.taskName}</div>
                <div class="text-indigo-600 text-xs">${task.machine} · ${task.planType} · กำหนด ${task.dueDate}</div>
                ${task.instruction ? `<div class="text-gray-700 text-xs mt-2 whitespace-pre-line">📝 ${task.instruction}</div>` : ''}
                ${task.photoUrl ? `<a href="${task.photoUrl}" target="_blank" class="inline-block mt-2 text-xs font-bold text-indigo-700 underline">📸 ดูรูปอ้างอิงวิธีทำ</a>` : ''}
            </div>
            <div class="mb-3">
                <label class="block text-sm font-bold text-gray-700 mb-1">📸 แนบรูปถ่าย (บังคับ)</label>
                <input type="file" id="pm-photo" accept="image/*" required class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer">
                <div id="pm-photo-preview" class="mt-2 hidden rounded-lg overflow-hidden border"><img id="pm-photo-img" src="" class="w-full max-h-40 object-contain bg-black"></div>
            </div>
            <div class="mb-3">
                <label class="block text-sm font-bold text-gray-700 mb-1">หมายเหตุ</label>
                <textarea id="pm-note" rows="2" class="w-full p-2 border rounded-lg text-sm" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
            </div>
            <div class="flex gap-2">
                <button onclick="document.getElementById('modal-pm-complete').remove()" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-xl font-bold hover:bg-gray-300">ยกเลิก</button>
                <button onclick="window.submitPmComplete('${planId}')" id="btn-pm-submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700">📸 ยืนยัน</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('pm-photo').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            document.getElementById('pm-photo-img').src = ev.target.result;
            document.getElementById('pm-photo-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });
};

window.submitPmComplete = async function(planId) {
    const photoInput = document.getElementById('pm-photo');
    if (!photoInput || !photoInput.files[0]) { alert('กรุณาแนบรูปถ่าย'); return; }
    const btn = document.getElementById('btn-pm-submit');
    btn.disabled = true; btn.innerHTML = '⏳ กำลังบันทึก...';

    let imageBase64 = '';
    try {
        const file = photoInput.files[0];
        imageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
    } catch (e) { alert('อ่านรูปไม่ได้'); btn.disabled = false; btn.innerHTML = '📸 ยืนยัน'; return; }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'COMPLETE_PM_TASK',
                planId: planId,
                username: window.currentUser?.name || window.currentUser?.username || 'Unknown',
                role: window.currentUser?.role || '',
                note: document.getElementById('pm-note').value,
                imageBase64: imageBase64
            })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert(result.message);
            document.getElementById('modal-pm-complete')?.remove();
            window.loadInbox();
        } else {
            alert('Error: ' + result.message);
            btn.disabled = false; btn.innerHTML = '📸 ยืนยัน';
        }
    } catch (e) { alert('บันทึกไม่สำเร็จ: ' + e.message); btn.disabled = false; btn.innerHTML = '📸 ยืนยัน'; }
};

function escapePmAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.deletePmPlan = async function(btn) {
    const planId = btn.dataset.planId;
    const taskName = btn.dataset.taskName;
    const machine = btn.dataset.machine;
    if (!planId) return;
    if (!confirm(`ยืนยันลบแผน PM นี้?\n\n${taskName} (${machine})\n\nการลบนี้ไม่สามารถย้อนกลับได้`)) return;

    btn.disabled = true;
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'DELETE_PM_PLAN',
                planId,
                username: window.currentUser?.username || window.currentUser?.name || '',
                role: window.currentUser?.role || ''
            })
        });
        const result = await res.json();
        if (result.status !== 'success') throw new Error(result.message || 'ลบไม่สำเร็จ');
        window.showPmGantt();
    } catch (e) {
        alert('❌ เกิดข้อผิดพลาด: ' + e.message);
        btn.disabled = false;
    }
};

// === เพิ่มแผน PM จากหน้า Gantt Chart ===
window.openAddPmPlanModal = function() {
    const macGrid = document.getElementById('pmplan-machine-grid');
    if (macGrid) {
        let html = '';
        for (let i = 1; i <= 16; i++) {
            const mac = `CWM-${String(i).padStart(2, '0')}`;
            html += `<label class="flex items-center gap-1 text-xs font-medium text-gray-700 cursor-pointer">
                <input type="checkbox" value="${mac}" class="pmplan-machine-cb accent-indigo-600"> ${mac}
            </label>`;
        }
        macGrid.innerHTML = html;
    }
    const dueInput = document.getElementById('pmplan-nextdue');
    if (dueInput) dueInput.value = getShiftDateStr();
    const taskInput = document.getElementById('pmplan-taskname');
    if (taskInput) taskInput.value = '';
    const assignedInput = document.getElementById('pmplan-assignedto');
    if (assignedInput) assignedInput.value = '';
    const noteInput = document.getElementById('pmplan-note');
    if (noteInput) noteInput.value = '';
    const instructionInput = document.getElementById('pmplan-instruction');
    if (instructionInput) instructionInput.value = '';
    const intervalInput = document.getElementById('pmplan-interval');
    if (intervalInput) intervalInput.value = '';
    document.getElementById('pmplan-interval-wrap').classList.add('hidden');
    const photoInput = document.getElementById('pmplan-photo');
    if (photoInput) photoInput.value = '';
    document.getElementById('pmplan-photo-preview').classList.add('hidden');

    document.getElementById('modal-add-pm-plan').classList.remove('hidden');
};

window.togglePmPlanMachineAll = function() {
    const boxes = document.querySelectorAll('.pmplan-machine-cb');
    const allChecked = Array.from(boxes).every(b => b.checked);
    boxes.forEach(b => b.checked = !allChecked);
};

// บีบอัดรูปภาพให้เล็กกว่า maxSizeKB ก่อนส่งขึ้น backend
function compressPmPlanImage(file, maxSizeKB) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                const MAX_DIMENSION = 1200;
                if (width > height && width > MAX_DIMENSION) { height *= MAX_DIMENSION / width; width = MAX_DIMENSION; }
                else if (height > MAX_DIMENSION) { width *= MAX_DIMENSION / height; height = MAX_DIMENSION; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                let quality = 0.8;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                while (Math.round((dataUrl.length * 3 / 4) / 1024) > maxSizeKB && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

window.submitAddPmPlan = async function() {
    const machines = Array.from(document.querySelectorAll('.pmplan-machine-cb:checked')).map(b => b.value);
    const planType = document.getElementById('pmplan-type').value;
    const frequency = document.getElementById('pmplan-frequency').value;
    const intervalValue = document.getElementById('pmplan-interval').value;
    const taskName = document.getElementById('pmplan-taskname').value.trim();
    const nextDueDate = document.getElementById('pmplan-nextdue').value;
    const assignedTo = document.getElementById('pmplan-assignedto').value.trim();
    const note = document.getElementById('pmplan-note').value.trim();
    const instruction = document.getElementById('pmplan-instruction').value.trim();
    const photoFile = document.getElementById('pmplan-photo').files[0];

    if (machines.length === 0 || !taskName || !nextDueDate) {
        alert('กรุณาเลือกเครื่องจักรอย่างน้อย 1 เครื่อง และกรอกชื่องาน กับวันที่ครบกำหนดให้ครบ');
        return;
    }
    if (frequency === 'Custom' && !intervalValue) {
        alert('กรุณาระบุจำนวนวันสำหรับความถี่แบบกำหนดเอง');
        return;
    }

    const btn = document.getElementById('pmplan-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;

    let imageBase64 = '';
    if (photoFile) {
        try {
            btn.innerHTML = '⏳ กำลังบีบอัดรูปภาพ...';
            imageBase64 = await compressPmPlanImage(photoFile, 256);
        } catch (e) {
            alert('❌ ไม่สามารถประมวลผลไฟล์ภาพได้ กรุณาลองใหม่อีกครั้ง');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
    }

    btn.innerHTML = '⏳ กำลังบันทึก...';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'ADD_PM_PLAN',
                machines, planType, taskName, frequency,
                intervalValue: intervalValue || 0,
                nextDueDate, assignedTo, note, instruction, imageBase64,
                username: window.currentUser?.username || window.currentUser?.name || '',
                role: window.currentUser?.role || ''
            })
        });
        const result = await res.json();
        if (result.status !== 'success') throw new Error(result.message || 'บันทึกไม่สำเร็จ');

        document.getElementById('modal-add-pm-plan').classList.add('hidden');
        window.showPmGantt();
    } catch (e) {
        alert('❌ เกิดข้อผิดพลาด: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// === Gantt Chart ===
window.showPmGantt = async function() {
    const container = document.getElementById('inbox-content');
    if (!container) return;
    container.innerHTML = '<div class="flex items-center justify-center h-64 text-gray-400 animate-pulse">⏳ กำลังโหลดข้อมูล Gantt...</div>';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_PM_SUMMARY' })
        });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message);
        renderGanttChart(container, data);
    } catch (e) {
        container.innerHTML = `<div class="text-red-500 text-center py-8">โหลดไม่สำเร็จ: ${e.message}</div>`;
    }
};

function renderGanttChart(container, data) {
    const { plans, logs, stats } = data;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // หาช่วงเวลาอัตโนมัติจากข้อมูลจริง (minimum ±14 วัน)
    const toDateEarly = (s) => { const d = new Date(s + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; };
    let minDate = new Date(today), maxDate = new Date(today);
    plans.forEach(p => {
        const nd = toDateEarly(p.nextDueDate);
        const ld = toDateEarly(p.lastDoneDate);
        if (nd && nd < minDate) minDate = new Date(nd);
        if (nd && nd > maxDate) maxDate = new Date(nd);
        if (ld && ld < minDate) minDate = new Date(ld);
        if (ld && ld > maxDate) maxDate = new Date(ld);
    });
    logs.forEach(l => {
        const dd = toDateEarly(l.doneDate);
        if (dd && dd < minDate) minDate = new Date(dd);
        if (dd && dd > maxDate) maxDate = new Date(dd);
    });
    const padBefore = Math.max(14, Math.round((today - minDate) / 86400000) + 7);
    const padAfter = Math.max(14, Math.round((maxDate - today) / 86400000) + 7);
    const startDate = new Date(today); startDate.setDate(startDate.getDate() - padBefore);
    const endDate = new Date(today); endDate.setDate(endDate.getDate() + padAfter);
    const totalDays = padBefore + padAfter + 1;
    const todayIndex = padBefore;

    const toDate = (s) => { const d = new Date(s + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; };
    const dayIndex = (d) => Math.round((d - startDate) / 86400000);

    // เลื่อนวันที่ไปตามความถี่ของแผน (ใช้ตรรกะเดียวกับฝั่ง backend ตอนปิดงาน PM)
    const stepByFrequency = (date, frequency, intervalValue) => {
        const d = new Date(date);
        const freq = String(frequency || '').trim().toLowerCase();
        if (freq === 'daily') d.setDate(d.getDate() + 1);
        else if (freq === 'weekly') d.setDate(d.getDate() + 7);
        else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
        else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
        else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
        else d.setDate(d.getDate() + (intervalValue || 30));
        return d;
    };

    // ปุ่มเพิ่มแผน PM
    let statsHtml = `<div class="flex justify-end mb-3">
        <button onclick="window.openAddPmPlanModal()" class="bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-1">
            ➕ เพิ่มแผน PM
        </button>
    </div>`;

    // Stats cards
    statsHtml += `<div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <div class="bg-blue-50 rounded-lg p-3 text-center"><div class="text-2xl font-bold text-blue-700">${stats.total}</div><div class="text-xs text-blue-600">งานทั้งหมด</div></div>
        <div class="bg-green-50 rounded-lg p-3 text-center"><div class="text-2xl font-bold text-green-700">${stats.onTime}</div><div class="text-xs text-green-600">ตรงเวลา</div></div>
        <div class="bg-red-50 rounded-lg p-3 text-center"><div class="text-2xl font-bold text-red-700">${stats.late}</div><div class="text-xs text-red-600">ช้ากว่ากำหนด</div></div>
        <div class="bg-orange-50 rounded-lg p-3 text-center"><div class="text-2xl font-bold text-orange-700">${stats.overdue}</div><div class="text-xs text-orange-600">ค้าง (ยังไม่ทำ)</div></div>
        <div class="bg-indigo-50 rounded-lg p-3 text-center"><div class="text-2xl font-bold text-indigo-700">${stats.adherencePct}%</div><div class="text-xs text-indigo-600">On-time Rate</div></div>
    </div>`;

    // สร้าง header วันที่
    const months = [];
    const dayHeaders = [];
    let prevMonth = '';
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate); d.setDate(d.getDate() + i);
        const monthLabel = d.toLocaleDateString('th-TH', { month: 'short' });
        if (monthLabel !== prevMonth) { months.push({ label: monthLabel, start: i, span: 0 }); prevMonth = monthLabel; }
        months[months.length - 1].span++;
        const isToday = d.getTime() === today.getTime();
        const isSun = d.getDay() === 0;
        dayHeaders.push(`<div class="inline-block text-center" style="width:20px;min-width:20px"><div class="text-[8px] ${isToday ? 'bg-indigo-600 text-white rounded-full font-bold' : isSun ? 'text-red-400' : 'text-gray-400'}">${d.getDate()}</div></div>`);
    }
    const monthRow = months.map(m => `<div class="inline-block text-center text-[9px] font-bold text-gray-500 border-b" style="width:${m.span * 20}px">${m.label}</div>`).join('');

    // สร้างแถว Gantt ต่อ plan
    const planRows = plans.map(plan => {
        const planLogs = logs.filter(l => l.planId === plan.planId);
        const nextDue = toDate(plan.nextDueDate);
        const lastDone = toDate(plan.lastDoneDate);

        // คาดการณ์รอบถัดๆ ไปตามความถี่ของแผน (เพื่อให้เห็นรอบ Weekly/Monthly ฯลฯ ล่วงหน้าในกราฟ)
        const projectedDueTimes = new Set();
        if (nextDue) {
            let pd = new Date(nextDue);
            let guard = 0;
            while (guard < 200) {
                pd = stepByFrequency(pd, plan.frequency, plan.intervalValue);
                if (pd > endDate) break;
                projectedDueTimes.add(pd.getTime());
                guard++;
            }
        }

        let cells = '';
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate); d.setDate(d.getDate() + i);
            const isToday = d.getTime() === today.getTime();
            let bg = '';
            let marker = '';

            // due date marker
            if (nextDue && d.getTime() === nextDue.getTime()) {
                marker = `<div class="absolute inset-0 flex items-center justify-center"><div class="w-3 h-3 rounded-full ${isToday ? 'bg-indigo-600' : d < today ? 'bg-red-500' : 'bg-blue-500'} border-2 border-white shadow"></div></div>`;
            } else if (projectedDueTimes.has(d.getTime())) {
                marker = `<div class="absolute inset-0 flex items-center justify-center" title="กำหนดถัดไป (คาดการณ์)"><div class="w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-300"></div></div>`;
            }

            // log markers
            planLogs.forEach(l => {
                const doneD = toDate(l.doneDate);
                if (doneD && d.getTime() === doneD.getTime()) {
                    const color = l.status === 'Approved' ? (l.daysDiff <= 0 ? 'bg-green-500' : 'bg-orange-500') : l.status === 'Wait Approve' ? 'bg-yellow-400' : 'bg-gray-400';
                    marker = `<div class="absolute inset-0 flex items-center justify-center"><div class="w-3 h-3 ${color} rounded-sm border border-white shadow" title="${l.status} (${l.daysDiff > 0 ? '+' + l.daysDiff + ' วัน' : 'ตรงเวลา'})"></div></div>`;
                }
            });

            if (isToday) bg = 'bg-indigo-50';
            else if (d.getDay() === 0) bg = 'bg-gray-50';

            cells += `<div class="inline-block relative" style="width:20px;min-width:20px;height:28px"><div class="h-full border-r border-gray-100 ${bg}"></div>${marker}</div>`;
        }

        const overdueLabel = nextDue && nextDue <= today ? `<span class="text-red-600 text-[9px] font-bold ml-1">เกิน ${dayIndex(today) - dayIndex(nextDue)} วัน</span>` : '';

        return `<div class="flex border-b border-gray-100 hover:bg-gray-50 group">
            <div class="shrink-0 w-48 p-1.5 border-r bg-white sticky left-0 z-10 flex items-start justify-between gap-1">
                <div class="min-w-0">
                    <div class="text-xs font-bold text-gray-800 truncate">${plan.taskName}${overdueLabel}</div>
                    <div class="text-[9px] text-gray-400">${plan.machine} · ${plan.frequency} · ${plan.assignedTo || '-'}</div>
                </div>
                <button data-plan-id="${escapePmAttr(plan.planId)}" data-task-name="${escapePmAttr(plan.taskName)}" data-machine="${escapePmAttr(plan.machine)}" onclick="window.deletePmPlan(this)" title="ลบแผนนี้" class="shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm">🗑️</button>
            </div>
            <div class="flex-1 whitespace-nowrap overflow-hidden">${cells}</div>
        </div>`;
    });

    // Legend
    const legendHtml = `<div class="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-600">
        <span><span class="inline-block w-3 h-3 bg-blue-500 rounded-full align-middle"></span> กำหนดถัดไป</span>
        <span><span class="inline-block w-3 h-3 bg-red-500 rounded-full align-middle"></span> เลยกำหนด</span>
        <span><span class="inline-block w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-300 align-middle"></span> รอบถัดไป (คาดการณ์ตามความถี่)</span>
        <span><span class="inline-block w-3 h-3 bg-green-500 rounded-sm align-middle"></span> ทำตรงเวลา</span>
        <span><span class="inline-block w-3 h-3 bg-orange-500 rounded-sm align-middle"></span> ทำแต่ช้า</span>
        <span><span class="inline-block w-3 h-3 bg-yellow-400 rounded-sm align-middle"></span> รออนุมัติ</span>
    </div>`;

    container.innerHTML = `
        ${statsHtml}
        <div class="bg-white rounded-lg shadow-sm border overflow-x-auto" id="gantt-scroll-container">
            <div class="min-w-max">
                <div class="flex border-b bg-gray-50 sticky top-0 z-20">
                    <div class="shrink-0 w-48 p-2 border-r font-bold text-xs text-gray-600 sticky left-0 bg-gray-50 z-30">แผน PM</div>
                    <div class="flex-1 whitespace-nowrap">
                        <div>${monthRow}</div>
                        <div>${dayHeaders.join('')}</div>
                    </div>
                </div>
                ${planRows.length > 0 ? planRows.join('') : '<div class="text-center text-gray-400 py-8">ยังไม่มีแผน PM — กรุณาเพิ่มข้อมูลในชีท Maintenance_Plan</div>'}
            </div>
        </div>
        ${legendHtml}
    `;

    // Auto-scroll ให้วันปัจจุบันอยู่กลางจอ
    const scrollEl = container.querySelector('#gantt-scroll-container');
    if (scrollEl) {
        const labelWidth = 192; // w-48 = 192px
        const todayPx = todayIndex * 20;
        const visibleWidth = scrollEl.clientWidth - labelWidth;
        scrollEl.scrollLeft = Math.max(0, todayPx - visibleWidth / 2);
    }
}
