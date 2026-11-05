// =========================================================
// 👥 Manpower (เข้างาน / OT) — ดึงจาก GET_MANPOWER_REPORT (แท็บ Attendance_JR)
// ใช้ร่วมกันระหว่างการ์ด Dashboard (card-manpower) และ Auto Report PDF
// =========================================================
(function() {
    const cache = {};   // key = 'all' | 'start|end' → Promise ของผลลัพธ์

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    window.manpowerEsc = esc;

    // start ว่าง หรือ all=true → ไม่กรองวัน · ผลลัพธ์ไม่ throw (error → {status:'error', message})
    window.fetchManpower = function(start, end, opts) {
        opts = opts || {};
        const all = !!opts.all || !start;
        const key = all ? 'all' : (start + '|' + (end || start));
        if (!opts.force && cache[key]) return cache[key];
        const body = { action: 'GET_MANPOWER_REPORT', username: (window.currentUser && window.currentUser.username) || '' };
        if (all) body.range = 'all'; else { body.start = start; body.end = end || start; }
        const p = fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(body) })
            .then(r => r.json())
            .catch(e => ({ status: 'error', message: String((e && e.message) || e) }))
            .then(res => {
                if (!res || res.status === 'error') delete cache[key];   // error ไม่เก็บ cache ให้ลองใหม่ได้
                return res;
            });
        cache[key] = p;
        return p;
    };

    window.isManpowerMultiDay = function(mp) {
        if (!mp) return false;
        if ((mp.byDate || []).length > 1) return true;
        return !!(mp.range && (mp.range.all || mp.range.start !== mp.range.end));
    };

    // วาดการ์ดบน Dashboard
    window.renderManpowerDashCard = function(mp) {
        const box = document.getElementById('manpowerDashList');
        const title = document.getElementById('manpowerDashTitle');
        if (!box) return;
        const sub = esc((mp && mp.subDepartment) || 'Coil winding');
        if (title) title.innerHTML = `👥 Manpower — ${sub} (เข้างาน / OT)`;

        if (!mp) {
            box.innerHTML = `<div class="text-center text-gray-400 text-sm py-10">⏳ กำลังโหลด Manpower...</div>`;
            return;
        }
        if (mp.status === 'error' || mp.missing) {
            box.innerHTML = `<div class="text-center text-gray-500 text-xs py-10">⚠️ ไม่มีข้อมูล Manpower — ${esc(mp.message || 'ไม่สามารถดึงข้อมูลได้')}</div>`;
            return;
        }
        const people = mp.people || [];
        if (people.length === 0) {
            box.innerHTML = `<div class="text-center text-gray-400 text-sm py-10">ไม่มีรายชื่อเข้างาน / OT ของ ${sub} ในช่วงวันที่เลือก</div>`;
            return;
        }
        const work = mp.workCount || 0, ot = mp.otCount || 0;
        const ratio = work > 0 ? ((ot / work) * 100).toFixed(1) : '0.0';
        const multi = window.isManpowerMultiDay(mp);

        let html = `
            <div class="grid grid-cols-3 gap-2 text-center mb-2">
                <div class="border border-teal-200 bg-teal-50 rounded p-1.5"><p class="text-[10px] text-gray-500 font-bold">เข้างาน</p><p class="text-lg font-black text-teal-700">${work.toLocaleString()} <span class="text-[10px] font-normal">คน</span></p></div>
                <div class="border border-orange-200 bg-orange-50 rounded p-1.5"><p class="text-[10px] text-gray-500 font-bold">เข้า OT</p><p class="text-lg font-black text-orange-600">${ot.toLocaleString()} <span class="text-[10px] font-normal">คน</span></p></div>
                <div class="border border-indigo-200 bg-indigo-50 rounded p-1.5"><p class="text-[10px] text-gray-500 font-bold">OT ratio</p><p class="text-lg font-black text-indigo-700">${ratio}%</p><p class="text-[9px] text-gray-500">(${ot}/${work})</p></div>
            </div>`;

        if (multi && (mp.byDate || []).length > 0) {
            html += `<details class="mb-2 text-xs"><summary class="cursor-pointer font-bold text-gray-600">📅 Manpower by day (${mp.byDate.length} วัน)</summary>
                <table class="w-full text-xs mt-1"><thead class="bg-gray-100 text-gray-600"><tr>
                    <th class="px-2 py-1 text-left">วันที่</th><th class="px-2 py-1 text-right">เข้างาน</th><th class="px-2 py-1 text-right">OT</th></tr></thead>
                <tbody class="divide-y divide-gray-100">${mp.byDate.map(d => `<tr>
                    <td class="px-2 py-1">${esc(d.date)}</td>
                    <td class="px-2 py-1 text-right font-bold text-teal-700">${(d.work || 0).toLocaleString()}</td>
                    <td class="px-2 py-1 text-right font-bold text-orange-600">${(d.ot || 0).toLocaleString()}</td></tr>`).join('')}</tbody></table></details>`;
        }

        html += `<table class="w-full text-xs">
            <thead class="bg-gray-100 text-gray-600 sticky top-0"><tr>
                <th class="px-2 py-1 text-left">รหัส</th><th class="px-2 py-1 text-left">ชื่อ</th><th class="px-2 py-1 text-left">ตำแหน่ง</th>
                <th class="px-2 py-1 text-center">เข้างาน${multi ? ' (วัน)' : ''}</th><th class="px-2 py-1 text-center">OT${multi ? ' (วัน)' : ''}</th>
            </tr></thead><tbody class="divide-y divide-gray-100">`;
        people.forEach(p => {
            const w = p.workDays || 0, o = p.otDays || 0;
            const wCell = multi ? (w ? w.toLocaleString() : '-') : (w ? '✓' : '');
            const oCell = multi ? (o ? o.toLocaleString() : '-') : (o ? '✓' : '');
            const leader = /leader/i.test(p.position || '');
            html += `<tr>
                <td class="px-2 py-1 text-gray-500">${esc(p.employeeId)}</td>
                <td class="px-2 py-1 ${leader ? 'font-bold text-gray-900' : 'text-gray-800'}">${esc(p.name || '-')}</td>
                <td class="px-2 py-1 text-gray-500">${esc(p.position || '-')}</td>
                <td class="px-2 py-1 text-center font-bold text-teal-700">${esc(wCell)}</td>
                <td class="px-2 py-1 text-center font-bold text-orange-600">${esc(oCell)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        box.innerHTML = html;
    };

    // เรียกจาก loadDashboard — ไม่ block การโหลด Dashboard
    window.loadManpowerDashCard = function(start, end, allTime) {
        if (!document.getElementById('manpowerDashList')) return;
        window.renderManpowerDashCard(null);
        const reqKey = allTime ? 'all' : (start + '|' + end);
        window._manpowerDashKey = reqKey;
        window.fetchManpower(start, end, { all: allTime, force: true }).then(mp => {
            if (window._manpowerDashKey !== reqKey) return;   // ผู้ใช้กดค้นหาช่วงใหม่ไปแล้ว
            if (typeof currentDashboardData !== 'undefined' && currentDashboardData) currentDashboardData.manpower = mp;
            window.renderManpowerDashCard(mp);
        });
    };
})();
