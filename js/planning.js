// =========================================================
// 📅 ระบบวางแผนการผลิต / Job Order (Plan_Data)
// - บันทึกแผนการผลิตพร้อมเลข Job Order (สร้างอัตโนมัติได้)
// - ติดตามความคืบหน้าเทียบยอดผลิตจริงจาก Production_Data
// - ส่งรายการ Job Order ที่ยังเปิดอยู่ให้ฟอร์มบันทึกผลิตเลือกใช้
// =========================================================

window.jobOrderList = window.jobOrderList || [];
window.jobOrderLoading = false;
window.editingJobOrder = null;

const JOB_ORDER_STATUS_LABEL = {
    'Open': 'รอผลิต',
    'In Progress': 'กำลังผลิต',
    'Completed': 'ผลิตครบแล้ว',
    'Closed': 'ปิดงาน',
    'Cancelled': 'ยกเลิก'
};

const JOB_ORDER_STATUS_CLASS = {
    'Open': 'bg-gray-100 text-gray-700 border-gray-200',
    'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
    'Completed': 'bg-green-50 text-green-700 border-green-200',
    'Closed': 'bg-slate-200 text-slate-700 border-slate-300',
    'Cancelled': 'bg-red-50 text-red-600 border-red-200'
};

// Job Order ที่ยังรับยอดผลิตได้ (ยังไม่ปิด / ไม่ยกเลิก)
window.getActiveJobOrders = function() {
    return (window.jobOrderList || []).filter(j =>
        j.jobOrder && j.status !== 'Cancelled' && j.status !== 'Closed'
    );
};

window.getJobOrderByNo = function(no) {
    if (!no) return null;
    return (window.jobOrderList || []).find(j => j.jobOrder === no) || null;
};

// -------------------- โหลดข้อมูล --------------------
window.loadJobOrders = async function(silent) {
    if (window.jobOrderLoading) return window.jobOrderList;
    window.jobOrderLoading = true;
    const tbody = document.getElementById('joTableBody');
    if (tbody && !silent) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400 text-sm">⏳ กำลังโหลดรายการ Job Order...</td></tr>`;
    }
    try {
        const res = await fetch(`${SCRIPT_URL}?action=GET_JOB_ORDERS&_t=${Date.now()}`);
        const data = await res.json();
        window.jobOrderList = (data && data.jobOrders) ? data.jobOrders : [];
    } catch (e) {
        console.log('Load job orders error:', e);
        if (tbody && !silent) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 text-sm">❌ โหลดรายการไม่สำเร็จ: ${e.message}</td></tr>`;
        }
    } finally {
        window.jobOrderLoading = false;
    }
    window.renderJobOrderTable();
    window.refreshAllJobOrderSelects();
    return window.jobOrderList;
};

// -------------------- ตัวเลือก Job Order ในฟอร์มบันทึกผลิต --------------------
// สร้าง <option> ของ Job Order ที่ยังเปิดอยู่ (กรองตามรุ่นได้)
window.buildJobOrderOptions = function(selectedValue, productFilter) {
    let opts = `<option value="">— ไม่ระบุ Job Order —</option>`;
    const list = window.getActiveJobOrders();
    let matched = false;

    list.forEach(j => {
        if (productFilter && j.product && j.product !== productFilter) return;
        const remain = (j.remainingQty !== undefined) ? j.remainingQty : '-';
        const sel = (selectedValue && selectedValue === j.jobOrder) ? 'selected' : '';
        if (sel) matched = true;
        opts += `<option value="${j.jobOrder}" data-product="${j.product || ''}" ${sel}>${j.jobOrder} | ${j.product || '-'} | คงเหลือ ${remain}</option>`;
    });

    // ถ้าเลข Job Order ที่เลือกไว้ไม่อยู่ในรายการที่กรอง ให้คงตัวเลือกนั้นไว้ (กันข้อมูลหาย)
    if (selectedValue && !matched) {
        opts += `<option value="${selectedValue}" selected>${selectedValue}</option>`;
    }
    return opts;
};

window.refreshAllJobOrderSelects = function() {
    document.querySelectorAll('.job-order-select-target').forEach(sel => {
        const row = sel.closest('[data-row-id]') || sel.parentElement.parentElement;
        const prodSel = row ? row.querySelector('.product-select-target') : null;
        const product = prodSel ? prodSel.value : '';
        sel.innerHTML = window.buildJobOrderOptions(sel.value, product);
    });
};

