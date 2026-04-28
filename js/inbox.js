// === 📬 Inbox — Email-client style task center ===
let inboxData = null;
let inboxActiveCategory = 'all';

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
                <button onclick="window.openMaintenanceModal('${d.jobId}')" class="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 font-bold">✅ ปิดงาน</button>
            </div>
        </div>
    </div>`;
}

function renderPartsCheckItem(d) {
    const escName = (d.partName || '').replace(/'/g, "\\'");
    return `<div class="border-l-4 border-l-amber-500 bg-white rounded-r-lg shadow-sm p-4 mb-2 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg">🔍</span>
                    <span class="font-bold text-gray-800 text-sm">${d.partName}</span>
                    <span class="text-[10px] text-gray-400 font-mono">(${d.partId})</span>
                    <span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-mono">${d.machine}</span>
                </div>
                <div class="text-xs text-gray-600">Actual: <b class="text-amber-700">${Number(d.actualShots).toLocaleString()}</b> / Next Check: <b>${Number(d.nextCheckShot).toLocaleString()}</b> shot</div>
                <div class="text-xs text-gray-500 mt-0.5">Life: ${d.lifeShots > 0 ? Number(d.lifeShots).toLocaleString() : '∞'} · ตรวจแล้ว ${d.checkCount} ครั้ง</div>
            </div>
            <div class="flex flex-col gap-1 ml-3 shrink-0">
                <button onclick="window.openCheckPartDialog('${d.installId}', '${d.partId}', '${escName}', '${d.machine}', ${d.actualShots}, ${d.lifeShots}, ${d.nextCheckShot}, 0)" class="text-xs bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 font-bold">🔍 ตรวจเช็ค</button>
                <button onclick="window.showCheckHistory('${d.installId}', '${escName}')" class="text-xs text-gray-500 hover:underline">📋 ประวัติ</button>
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