// -------------------- ตารางรายการ Job Order --------------------
window.renderJobOrderTable = function() {
    const tbody = document.getElementById('joTableBody');
    if (!tbody) return;

    const statusFilter = (document.getElementById('joFilterStatus')?.value) || 'Active';
    const keyword = ((document.getElementById('joFilterKeyword')?.value) || '').trim().toLowerCase();

    let list = (window.jobOrderList || []).slice();

    if (statusFilter === 'Active') {
        list = list.filter(j => j.status === 'Open' || j.status === 'In Progress');
    } else if (statusFilter !== 'All') {
        list = list.filter(j => j.status === statusFilter);
    }

    if (keyword) {
        list = list.filter(j =>
            [j.jobOrder, j.product, j.customer, j.poNo, j.machine, j.remark]
                .some(v => String(v || '').toLowerCase().includes(keyword))
        );
    }

    // เรียงตามกำหนดส่ง (ถ้าไม่มีใช้วันที่แผน) จากใกล้ที่สุดไปไกลที่สุด
    list.sort((a, b) => {
        const da = a.dueDate || a.planDate || '9999-12-31';
        const db = b.dueDate || b.planDate || '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        return String(a.jobOrder).localeCompare(String(b.jobOrder));
    });

    const summary = document.getElementById('joSummary');
    if (summary) {
        const totalTarget = list.reduce((s, j) => s + (j.targetQty || 0), 0);
        const totalDone = list.reduce((s, j) => s + (j.producedFg || 0), 0);
        const pct = totalTarget > 0 ? ((totalDone / totalTarget) * 100).toFixed(1) : '0.0';
        summary.innerHTML = `${list.length} รายการ · เป้า ${totalTarget.toLocaleString()} ชิ้น · ผลิตแล้ว ${totalDone.toLocaleString()} ชิ้น (${pct}%)`;
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400 text-sm">ไม่พบ Job Order ตามเงื่อนไขที่เลือก</td></tr>`;
        return;
    }

    const todayStr = (typeof getShiftDateStr === 'function') ? getShiftDateStr() : new Date().toISOString().substring(0, 10);

    tbody.innerHTML = list.map(j => {
        const pct = Math.min(100, j.progressPct || 0);
        const barColor = pct >= 100 ? 'bg-green-500' : (pct >= 50 ? 'bg-blue-500' : 'bg-amber-500');
        const statusCls = JOB_ORDER_STATUS_CLASS[j.status] || 'bg-gray-100 text-gray-700 border-gray-200';
        const statusText = JOB_ORDER_STATUS_LABEL[j.status] || j.status;
        const overdue = j.dueDate && j.dueDate < todayStr && (j.status === 'Open' || j.status === 'In Progress');
        const canDelete = (j.producedFg || 0) === 0;

        return `
        <tr class="hover:bg-indigo-50/40 ${overdue ? 'bg-red-50/40' : ''}">
            <td class="px-3 py-2 font-bold text-indigo-700 whitespace-nowrap">${j.jobOrder}
                ${j.priority && j.priority !== 'Normal' ? `<span class="ml-1 text-[10px] font-bold text-red-600">[${j.priority}]</span>` : ''}
            </td>
            <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                ${j.planDate || '-'}
                ${j.dueDate ? `<div class="${overdue ? 'text-red-600 font-bold' : 'text-gray-400'}">ส่ง: ${j.dueDate}${overdue ? ' ⚠️' : ''}</div>` : ''}
            </td>
            <td class="px-3 py-2 text-sm text-gray-800">${j.product || '-'}
                ${j.customer ? `<div class="text-[10px] text-gray-400">${j.customer}${j.poNo ? ' / PO ' + j.poNo : ''}</div>` : ''}
            </td>
            <td class="px-3 py-2 text-right font-bold text-gray-700">${(j.targetQty || 0).toLocaleString()}</td>
            <td class="px-3 py-2 text-right font-bold text-green-700">${(j.producedFg || 0).toLocaleString()}</td>
            <td class="px-3 py-2 text-right font-bold ${j.remainingQty > 0 ? 'text-amber-700' : 'text-gray-400'}">${(j.remainingQty || 0).toLocaleString()}</td>
            <td class="px-3 py-2 w-32">
                <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="${barColor} h-2" style="width:${pct}%"></div>
                </div>
                <div class="text-[10px] text-gray-500 text-center mt-0.5">${(j.progressPct || 0).toFixed(1)}%</div>
            </td>
            <td class="px-3 py-2 text-center">
                <span class="inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${statusCls}">${statusText}</span>
            </td>
            <td class="px-3 py-2 text-center whitespace-nowrap">
                <button type="button" onclick="window.editJobOrder('${j.jobOrder}')" class="text-blue-600 hover:text-blue-800 px-1" title="แก้ไข">✏️</button>
                ${(j.status === 'Closed' || j.status === 'Cancelled')
                    ? `<button type="button" onclick="window.setJobOrderStatus('${j.jobOrder}','Open')" class="text-green-600 hover:text-green-800 px-1" title="เปิดงานใหม่">↩️</button>`
                    : `<button type="button" onclick="window.setJobOrderStatus('${j.jobOrder}','Closed')" class="text-slate-600 hover:text-slate-800 px-1" title="ปิดงาน">✅</button>
                       <button type="button" onclick="window.setJobOrderStatus('${j.jobOrder}','Cancelled')" class="text-red-500 hover:text-red-700 px-1" title="ยกเลิก">🚫</button>`}
                ${canDelete ? `<button type="button" onclick="window.deleteJobOrder('${j.jobOrder}')" class="text-gray-400 hover:text-red-600 px-1" title="ลบ">🗑️</button>` : ''}
            </td>
        </tr>`;
    }).join('');
};

// -------------------- บันทึก / แก้ไข --------------------
window.postPlanAction = async function(payload) {
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        return await res.json();
    } catch (e) {
        // บาง environment อ่าน response ไม่ได้ (CORS) → ยิงซ้ำแบบ no-cors แล้วถือว่าสำเร็จ
        try {
            await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
            return { status: 'success', message: 'sent' };
        } catch (err) {
            return { status: 'error', message: err.message };
        }
    }
};

window.editJobOrder = function(no) {
    const j = window.getJobOrderByNo(no);
    if (!j) return;
    window.editingJobOrder = no;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('planJobOrder', j.jobOrder);
    set('planDate', j.planDate);
    set('planDueDate', j.dueDate);
    set('planProduct', j.product);
    set('planQty', j.targetQty);
    set('planMachine', j.machine);
    set('planShift', j.shift || 'All');
    set('planPriority', j.priority || 'Normal');
    set('planCustomer', j.customer);
    set('planPoNo', j.poNo);
    set('planRemark', j.remark);

    const jobInput = document.getElementById('planJobOrder');
    if (jobInput) jobInput.readOnly = true;

    const btn = document.getElementById('planSubmitBtn');
    if (btn) btn.innerText = '💾 บันทึกการแก้ไข Job Order';
    const cancelBtn = document.getElementById('planCancelEditBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    document.getElementById('planningForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cancelEditJobOrder = function() {
    window.editingJobOrder = null;
    const form = document.getElementById('planningForm');
    if (form) form.reset();
    const jobInput = document.getElementById('planJobOrder');
    if (jobInput) { jobInput.readOnly = false; jobInput.value = ''; }
    const el = document.getElementById('planDate');
    if (el && typeof getShiftDateStr === 'function') el.value = getShiftDateStr();
    const btn = document.getElementById('planSubmitBtn');
    if (btn) btn.innerText = '💾 บันทึกแผน / สร้าง Job Order';
    const cancelBtn = document.getElementById('planCancelEditBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
};

window.setJobOrderStatus = async function(no, status) {
    const label = JOB_ORDER_STATUS_LABEL[status] || status;
    if (!confirm(`ยืนยันเปลี่ยนสถานะ ${no} เป็น "${label}" ?`)) return;
    const result = await window.postPlanAction({ action: 'UPDATE_PLAN', jobOrder: no, status: status });
    if (result.status === 'error') { alert('❌ ' + result.message); return; }
    if (typeof systemLog === 'function') systemLog('UPDATE_PLAN', `เปลี่ยนสถานะ ${no} → ${status}`);
    await window.loadJobOrders(true);
};

window.deleteJobOrder = async function(no) {
    if (!confirm(`ยืนยันลบ Job Order ${no} ?\n(ลบได้เฉพาะงานที่ยังไม่มีการบันทึกผลิต)`)) return;
    const result = await window.postPlanAction({ action: 'DELETE_PLAN', jobOrder: no });
    if (result.status === 'error') { alert('❌ ' + result.message); return; }
    if (typeof systemLog === 'function') systemLog('DELETE_PLAN', `ลบแผน ${no}`);
    await window.loadJobOrders(true);
};

// -------------------- การ์ด Job Order บนหน้า Dashboard --------------------
// เรียกจาก loadDashboard() หลังได้ข้อมูลแล้ว (ใช้ data.jobOrders + data.jobOrderData จาก backend)
window.renderJobOrderDashCard = function(data) {
    const box = document.getElementById('jobOrderDashList');
    if (!box) return;

    const jobs = (data && data.jobOrders ? data.jobOrders : []).filter(j => j.status !== 'Cancelled');
    const actual = (data && data.jobOrderData) ? data.jobOrderData : {};

    if (jobs.length === 0) {
        box.innerHTML = `<div class="text-center text-gray-400 text-sm py-10">ไม่มี Job Order ในช่วงวันที่เลือก</div>`;
        return;
    }

    const sorted = jobs.slice().sort((a, b) => {
        const da = a.dueDate || a.planDate || '9999-12-31';
        const db = b.dueDate || b.planDate || '9999-12-31';
        return da < db ? -1 : (da > db ? 1 : 0);
    });

    box.innerHTML = sorted.map(j => {
        const pct = Math.min(100, j.progressPct || 0);
        const barColor = pct >= 100 ? 'bg-green-500' : (pct >= 50 ? 'bg-blue-500' : 'bg-amber-500');
        const inRange = actual[j.jobOrder] || { fg: 0 };
        return `
        <div class="py-2 border-b border-gray-100 last:border-0">
            <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-indigo-700">${j.jobOrder}</span>
                <span class="text-gray-500">${j.product || '-'}</span>
            </div>
            <div class="flex justify-between items-center text-[11px] text-gray-500 mt-0.5">
                <span>ผลิต ${(j.producedFg || 0).toLocaleString()} / ${(j.targetQty || 0).toLocaleString()} ชิ้น${inRange.fg ? ` · ช่วงนี้ ${inRange.fg.toLocaleString()}` : ''}</span>
                <span class="font-bold">${(j.progressPct || 0).toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                <div class="${barColor} h-1.5" style="width:${pct}%"></div>
            </div>
        </div>`;
    }).join('');
};

// -------------------- ผูก event ตอนโหลดหน้า --------------------
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('planningForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('planSubmitBtn');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = '⏳ กำลังบันทึกแผน...';
            btn.classList.add('opacity-50', 'cursor-not-allowed');

            const val = (id) => (document.getElementById(id)?.value || '').trim();
            const qty = parseInt(val('planQty')) || 0;

            if (!val('planDate') || !val('planProduct') || qty <= 0) {
                alert('⚠️ กรุณาระบุวันที่แผน / รุ่นสินค้า / จำนวนเป้าหมายให้ครบ');
                btn.disabled = false; btn.innerText = originalText;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                return;
            }
            if (val('planDueDate') && val('planDueDate') < val('planDate')) {
                alert('⚠️ กำหนดส่งต้องไม่ก่อนวันที่แผน');
                btn.disabled = false; btn.innerText = originalText;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                return;
            }

            const isEdit = !!window.editingJobOrder;
            const payload = {
                action: isEdit ? 'UPDATE_PLAN' : 'SAVE_PLAN',
                jobOrder: isEdit ? window.editingJobOrder : val('planJobOrder'),
                planDate: val('planDate'),
                dueDate: val('planDueDate'),
                product: val('planProduct'),
                qty: qty,
                machine: val('planMachine'),
                shift: val('planShift') || 'All',
                priority: val('planPriority') || 'Normal',
                customer: val('planCustomer'),
                poNo: val('planPoNo'),
                remark: val('planRemark'),
                recorder: (window.currentUser && window.currentUser.username) || ''
            };

            const result = await window.postPlanAction(payload);
            if (result.status === 'error') {
                alert('❌ ' + result.message);
            } else {
                if (typeof systemLog === 'function') {
                    systemLog(isEdit ? 'UPDATE_PLAN' : 'SAVE_PLAN',
                        `${isEdit ? 'แก้ไข' : 'บันทึก'}แผนการผลิต ${result.jobOrder || payload.jobOrder || ''} ${payload.product} จำนวน ${qty} ชิ้น`);
                }
                alert(`✅ ${isEdit ? 'แก้ไขแผนสำเร็จ' : 'บันทึกแผนสำเร็จ'}${result.jobOrder ? '\nเลข Job Order: ' + result.jobOrder : ''}`);
                window.cancelEditJobOrder();
                await window.loadJobOrders(true);
            }

            btn.disabled = false;
            btn.innerText = window.editingJobOrder ? '💾 บันทึกการแก้ไข Job Order' : '💾 บันทึกแผน / สร้าง Job Order';
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        };
    }

    document.getElementById('joFilterStatus')?.addEventListener('change', window.renderJobOrderTable);
    document.getElementById('joFilterKeyword')?.addEventListener('input', window.renderJobOrderTable);
    document.getElementById('joRefreshBtn')?.addEventListener('click', () => window.loadJobOrders());
});
