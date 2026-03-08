const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyt3Bf_2h21BBcCHQSjizowy_kD5vsoUqgaC_YmVjLuQybJO1BBRt3eaSM0PuKEFfvruw/exec";
        
let ngSymptoms = ["ลวดถลอก (Scratched)", "พันหลวม (Loose)", "รอบไม่ครบ (Turn Error)", "ขาผิดรูป (Lead Deform)", "อื่นๆ (Others)"];
let productList = ["S1B29288-JR (10A)", "S1B71819-JR (16A)", "S1B29292-JR (20A)", "51207080HC-JR (25/32A)"];
let recorderList = ["พนักงาน 1", "พนักงาน 2"];

let machineMapping = {};
let hiddenWidgets = []; // เก็บรายชื่อ ID ของกราฟที่ถูกซ่อน

const DAY_HOURS = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "OT 17:30-18:00", "OT 18:00-19:00", "OT 19:00-20:00"];
const NIGHT_HOURS = ["20:00-21:00", "21:00-22:00", "22:00-23:00", "23:00-00:00", "00:00-01:00", "01:00-02:00", "02:00-03:00", "03:00-04:00", "04:00-05:00", "OT 05:00-06:00", "OT 06:00-07:00", "OT 07:00-08:00"];

const WIDGET_LIST = [
    { id: 'card-stat-target', label: 'TARGET (PLAN)' },
    { id: 'card-stat-fg', label: 'TOTAL FG' },
    { id: 'card-stat-ach', label: '% ACH' },
    { id: 'card-stat-ng', label: 'TOTAL NG' },
    { id: 'card-stat-yield', label: '% YIELD' },
    { id: 'card-stat-uph', label: 'UPH' },
    { id: 'card-fg-model', label: 'FG & ACH by Model' },
    { id: 'card-pareto', label: 'NG Analysis (Pareto)' },
    { id: 'card-simulator', label: 'Yield Simulator' },
    { id: 'card-model-analysis', label: 'Model Analysis' },
    { id: 'card-yield-machine', label: '% Yield by Machine' },
    { id: 'card-daily-output', label: 'Daily Output' },
    { id: 'card-qc-trend', label: 'Daily NG Rate Trend' },
    { id: 'card-ng-trend', label: 'Trend อาการ NG' },
    { id: 'card-ng-machine', label: 'NG by Machine' },
    { id: 'card-hourly', label: 'Hourly Production' },
    { id: 'card-ng-breakdown', label: 'NG Breakdown' },
    { id: 'card-table', label: 'Detailed Machine Performance' }
];

let currentRowIdForNg = null;
let batchNgData = {};
let currentDashboardData = null;
let machineDetailChart = null;
let machineDailyChartInst = null; 
let charts = {};
let currentManageType = '';

window.isDualLayout = true;
window.lastBatchId = null;
window.currentUser = null; 

// ==========================================
// 🌟 1. ระบบ Authentication & Authorization
// ==========================================

window.onload = () => {
    const savedUser = localStorage.getItem('CWM_AUTH_USER');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        initAppAfterLogin();
    } else {
        document.getElementById('login-modal').classList.remove('hidden');
    }
};

document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const errDiv = document.getElementById('login-error');
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    
    btn.disabled = true;
    btn.innerHTML = "⏳ กำลังเข้าสู่ระบบ...";
    errDiv.classList.add('hidden');
    
    try {
        const payload = { action: 'LOGIN', username: user, password: pass };
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            window.currentUser = data.user;
            localStorage.setItem('CWM_AUTH_USER', JSON.stringify(data.user));
            document.getElementById('login-modal').classList.add('hidden');
            initAppAfterLogin();
        } else {
            errDiv.innerText = data.message || "Username หรือ Password ไม่ถูกต้อง";
            errDiv.classList.remove('hidden');
        }
    } catch (err) {
        errDiv.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
        errDiv.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = "เข้าสู่ระบบ";
    }
};

window.logout = function() {
    localStorage.removeItem('CWM_AUTH_USER');
    window.location.reload();
};

function initAppAfterLogin() {
    document.getElementById('nav-user-name').innerText = window.currentUser.name || window.currentUser.username;
    document.getElementById('nav-user-role').innerText = window.currentUser.role;
    document.getElementById('nav-user-name-mobile').innerText = window.currentUser.name || window.currentUser.username;
    document.getElementById('nav-user-role-mobile').innerText = window.currentUser.role;

    const shiftDate = getShiftDateStr();
    document.getElementById('productionDate').value = shiftDate;
    document.getElementById('planDate').value = shiftDate;
    document.getElementById('startDate').value = shiftDate;
    document.getElementById('endDate').value = shiftDate;

    if(localStorage.getItem('CWM_CUSTOM_NG')) ngSymptoms = JSON.parse(localStorage.getItem('CWM_CUSTOM_NG'));
    ngSymptoms = normalizeSymptomList(ngSymptoms);
    localStorage.setItem('CWM_CUSTOM_NG', JSON.stringify(ngSymptoms));

    if(localStorage.getItem('CWM_RECORDERS')) recorderList = JSON.parse(localStorage.getItem('CWM_RECORDERS'));
    if(localStorage.getItem('CWM_MACHINE_MAPPING')) machineMapping = JSON.parse(localStorage.getItem('CWM_MACHINE_MAPPING'));

    window.detectCurrentShift();
    window.addBatchRow();
    window.fetchOptions();
    window.initSortable();
    window.renderRecorderOptions();
    window.renderProductOptions();

    applyPermissions(); 

    document.addEventListener('dblclick', function(e) {
        if (e.target.tagName === 'CANVAS') {
            const chartInstance = Chart.getChart(e.target);
            if (chartInstance) {
                if (typeof chartInstance.resetZoom === 'function') chartInstance.resetZoom();
                if (chartInstance.options.scales) {
                    Object.keys(chartInstance.options.scales).forEach(key => {
                        delete chartInstance.options.scales[key].min;
                        delete chartInstance.options.scales[key].max;
                    });
                    chartInstance.update();
                }
            }
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const maxCard = document.querySelector('.maximized-card');
            if (maxCard) {
                const btn = maxCard.querySelector('button[title="ย่อหน้าจอ"]');
                if (btn) window.toggleCardMaximize(btn);
            }
        }
    });
}

function applyPermissions() {
    const role = window.currentUser.role;
    
    ['tab-form', 'tab-planning', 'tab-dashboard', 'tab-rw', 'tab-admin', 'tab-maint'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    let defaultTab = '';

    // สิทธิ์การเข้าถึงเมนู
    if (role === 'Production') {
        ['tab-form', 'tab-dashboard', 'tab-rw', 'tab-maint'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        defaultTab = 'form';
    } 
    else if (role === 'QC') {
        ['tab-form', 'tab-dashboard', 'tab-rw'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        defaultTab = 'form';
    }
    else if (role === 'Planning') {
        ['tab-planning', 'tab-dashboard'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        defaultTab = 'planning';
    } 
    else if (role === 'Viewer') {
        ['tab-dashboard'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        defaultTab = 'dashboard';
    } 
    else if (role === 'Admin') {
        ['tab-form', 'tab-planning', 'tab-dashboard', 'tab-rw', 'tab-admin', 'tab-maint'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        defaultTab = 'dashboard'; 
        
        const btnWidgetMgr = document.getElementById('btn-widget-manager');
        if (btnWidgetMgr) {
            btnWidgetMgr.classList.remove('hidden');
            btnWidgetMgr.classList.add('flex');
        }
    }

    window.switchTab(defaultTab);
}

function systemLog(logType, details) {
    if (!window.currentUser) return;
    const payload = {
        action: 'LOG_ACTION',
        username: window.currentUser.username,
        role: window.currentUser.role,
        logType: logType,
        details: details
    };
    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) }).catch(e=>console.log("Log error", e));
}

// ==========================================
// 🌟 2. ระบบ Admin (จัดการผู้ใช้ & ซ่อนกราฟ)
// ==========================================
window.openAdminPanel = function() {
    if (!window.currentUser || window.currentUser.role !== 'Admin') {
        alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        return;
    }
    
    ['form', 'planning', 'dashboard'].forEach(t => document.getElementById('section-'+t).classList.add('hidden'));
    document.getElementById('section-admin').classList.remove('hidden');
    
    loadAdminUsers();
};

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-user-table');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">กำลังโหลดข้อมูลผู้ใช้งาน...</td></tr>';
    
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'GET_USERS' }) });
        const data = await res.json();
        
        if (data.success && data.users) {
            let html = '';
            data.users.forEach(u => {
                let roleColor = 'gray';
                if(u.role==='Admin') roleColor = 'purple';
                else if(u.role==='Production') roleColor = 'blue';
                else if(u.role==='QC') roleColor = 'orange';
                else if(u.role==='Planning') roleColor = 'indigo';
                else if(u.role==='Viewer') roleColor = 'teal';

                html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap font-bold text-gray-800">${u.username}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-600">${u.name || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${roleColor}-100 text-${roleColor}-800">
                            ${u.role}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button onclick="window.showUserModal('EDIT', '${u.username}', '${u.name}', '${u.role}')" class="text-indigo-600 hover:text-indigo-900 mr-3">✏️ แก้ไข</button>
                        ${u.username !== window.currentUser.username ? 
                            `<button onclick="window.deleteUser('${u.username}')" class="text-red-600 hover:text-red-900">🗑️ ลบ</button>` 
                            : '<span class="text-gray-400 text-xs">(คุณ)</span>'
                        }
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">ไม่พบข้อมูล หรือเกิดข้อผิดพลาด</td></tr>';
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
}

window.showUserModal = function(mode, username='', name='', role='Production') {
    document.getElementById('user-manage-mode').value = mode;
    document.getElementById('user-manage-target').value = username;
    document.getElementById('user-modal-title').innerText = mode === 'ADD' ? 'เพิ่มผู้ใช้งานใหม่' : 'แก้ไขผู้ใช้งาน: ' + username;
    
    document.getElementById('user-manage-username').value = username;
    document.getElementById('user-manage-username').readOnly = (mode === 'EDIT');
    document.getElementById('user-manage-username').classList.toggle('bg-gray-100', mode === 'EDIT');
    
    document.getElementById('user-manage-password').value = ''; 
    document.getElementById('user-manage-password').required = (mode === 'ADD');
    
    document.getElementById('user-manage-name').value = name;
    document.getElementById('user-manage-role').value = role;
    
    document.getElementById('modal-user-manage').classList.remove('hidden');
};

document.getElementById('userManageForm').onsubmit = async (e) => {
    e.preventDefault();
    const mode = document.getElementById('user-manage-mode').value;
    const target = document.getElementById('user-manage-target').value;
    const username = document.getElementById('user-manage-username').value.trim();
    const password = document.getElementById('user-manage-password').value.trim();
    const name = document.getElementById('user-manage-name').value.trim();
    const role = document.getElementById('user-manage-role').value;
    
    const btn = document.getElementById('btn-save-user');
    btn.disabled = true;
    btn.innerHTML = "กำลังบันทึก...";
    
    const payload = {
        action: mode === 'ADD' ? 'ADD_USER' : 'EDIT_USER',
        adminUsername: window.currentUser.username,
        targetUsername: target,
        newUsername: username,
        newPassword: password,
        newName: name,
        newRole: role
    };
    
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.success) {
            alert(data.message);
            document.getElementById('modal-user-manage').classList.add('hidden');
            loadAdminUsers();
        } else {
            alert("ผิดพลาด: " + data.message);
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "บันทึกข้อมูล";
    }
};

window.deleteUser = async function(username) {
    if (!confirm(`ยืนยันการลบผู้ใช้: ${username} ใช่หรือไม่?\n(การกระทำนี้ไม่สามารถย้อนกลับได้)`)) return;
    
    try {
        const res = await fetch(SCRIPT_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'DELETE_USER', targetUsername: username, adminUsername: window.currentUser.username }) 
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
            loadAdminUsers();
        } else {
            alert("ผิดพลาด: " + data.message);
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
};

window.openWidgetManager = function() {
    const container = document.getElementById('widget-manager-list');
    container.innerHTML = '';
    WIDGET_LIST.forEach(w => {
        const isChecked = !hiddenWidgets.includes(w.id); 
        container.innerHTML += `
            <label class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border hover:bg-blue-50 cursor-pointer transition-colors">
                <input type="checkbox" value="${w.id}" class="widget-toggle-chk w-5 h-5 text-blue-600 rounded" ${isChecked ? 'checked' : ''}>
                <span class="text-sm font-medium text-gray-700">${w.label}</span>
            </label>
        `;
    });
    document.getElementById('modal-widget-manager').classList.remove('hidden');
};

window.saveWidgetSettings = async function() {
    const checkboxes = document.querySelectorAll('.widget-toggle-chk');
    const newHidden = [];
    checkboxes.forEach(chk => {
        if (!chk.checked) newHidden.push(chk.value);
    });

    const btn = document.getElementById('btn-save-widgets');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ กำลังอัปเดต...";
    btn.disabled = true;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'SAVE_HIDDEN_WIDGETS',
                data: newHidden
            })
        });
        
        hiddenWidgets = newHidden;
        window.applyWidgetVisibility();
        document.getElementById('modal-widget-manager').classList.add('hidden');
        
        setTimeout(() => { 
            Object.values(charts).forEach(c => { if(c && typeof c.resize === 'function') c.resize(); }); 
        }, 200);

    } catch(e) {
        alert("Error saving settings");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.applyWidgetVisibility = function() {
    WIDGET_LIST.forEach(w => {
        const el = document.getElementById(w.id);
        if (el) {
            if (hiddenWidgets.includes(w.id)) {
                el.classList.add('hidden');
            } else {
                el.classList.remove('hidden');
            }
        }
    });
};

// ==========================================
// 🌟 3. ระบบ Auto Report (ทำใหม่ตาม Request)
// ==========================================
window.openAutoReport = function() {
    if (!currentDashboardData) {
        alert("⚠️ กรุณากดปุ่ม 🔍ค้นหา เพื่อดึงข้อมูลสำหรับสร้างรายงานก่อนครับ");
        return;
    }

    const data = currentDashboardData;
    const modal = document.getElementById('modal-auto-report');
    const content = document.getElementById('auto-report-content');

    const totalFG = data.totalFg || 0;
    const totalNG = data.totalNgPcs !== undefined ? data.totalNgPcs : (data.totalNg || 0);
    const ngKg = data.totalNgKg || 0;
    const totalQty = totalFG + totalNG;
    const yieldPct = totalQty > 0 ? ((totalFG/totalQty)*100).toFixed(2) : "0.00";
    const target = data.productionTarget || 0;
    const achPct = target > 0 ? ((totalFG/target)*100).toFixed(1) : "0.0";
    
    let achHtml = '';
    if (target === 0) achHtml = `<span class="text-gray-500">N/A</span>`;
    else if (achPct >= 100) achHtml = `<span class="text-green-600 font-bold">${achPct}% (Achieved)</span>`;
    else if (achPct >= 80) achHtml = `<span class="text-orange-500 font-bold">${achPct}% (Warning)</span>`;
    else achHtml = `<span class="text-red-600 font-bold">${achPct}% (Below Target)</span>`;

    const labels = data.ngLabels || [];
    const vals = data.ngValuesPcs || data.ngValues || [];
    const ngItems = labels.map((l, i) => ({ label: l, pcs: vals[i] || 0 })).filter(i => i.pcs > 0).sort((a,b)=>b.pcs-a.pcs);
    
    let topNgHtml = '';
    if(ngItems.length > 0) {
        topNgHtml = `<ul class="list-disc pl-5 mt-2 space-y-1">`;
        ngItems.slice(0, 3).forEach((item, idx) => {
            let pct = totalNG > 0 ? ((item.pcs / totalNG) * 100).toFixed(1) : 0;
            topNgHtml += `<li>อันดับ ${idx+1}: <b>${item.label}</b> จำนวน ${item.pcs.toLocaleString()} ชิ้น (${pct}%)</li>`;
        });
        topNgHtml += `</ul>`;
    } else {
        topNgHtml = `<p class="mt-2 text-green-600 font-bold">🎉 ยอดเยี่ยม ไม่พบของเสียในระบบ</p>`;
    }

    let topMacNg = { name: '-', ng: 0 };
    let lowestYieldMac = { name: '-', yield: 100 };
    let highestYieldMac = { name: '-', yield: 0 };
    
    if(data.machineData) {
        for(let m in data.machineData) {
            const md = data.machineData[m];
            const mNg = md.ngTotalPcs !== undefined ? md.ngTotalPcs : (md.ngTotal || 0);
            const mT = md.fg + mNg;
            const mY = mT > 0 ? ((md.fg/mT)*100) : 0;
            
            if(mNg > topMacNg.ng) topMacNg = { name: m, ng: mNg };
            if(mT > 0) {
                if(mY < lowestYieldMac.yield) lowestYieldMac = { name: m, yield: mY.toFixed(2) };
                if(mY > highestYieldMac.yield) highestYieldMac = { name: m, yield: mY.toFixed(2) };
            }
        }
    }

    let bestModel = {name: '-', yield: 0};
    let worstModel = {name: '-', yield: 100};
    if(data.productData) {
        for(let p in data.productData) {
            let d = data.productData[p];
            let n = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
            let t = d.fg + n;
            let y = t > 0 ? (d.fg/t)*100 : 0;
            if(t > 0) {
                if(y >= bestModel.yield) bestModel = {name: p, yield: y.toFixed(2)};
                if(y <= worstModel.yield) worstModel = {name: p, yield: y.toFixed(2)};
            }
        }
    }

    let peakHour = {label: '-', fg: 0};
    if(data.hourlyData && data.hourlyLabels) {
        data.hourlyData.forEach((val, idx) => {
            if(val > peakHour.fg) {
                peakHour = {label: data.hourlyLabels[idx], fg: val};
            }
        });
    }

    const getChartImg = (id) => {
        const canvas = document.getElementById(id);
        return (canvas && canvas.toDataURL) ? canvas.toDataURL('image/png', 1.0) : '';
    };

    const imgDailyOutput = getChartImg('dailyOutputChart');
    const imgTrendNG = getChartImg('qcTrendChart');
    const imgPareto = getChartImg('paretoChart');
    const imgNgTrend = getChartImg('ngSymptomTrendChart');
    const imgNgMac = getChartImg('ngByMachineChart');
    const imgYieldModel = getChartImg('yieldModelChart');
    const imgYieldMac = getChartImg('yieldMachineChart');
    const imgHourly = getChartImg('hourlyChart');

    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    const dateStr = sDate === eDate ? sDate : `${sDate} ถึง ${eDate}`;
    const shiftName = document.getElementById('filterShift').options[document.getElementById('filterShift').selectedIndex].text;
    const shiftType = document.getElementById('filterShiftType').options[document.getElementById('filterShiftType').selectedIndex].text;
    const printTime = new Date().toLocaleString('th-TH');

    let html = `
        <div class="print-page">
            <div class="border-b-2 border-gray-800 pb-4 mb-6">
                <div class="flex justify-between items-end">
                    <div>
                        <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tight">Production & Quality Report</h1>
                        <p class="text-gray-600 mt-1 font-medium">รายงานสรุปผลการผลิตและควบคุมคุณภาพเชิงลึก</p>
                    </div>
                    <div class="text-right text-sm">
                        <p><b>Printed:</b> ${printTime}</p>
                    </div>
                </div>
                <div class="mt-4 flex gap-6 text-sm bg-gray-100 p-2 rounded border border-gray-200">
                    <span class="font-bold">📅 วันที่: <span class="font-normal text-blue-700">${dateStr}</span></span>
                    <span class="font-bold">🕒 กะการทำงาน: <span class="font-normal text-blue-700">${shiftName} (${shiftType})</span></span>
                </div>
            </div>

            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-2 mb-3 bg-gray-50 py-1">1. สรุปประสิทธิภาพภาพรวม (Executive Summary)</h3>
                <div class="grid grid-cols-5 gap-3 text-center">
                    <div class="border border-gray-300 rounded p-3 bg-white">
                        <p class="text-[10px] text-gray-500 font-bold uppercase">Target (Plan)</p>
                        <p class="text-xl font-bold text-indigo-700">${target.toLocaleString()}</p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-white">
                        <p class="text-[10px] text-gray-500 font-bold uppercase">Total Good (FG)</p>
                        <p class="text-xl font-bold text-blue-600">${totalFG.toLocaleString()}</p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-white">
                        <p class="text-[10px] text-gray-500 font-bold uppercase">Achievement</p>
                        <p class="text-lg">${achHtml}</p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-red-50">
                        <p class="text-[10px] text-red-600 font-bold uppercase">Total Defect (NG)</p>
                        <p class="text-xl font-bold text-red-600">${totalNG.toLocaleString()} <span class="text-xs font-normal">ชิ้น</span></p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-green-50">
                        <p class="text-[10px] text-green-700 font-bold uppercase">Overall Yield</p>
                        <p class="text-xl font-bold text-green-700">${yieldPct}%</p>
                    </div>
                </div>
            </div>

            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-indigo-500 pl-2 mb-3 bg-gray-50 py-1">2. แนวโน้มผลผลิตและอัตราของเสีย (Production & Defect Trends)</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm">
                        <p class="text-sm font-bold text-gray-800 mb-1">📊 Daily Output (FG vs NG)</p>
                        <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> กราฟแสดงปริมาณการผลิตงานดี (FG) เปรียบเทียบกับของเสีย (NG) ในแต่ละวัน ช่วยให้เห็นภาพรวมของกำลังการผลิตและการบรรลุเป้าหมายการทำงาน</p>
                        ${imgDailyOutput ? `<img src="${imgDailyOutput}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                    </div>
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm">
                        <p class="text-sm font-bold text-gray-800 mb-1">📉 Daily NG Rate Trend (%)</p>
                        <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> แสดงสัดส่วนเปอร์เซ็นต์ของเสียที่เกิดขึ้นแบบรายวัน (อัตราของเสียเฉลี่ยรอบนี้: <b>${(totalQty > 0 ? (totalNG/totalQty)*100 : 0).toFixed(2)}%</b>) ใช้เพื่อติดตามความเสถียรของกระบวนการผลิต</p>
                        ${imgTrendNG ? `<img src="${imgTrendNG}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                    </div>
                </div>
            </div>
        </div>

        <div class="page-break-before print-page">
            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-red-500 pl-2 mb-3 bg-gray-50 py-1">3. การวิเคราะห์ปัญหาคุณภาพเชิงลึก (Quality Issue Analysis)</h3>
                
                <div class="bg-red-50 border border-red-200 p-4 rounded text-sm mb-4 text-gray-800 shadow-sm">
                    <b>💡 ข้อค้นพบหลักด้านคุณภาพ (Top Defect Insights):</b>
                    ${topNgHtml}
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm">
                        <p class="text-sm font-bold text-gray-800 mb-1">📉 Pareto Analysis (สะสมความถี่ปัญหา)</p>
                        <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> กราฟพาเรโตจัดเรียงอาการเสียจากมากไปน้อย (หลัก 80/20) ช่วยให้ฝ่ายผลิตและ QC เห็นภาพได้ชัดเจนว่าควรพุ่งเป้าไปที่การแก้ไขอาการเสียใดเป็นอันดับแรก</p>
                        ${imgPareto ? `<img src="${imgPareto}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                    </div>
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm">
                        <p class="text-sm font-bold text-gray-800 mb-1">📈 Trend ปัญหา NG แยกตามอาการ</p>
                        <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> กราฟแสดงแนวโน้มของอาการเสียแต่ละประเภทแบบรายวัน เพื่อตรวจสอบว่าปัญหาเกิดซ้ำๆ ในวันใด หรือเพื่อยืนยันผลการแก้ไข (Action taken) ว่าได้ผลหรือไม่</p>
                        ${imgNgTrend ? `<img src="${imgNgTrend}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                    </div>
                </div>
                
                <div class="border border-gray-200 p-3 rounded bg-white shadow-sm page-break-inside-avoid">
                    <p class="text-sm font-bold text-gray-800 mb-1">🏭 วิเคราะห์แหล่งกำเนิด NG แยกตามเครื่องจักร (Defect Source Mapping)</p>
                    <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> กราฟนี้ช่วยเจาะจงและบ่งชี้ว่า "เครื่องจักรใด" เป็นตัวการหลักในการสร้าง "ของเสียประเภทใด" (เครื่องที่สร้างของเสียมากสุด: <b>${topMacNg.name}</b>)</p>
                    ${imgNgMac ? `<img src="${imgNgMac}" class="w-full h-auto max-w-4xl mx-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                </div>
            </div>
        </div>

        <div class="page-break-before print-page">
            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-green-500 pl-2 mb-3 bg-gray-50 py-1">4. ประสิทธิภาพแยกตามเครื่องจักรและเวลา (Performance Breakdown)</h3>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm">
                        <p class="text-sm font-bold text-gray-800 mb-1">📦 % Yield by Model (ผลตอบแทนตามรุ่น)</p>
                        <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> เปรียบเทียบ Yield เพื่อให้ทราบว่าการตั้งค่าผลิตสินค้ารุ่นใดมีความยากง่าย (รุ่นที่ดีที่สุด: <b>${bestModel.name}</b> | รุ่นที่แย่ที่สุด: <b>${worstModel.name}</b>)</p>
                        ${imgYieldModel ? `<img src="${imgYieldModel}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                    </div>
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm">
                        <p class="text-sm font-bold text-gray-800 mb-1">⚙️ % Yield by Machine (ผลตอบแทนตามเครื่อง)</p>
                        <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> เปรียบเทียบประสิทธิภาพการเดินเครื่องจักรแบบรายตัว เพื่อค้นหาความผิดปกติของเครื่องจักร (ดีสุด: <b>${highestYieldMac.name}</b> | แย่สุด: <b>${lowestYieldMac.name}</b>)</p>
                        ${imgYieldMac ? `<img src="${imgYieldMac}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                    </div>
                </div>
                
                <div class="border border-gray-200 p-3 rounded bg-white shadow-sm page-break-inside-avoid">
                    <p class="text-sm font-bold text-gray-800 mb-1">⏱️ Hourly Production Profile (อัตราการผลิตรายชั่วโมง)</p>
                    <p class="text-[10px] text-gray-600 mb-2 leading-relaxed"><b>คำอธิบาย:</b> กราฟแสดงความต่อเนื่องในการผลิตของสายงานตลอดทั้งกะ ช่วยให้ฝ่ายจัดการเห็นคอขวดหรือช่วงเวลาที่ความเร็วการผลิตตกลง (ช่วง Peak ของกะ: <b>${peakHour.label}</b>)</p>
                    ${imgHourly ? `<img src="${imgHourly}" class="w-full h-auto max-w-4xl mx-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                </div>
            </div>

            <div class="mt-12 pt-8 grid grid-cols-3 gap-4 text-center page-break-inside-avoid">
                <div>
                    <div class="h-16 border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
                    <p class="text-sm font-bold">Reported By</p>
                    <p class="text-xs text-gray-500">(Production Leader)</p>
                </div>
                <div>
                    <div class="h-16 border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
                    <p class="text-sm font-bold">Checked By</p>
                    <p class="text-xs text-gray-500">(QA/QC Manager)</p>
                </div>
                <div>
                    <div class="h-16 border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
                    <p class="text-sm font-bold">Approved By</p>
                    <p class="text-xs text-gray-500">(Plant Manager)</p>
                </div>
            </div>
            
            <div class="text-center text-xs text-gray-400 mt-10 pt-4 border-t">
                Generated by CWM Auto Report System - ${printTime}
            </div>
        </div>
    `;

    content.innerHTML = html;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
    
    document.body.style.overflow = '';
};

window.closeAutoReport = function() {
    const modal = document.getElementById('modal-auto-report');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
};

window.printAutoReport = function() {
    document.body.classList.add('printing-auto-report');
    window.print();
    
    setTimeout(() => {
        document.body.classList.remove('printing-auto-report');
    }, 1000);
};

// ==========================================
// 🌟 4. โค้ดเดิมทั้งหมด (Production System)
// ==========================================

function formatMaintTime(t) {
    if (!t) return '?';
    if (String(t).includes('T')) {
        return t.split('T')[1].substring(0, 5);
    }
    return t;
}

function capitalizeFirst(str) {
    if (!str) return "";
    let strTrimmed = str.trim();
    if (strTrimmed.length > 0) {
        return strTrimmed.charAt(0).toUpperCase() + strTrimmed.slice(1);
    }
    return strTrimmed;
}

function normalizeSymptomList(list) {
    const unique = [];
    list.forEach(item => {
        if (item && item.trim() !== '') {
            const stdStr = capitalizeFirst(item);
            if (!unique.some(u => u.toLowerCase() === stdStr.toLowerCase())) {
                unique.push(stdStr);
            }
        }
    });
    return unique;
}

function getShiftDateStr() {
    const now = new Date();
    if (now.getHours() < 8) {
        now.setDate(now.getDate() - 1);
    }
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

window.fetchOptions = async function() {
    try {
        const res = await fetch(`${SCRIPT_URL}?action=GET_OPTIONS&_t=${Date.now()}`);
        const data = await res.json();
        
        const allRecorders = new Set([...recorderList, ...(data.recorders || [])]);
        recorderList = Array.from(allRecorders);
        window.renderRecorderOptions();
        
        if (data.ngTypes && data.ngTypes.length > 0) {
           data.ngTypes.forEach(t => {
               const stdStr = capitalizeFirst(t);
               if(!ngSymptoms.some(s => s.toLowerCase() === stdStr.toLowerCase())) {
                   ngSymptoms.push(stdStr);
               }
           });
           ngSymptoms = normalizeSymptomList(ngSymptoms);
        }
        
        if (data.machineMapping) {
            machineMapping = data.machineMapping;
            localStorage.setItem('CWM_MACHINE_MAPPING', JSON.stringify(machineMapping));
            
            const rows = document.getElementById('batchList').children;
            for(let r of rows) {
                const mSel = r.querySelector('.machine-select-trigger');
                const pSel = r.querySelector('.product-select-target');
                if(mSel && mSel.value && machineMapping[mSel.value]) {
                    pSel.value = machineMapping[mSel.value];
                    pSel.dispatchEvent(new Event('change'));
                }
            }
        }

        if (data.hiddenWidgets) {
            hiddenWidgets = data.hiddenWidgets;
            window.applyWidgetVisibility();
        }

    } catch (e) { 
        console.log("Error fetching options", e); 
    }
};

window.initSortable = function() {
    const grid = document.getElementById('sortable-grid');
    Sortable.create(grid, { 
        handle: '.drag-handle', 
        animation: 150, 
        ghostClass: 'sortable-ghost', 
        onEnd: function() { 
            Object.values(charts).forEach(c => { if(c && typeof c.resize === 'function') c.resize(); }); 
        } 
    });
};

window.toggleMenu = function() {
    const menu = document.getElementById('dropdown-menu');
    menu.classList.toggle('hidden');
};

window.toggleLayout = function() {
    const debugOut = document.getElementById('debug-output');
    try {
        debugOut.innerText += "\n[System] ฟังก์ชัน toggleLayout ทำงานแล้ว...";
        window.isDualLayout = !window.isDualLayout;
        debugOut.innerText += `\n[System] สถานะเลย์เอาต์ที่ต้องการ: ${window.isDualLayout ? 'คู่' : 'เดี่ยว'}`;
        
        const grid = document.getElementById('sortable-grid');
        const btn = document.getElementById('layoutBtn');
        
        if (!grid || !btn) return;

        if (window.isDualLayout) {
            grid.classList.add('md:grid-cols-2');
            grid.classList.remove('layout-single'); 
            btn.innerText = '🔀 Layout: คู่';
        } else {
            grid.classList.remove('md:grid-cols-2');
            grid.classList.add('layout-single'); 
            btn.innerText = '🔀 Layout: เดี่ยว';
        }
        
        debugOut.innerText += "\n[System] เปลี่ยนคลาสสำเร็จ เริ่มรีไซส์กราฟ...";

        setTimeout(() => {
            let count = 0;
            Object.values(charts).forEach(c => { 
                if(c && typeof c.resize === 'function') {
                    c.resize(); 
                    count++;
                }
            });
            debugOut.innerText += `\n[System] รีไซส์กราฟเสร็จสิ้น ${count} อัน (สำเร็จ!)`;
        }, 150);
    } catch (err) {
        debugOut.innerText += `\n[Fatal Error] โค้ดพัง: ${err.message}`;
    }
};

window.toggleCardSize = function(btn) {
    const card = btn.closest('.widget-card');
    if (card.classList.contains('md:col-span-2')) {
        card.classList.remove('md:col-span-2'); 
    } else {
        card.classList.add('md:col-span-2');
    }
    setTimeout(() => {
        const canvas = card.querySelector('canvas');
        if(canvas) { 
            const chartInstance = Chart.getChart(canvas); 
            if(chartInstance) chartInstance.resize(); 
        }
    }, 150);
};

window.toggleCardHeight = function(btn) {
    const card = btn.closest('.widget-card');
    if (card.classList.contains('h-[350px]')) {
        card.classList.remove('h-[350px]');
        card.classList.add('h-[600px]'); 
    } else if (card.classList.contains('h-[600px]')) {
        card.classList.remove('h-[600px]');
        card.classList.add('h-[350px]');
    }
    setTimeout(() => {
        const canvas = card.querySelector('canvas');
        if(canvas) { 
            const chartInstance = Chart.getChart(canvas); 
            if(chartInstance) chartInstance.resize(); 
        }
    }, 150);
};

window.toggleCardMaximize = function(btn) {
    const card = btn.closest('.widget-card');
    const isMaximized = card.classList.contains('maximized-card');
    
    let dateLabel = card.querySelector('.max-date-label');
    if (!dateLabel) {
        dateLabel = document.createElement('div');
        dateLabel.className = 'max-date-label hidden text-sm font-medium text-blue-600 mb-2 pb-2 border-b border-gray-100 text-center w-full';
        const header = card.querySelector('.widget-header');
        if (header) header.insertAdjacentElement('afterend', dateLabel);
    }
    
    if (isMaximized) {
        card.classList.remove('maximized-card');
        document.body.style.overflow = ''; 
        btn.innerHTML = '⛶'; 
        btn.title = 'ขยายเต็มจอ';
        dateLabel.classList.add('hidden'); 
    } else {
        card.classList.add('maximized-card');
        document.body.style.overflow = 'hidden'; 
        btn.innerHTML = '✖'; 
        btn.title = 'ย่อหน้าจอ';
        
        const sDate = document.getElementById('startDate').value;
        const eDate = document.getElementById('endDate').value;
        const shift = document.getElementById('filterShift').options[document.getElementById('filterShift').selectedIndex].text;
        const shiftType = document.getElementById('filterShiftType').options[document.getElementById('filterShiftType').selectedIndex].text;
        
        dateLabel.innerHTML = `📅 ข้อมูลวันที่: <span class="text-gray-700 font-bold">${sDate}</span> ถึง <span class="text-gray-700 font-bold">${eDate}</span> <span class="mx-2 text-gray-300">|</span> กะ: <span class="text-gray-700 font-bold">${shift}</span> <span class="mx-2 text-gray-300">|</span> ช่วง: <span class="text-gray-700 font-bold">${shiftType}</span>`;
        dateLabel.classList.remove('hidden'); 
    }
    
    setTimeout(() => {
        const canvas = card.querySelector('canvas');
        if(canvas) { 
            const chartInstance = Chart.getChart(canvas); 
            if(chartInstance) {
                chartInstance.resize(); 
                chartInstance.update(); 
            }
        }
    }, 150);
};

window.detectCurrentShift = function() {
    const hour = new Date().getHours();
    let type = (hour >= 8 && hour < 20) ? "Day" : "Night";
    document.querySelector(`input[name="shift_type_toggle"][value="${type}"]`).checked = true;
    window.updateHourSlots(type);
};

window.updateHourSlots = function(type) {
    const select = document.getElementById('hourSlot');
    const hours = (type === "Day") ? DAY_HOURS : NIGHT_HOURS;
    select.innerHTML = hours.map(h => `<option value="${h}">${h}</option>`).join('');
    
    const currentHourStr = new Date().getHours().toString().padStart(2, '0') + ":00";
    const match = hours.find(h => h.startsWith(currentHourStr));
    if(match) select.value = match;
};

window.switchTab = function(tab) {
    if (!window.currentUser) return;
    const role = window.currentUser.role;

    if ((role === 'Production' || role === 'QC') && (tab === 'planning' || tab === 'admin')) return;
    if (role === 'Planning' && (tab === 'form' || tab === 'rw' || tab === 'admin' || tab === 'maint')) return;
    if (role === 'Viewer' && tab !== 'dashboard') return;

    ['form', 'planning', 'dashboard', 'admin'].forEach(t => {
        const el = document.getElementById('section-'+t);
        if(el) el.classList.toggle('hidden', t !== tab);
        const btn = document.getElementById('tab-'+t);
        if(btn) {
            if(t === tab) { 
                btn.classList.add('tab-active','text-blue-600'); 
                btn.classList.remove('text-gray-500'); 
            } else { 
                btn.classList.remove('tab-active','text-blue-600'); 
                btn.classList.add('text-gray-500'); 
            }
        }
    });
    if(tab==='dashboard') window.loadDashboard();
};

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
        
        await fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        }); 
        
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
        const payload = { 
            action: 'UNDO_BATCH_PRODUCTION', 
            batchId: window.lastBatchId 
        };
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
        productionDate: date, 
        shift: fd.get('shift'), 
        shiftType: shiftType, 
        recorder: currentRec, 
        hourSlot: hourSlot,
        batchId: newBatchId 
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

            validationMsg += `▶ ${item.machine}:\n`;
            validationMsg += `   - ยอดในระบบมีแล้ว: ${existingFg} ตัว\n`;
            validationMsg += `   - กำลังบันทึกเพิ่ม: ${item.fgAmount} ตัว\n`;
            validationMsg += `   - รวมเป็น: ${totalFg} ตัว\n\n`;

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

window.printReport = function() {
    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    const shift = document.getElementById('filterShift').options[document.getElementById('filterShift').selectedIndex].text;
    const shiftType = document.getElementById('filterShiftType').options[document.getElementById('filterShiftType').selectedIndex].text;
    
    let subtitle = `วันที่: ${sDate}`;
    if(sDate !== eDate) subtitle += ` ถึง ${eDate}`;
    subtitle += ` | กะ: ${shift} | ช่วงเวลา: ${shiftType}`;
    
    document.getElementById('print-date-subtitle').innerText = subtitle;
    window.print();
};

window.exportCSV = function() {
    if (!currentDashboardData) {
        alert("⚠️ กรุณากดปุ่มค้นหาข้อมูล (ดึง Dashboard) ก่อนทำการส่งออก Excel");
        return;
    }
    
    const data = currentDashboardData;
    
    let csvContent = "\ufeff"; 
    csvContent += "Machine,Product Assigned,FG (Pcs),NG (Pcs),NG (Kg),% Yield\n";
    
    for(let i=1; i<=16; i++) {
        const m = `CWM-${String(i).padStart(2,'0')}`; 
        const d = (data.machineData && data.machineData[m]) ? data.machineData[m] : {fg:0, ngTotal:0, ngTotalKg:0, ngTotalPcs:0};
        
        const ngPcs = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
        const ngKg = d.ngTotalKg || 0;
        
        const t = d.fg + ngPcs; 
        const y = t > 0 ? ((d.fg/t)*100).toFixed(2) : "0.00";
        
        const productAssigned = machineMapping[m] || 'Unassigned';
        
        csvContent += `${m},${productAssigned},${d.fg},${ngPcs},${ngKg.toFixed(2)},${y}%\n`;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const sDate = document.getElementById('startDate').value;
    
    link.setAttribute("href", url);
    link.setAttribute("download", `CWM_Report_${sDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.loadDashboard = async function() {
    if(!SCRIPT_URL) return;
    document.getElementById('dashboard-content').classList.add('hidden');
    document.getElementById('dashboard-loader').classList.remove('hidden');
    const debugPanel = document.getElementById('debug-panel');
    const debugOut = document.getElementById('debug-output');
    
    const start = document.getElementById('startDate').value.trim(); 
    const end = document.getElementById('endDate').value.trim();
    const shift = document.getElementById('filterShift').value.trim(); 
    const shiftType = document.getElementById('filterShiftType').value.trim();
    
    const isPartialView = (shift !== 'All' || shiftType !== 'All');
    
    let rawText = "";
    try {
        debugOut.innerText = `[Dashboard] Loading data for ${start} to ${end}...`;
        
        const fetchUrl = `${SCRIPT_URL}?action=GET_DASHBOARD&start=${start}&end=${end}&shift=${shift}&shiftType=${shiftType}&_t=${Date.now()}`;
        const res = await fetch(fetchUrl);
        
        rawText = await res.text();
        
        let data;
        try {
            data = JSON.parse(rawText);
        } catch(parseError) {
            throw new Error("ระบบหลังบ้านส่งข้อมูลกลับมาไม่ถูกต้อง (ไม่ใช่ JSON)\nรายละเอียด:\n" + rawText.substring(0, 500));
        }

        if (data.error) {
            throw new Error("ข้อผิดพลาดจากเซิร์ฟเวอร์: " + data.error);
        }

        const normalizedNgMapPcs = {};
        const normalizedNgMapKg = {};
        
        (data.ngLabels || []).forEach((label, i) => {
            const stdLabel = ngSymptoms.find(s => s.toLowerCase() === label.trim().toLowerCase()) || capitalizeFirst(label.trim());
            const vPcs = data.ngValuesPcs ? data.ngValuesPcs[i] : (data.ngValues ? data.ngValues[i] : 0);
            const vKg = data.ngValuesKg ? data.ngValuesKg[i] : 0;
            
            normalizedNgMapPcs[stdLabel] = (normalizedNgMapPcs[stdLabel] || 0) + vPcs;
            normalizedNgMapKg[stdLabel] = (normalizedNgMapKg[stdLabel] || 0) + vKg;
        });
        
        data.ngLabels = Object.keys(normalizedNgMapPcs);
        data.ngValuesPcs = Object.values(normalizedNgMapPcs);
        data.ngValuesKg = data.ngLabels.map(l => normalizedNgMapKg[l]);

        if (data.machineData) {
            for (let m in data.machineData) {
                const mData = data.machineData[m];
                const newBreakdownPcs = {};
                const newBreakdownKg = {};
                
                const oldPcs = mData.ngBreakdownPcs || mData.ngBreakdown || {};
                for (let k in oldPcs) {
                    const stdLabel = capitalizeFirst(k);
                    newBreakdownPcs[stdLabel] = (newBreakdownPcs[stdLabel] || 0) + oldPcs[k];
                }
                
                const oldKg = mData.ngBreakdownKg || {};
                for (let k in oldKg) {
                    const stdLabel = capitalizeFirst(k);
                    newBreakdownKg[stdLabel] = (newBreakdownKg[stdLabel] || 0) + oldKg[k];
                }
                
                mData.ngBreakdownPcs = newBreakdownPcs;
                mData.ngBreakdownKg = newBreakdownKg;
            }
        }
        
        if (data.productData) {
            for (let p in data.productData) {
                const pData = data.productData[p];
                const newBreakdownPcs = {};
                
                const oldPcs = pData.ngBreakdownPcs || {};
                for (let k in oldPcs) {
                    const stdLabel = capitalizeFirst(k);
                    newBreakdownPcs[stdLabel] = (newBreakdownPcs[stdLabel] || 0) + oldPcs[k];
                }
                
                pData.ngBreakdownPcs = newBreakdownPcs;
            }
        }

        if (data.dailyTrend) {
            data.dailyTrend.forEach(d => {
                if (d.ngBreakdown) {
                    const newBd = {};
                    for (let k in d.ngBreakdown) {
                        const stdLabel = ngSymptoms.find(s => s.toLowerCase() === k.trim().toLowerCase()) || capitalizeFirst(k.trim());
                        newBd[stdLabel] = (newBd[stdLabel] || 0) + d.ngBreakdown[k];
                    }
                    d.ngBreakdown = newBd;
                }
            });
        }
        
        const fg = data.totalFg || 0;
        const target = data.productionTarget || 0;
        const ngPcs = data.totalNgPcs !== undefined ? data.totalNgPcs : (data.totalNg || 0);
        const ngKg = data.totalNgKg || 0;
        
        if (fg === 0 && ngPcs === 0 && target === 0) {
            debugOut.innerText += `\n[Warning] ข้อมูลในวันที่ ${start} เป็น 0 ทั้งหมด`;
        } else {
            debugOut.innerText += `\n[Success] พบข้อมูล FG=${fg}, NG=${ngPcs}`;
        }

        document.getElementById('stat-fg').innerText = fg.toLocaleString();
        
        let targetDisplay = target.toLocaleString();
        if (isPartialView && target > 0) {
            targetDisplay += ` <span class="text-sm text-gray-500 font-medium">/day</span>`;
        }
        document.getElementById('stat-target').innerHTML = targetDisplay;
        
        document.getElementById('stat-ng').innerText = `${ngPcs.toLocaleString()} ชิ้น`;
        document.getElementById('stat-ng-sub').innerText = `(${ngKg.toFixed(2)} Kg)`;
        
        const ach = target > 0 ? ((fg / target) * 100).toFixed(1) : 0;
        document.getElementById('stat-achievement').innerText = ach + "%";
        document.getElementById('progress-achievement').style.width = Math.min(ach, 100) + "%";
        
        const total = fg + ngPcs;
        const yieldVal = total > 0 ? ((fg / total) * 100).toFixed(2) : 0;
        document.getElementById('stat-yield').innerText = yieldVal + "%";
        
        let workDays = data.datesFound ? Object.keys(data.datesFound).length : 0;
        if (workDays === 0) {
            const sDate = new Date(start);
            const eDate = new Date(end);
            workDays = Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;
        }
        if (workDays <= 0 || isNaN(workDays)) workDays = 1;

        let activeSlots = 0; 
        if(data.hourlyData) activeSlots = data.hourlyData.filter(v => v > 0).length;
        if(activeSlots === 0) activeSlots = 1;

        const uph = (fg / (workDays * activeSlots)).toFixed(0);
        document.getElementById('stat-uph').innerText = uph;

        currentDashboardData = data;
        
        if (typeof window.renderCharts === 'function') {
            window.renderCharts(data); 
            window.renderTable(data); 
            window.renderFgByModel(data, isPartialView);
            window.renderSimulator(data); 
        }

    } catch(e) { 
        console.error("Dashboard Load Error: ", e); 
        debugPanel.classList.remove('hidden');
        debugOut.innerText += `\n[Error Message]\n${e.message}\n\n[Stack Trace]\n${e.stack || "No Stack Trace"}\n\n[Raw Response Text]\n${rawText.substring(0, 500)}`;
        alert("เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาตรวจสอบที่แผง Debug สีแดงด้านบน");
    } finally { 
        document.getElementById('dashboard-loader').classList.add('hidden'); 
        document.getElementById('dashboard-content').classList.remove('hidden'); 
    }
};

// ==========================================
// 🌟 ส่วนปรับปรุง: ระบบ Auto Report พร้อมคำอธิบาย
// ==========================================
window.openAutoReport = function() {
    if (!currentDashboardData) {
        alert("⚠️ กรุณากดปุ่ม 🔍ค้นหา เพื่อดึงข้อมูลสำหรับสร้างรายงานก่อนครับ");
        return;
    }

    const data = currentDashboardData;
    const modal = document.getElementById('modal-auto-report');
    const content = document.getElementById('auto-report-content');

    const totalFG = data.totalFg || 0;
    const totalNG = data.totalNgPcs !== undefined ? data.totalNgPcs : (data.totalNg || 0);
    const totalQty = totalFG + totalNG;
    const yieldPct = totalQty > 0 ? ((totalFG/totalQty)*100).toFixed(2) : "0.00";
    const target = data.productionTarget || 0;
    const achPct = target > 0 ? ((totalFG/target)*100).toFixed(1) : "0.0";
    
    let achHtml = '';
    if (target === 0) achHtml = `<span class="text-gray-500">N/A</span>`;
    else if (achPct >= 100) achHtml = `<span class="text-green-600 font-bold">${achPct}% (Achieved)</span>`;
    else if (achPct >= 80) achHtml = `<span class="text-orange-500 font-bold">${achPct}% (Warning)</span>`;
    else achHtml = `<span class="text-red-600 font-bold">${achPct}% (Below Target)</span>`;

    const labels = data.ngLabels || [];
    const vals = data.ngValuesPcs || data.ngValues || [];
    const ngItems = labels.map((l, i) => ({ label: l, pcs: vals[i] || 0 })).filter(i => i.pcs > 0).sort((a,b)=>b.pcs-a.pcs);
    
    let topNgHtml = '';
    if(ngItems.length > 0) {
        topNgHtml = `<ul class="list-disc pl-5 mt-2 space-y-1 text-sm text-gray-700">`;
        ngItems.slice(0, 3).forEach((item, idx) => {
            let pct = totalNG > 0 ? ((item.pcs / totalNG) * 100).toFixed(1) : 0;
            topNgHtml += `<li>อันดับ ${idx+1}: <b>${item.label}</b> จำนวน ${item.pcs.toLocaleString()} ชิ้น (${pct}%)</li>`;
        });
        topNgHtml += `</ul>`;
    } else {
        topNgHtml = `<p class="mt-2 text-green-600 font-bold text-sm">🎉 ยอดเยี่ยม ไม่พบของเสียในระบบ</p>`;
    }

    let topMacNg = { name: '-', ng: 0 };
    let lowestYieldMac = { name: '-', yield: 100 };
    let highestYieldMac = { name: '-', yield: 0 };
    
    if(data.machineData) {
        for(let m in data.machineData) {
            const md = data.machineData[m];
            const mNg = md.ngTotalPcs !== undefined ? md.ngTotalPcs : (md.ngTotal || 0);
            const mT = md.fg + mNg;
            const mY = mT > 0 ? ((md.fg/mT)*100) : 0;
            
            if(mNg > topMacNg.ng) topMacNg = { name: m, ng: mNg };
            if(mT > 0) {
                if(mY < lowestYieldMac.yield) lowestYieldMac = { name: m, yield: mY.toFixed(2) };
                if(mY > highestYieldMac.yield) highestYieldMac = { name: m, yield: mY.toFixed(2) };
            }
        }
    }

    let bestModel = {name: '-', yield: 0};
    let worstModel = {name: '-', yield: 100};
    if(data.productData) {
        for(let p in data.productData) {
            let d = data.productData[p];
            let n = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
            let t = d.fg + n;
            let y = t > 0 ? (d.fg/t)*100 : 0;
            if(t > 0) {
                if(y >= bestModel.yield) bestModel = {name: p, yield: y.toFixed(2)};
                if(y <= worstModel.yield) worstModel = {name: p, yield: y.toFixed(2)};
            }
        }
    }

    let peakHour = {label: '-', fg: 0};
    if(data.hourlyData && data.hourlyLabels) {
        data.hourlyData.forEach((val, idx) => {
            if(val > peakHour.fg) {
                peakHour = {label: data.hourlyLabels[idx], fg: val};
            }
        });
    }

    const getChartImg = (id) => {
        const canvas = document.getElementById(id);
        return (canvas && canvas.toDataURL) ? canvas.toDataURL('image/png', 1.0) : '';
    };

    const imgDailyOutput = getChartImg('dailyOutputChart');
    const imgTrendNG = getChartImg('qcTrendChart');
    const imgPareto = getChartImg('paretoChart');
    const imgNgTrend = getChartImg('ngSymptomTrendChart');
    const imgNgMac = getChartImg('ngByMachineChart');
    const imgYieldModel = getChartImg('yieldModelChart');
    const imgYieldMac = getChartImg('yieldMachineChart');
    const imgHourly = getChartImg('hourlyChart');

    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    const dateStr = sDate === eDate ? sDate : `${sDate} ถึง ${eDate}`;
    const shiftName = document.getElementById('filterShift').options[document.getElementById('filterShift').selectedIndex].text;
    const shiftType = document.getElementById('filterShiftType').options[document.getElementById('filterShiftType').selectedIndex].text;
    const printTime = new Date().toLocaleString('th-TH');

    let html = `
        <div class="print-page">
            <div class="border-b-2 border-gray-800 pb-4 mb-6">
                <div class="flex justify-between items-end">
                    <div>
                        <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tight">Production & Quality Report</h1>
                        <p class="text-gray-600 mt-1 font-medium">รายงานสรุปผลการผลิตและควบคุมคุณภาพเชิงลึก</p>
                    </div>
                    <div class="text-right text-sm text-gray-500">
                        <p><b>Printed:</b> ${printTime}</p>
                    </div>
                </div>
                <div class="mt-4 flex gap-6 text-sm bg-gray-100 p-2 rounded border border-gray-200">
                    <span class="font-bold">📅 วันที่: <span class="font-normal text-blue-700">${dateStr}</span></span>
                    <span class="font-bold">🕒 กะการทำงาน: <span class="font-normal text-blue-700">${shiftName} (${shiftType})</span></span>
                </div>
            </div>

            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-2 mb-3 bg-gray-50 py-1">1. สรุปประสิทธิภาพภาพรวม (Executive Summary)</h3>
                <div class="grid grid-cols-5 gap-3 text-center">
                    <div class="border border-gray-300 rounded p-3 bg-white">
                        <p class="text-[10px] text-gray-500 font-bold uppercase">Target (Plan)</p>
                        <p class="text-xl font-bold text-indigo-700">${target.toLocaleString()}</p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-white">
                        <p class="text-[10px] text-gray-500 font-bold uppercase">Total Good (FG)</p>
                        <p class="text-xl font-bold text-blue-600">${totalFG.toLocaleString()}</p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-white">
                        <p class="text-[10px] text-gray-500 font-bold uppercase">Achievement</p>
                        <p class="text-lg">${achHtml}</p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-red-50">
                        <p class="text-[10px] text-red-600 font-bold uppercase">Total Defect (NG)</p>
                        <p class="text-xl font-bold text-red-600">${totalNG.toLocaleString()} <span class="text-xs font-normal">ชิ้น</span></p>
                    </div>
                    <div class="border border-gray-300 rounded p-3 bg-green-50">
                        <p class="text-[10px] text-green-700 font-bold uppercase">Overall Yield</p>
                        <p class="text-xl font-bold text-green-700">${yieldPct}%</p>
                    </div>
                </div>
            </div>

            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-indigo-500 pl-2 mb-3 bg-gray-50 py-1">2. แนวโน้มผลผลิตและอัตราของเสียรายวัน (Production & Defect Trends)</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm flex flex-col">
                        <p class="text-sm font-bold text-gray-800 mb-1">📊 Daily Output (FG vs NG)</p>
                        <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> กราฟแท่งแสดงปริมาณการผลิตงานดี (สีน้ำเงิน) เปรียบเทียบกับปริมาณของเสีย (สีแดง) ในแต่ละวัน ช่วยให้ฝ่ายบริหารเห็นภาพรวมของกำลังการผลิตและการบรรลุเป้าหมายการทำงานในภาพรวมขององค์กร</p>
                        <div class="mt-auto">
                            ${imgDailyOutput ? `<img src="${imgDailyOutput}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                        </div>
                    </div>
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm flex flex-col">
                        <p class="text-sm font-bold text-gray-800 mb-1">📉 Daily NG Rate Trend (%)</p>
                        <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> กราฟเส้นแสดงสัดส่วนร้อยละของของเสียที่เกิดขึ้นแบบรายวัน (อัตราของเสียเฉลี่ยรอบนี้: <b class="text-red-600">${(totalQty > 0 ? (totalNG/totalQty)*100 : 0).toFixed(2)}%</b>) ใช้เพื่อติดตามความเสถียรของกระบวนการ หากกราฟพุ่งสูงเกินขอบเขตควรพิจารณาปรับปรุงกระบวนการทันที</p>
                        <div class="mt-auto">
                            ${imgTrendNG ? `<img src="${imgTrendNG}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="page-break-before print-page">
            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-red-500 pl-2 mb-3 bg-gray-50 py-1">3. การวิเคราะห์ปัญหาคุณภาพเชิงลึก (Quality Issue Analysis)</h3>
                
                <div class="bg-red-50 border border-red-200 p-4 rounded mb-4 shadow-sm">
                    <p class="text-sm font-bold text-red-800 mb-2">💡 ข้อค้นพบหลักด้านคุณภาพ (Top Defect Insights):</p>
                    ${topNgHtml}
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm flex flex-col">
                        <p class="text-sm font-bold text-gray-800 mb-1">📉 Pareto Analysis (สะสมความถี่ปัญหา)</p>
                        <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> กราฟพาเรโตจัดเรียงประเภทของเสียที่เกิดขึ้นบ่อยที่สุดไว้ด้านซ้าย (หลัก 80/20) ข้อมูลนี้ช่วยให้วิศวกรและแผนก QC ตัดสินใจได้แม่นยำว่าควรทุ่มเททรัพยากรแก้ไขอาการเสียประเภทใดเป็นอันดับแรกเพื่อให้ได้ผลลัพธ์คุ้มค่าที่สุด</p>
                        <div class="mt-auto">
                            ${imgPareto ? `<img src="${imgPareto}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                        </div>
                    </div>
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm flex flex-col">
                        <p class="text-sm font-bold text-gray-800 mb-1">📈 Trend ปัญหา NG แยกตามอาการ (รายวัน)</p>
                        <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> กราฟแสดงการกระจายตัวของอาการเสียแต่ละประเภทแบบรายวัน เพื่อตรวจสอบว่าปัญหาเกิดขึ้นซ้ำเฉพาะบางวัน หรือเกิดขึ้นอย่างต่อเนื่อง และใช้ดูผลลัพธ์หลังจากการซ่อมบำรุงว่าปัญหาได้หมดไปหรือไม่</p>
                        <div class="mt-auto">
                            ${imgNgTrend ? `<img src="${imgNgTrend}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                        </div>
                    </div>
                </div>
                
                <div class="border border-gray-200 p-3 rounded bg-white shadow-sm page-break-inside-avoid">
                    <p class="text-sm font-bold text-gray-800 mb-1">🏭 วิเคราะห์แหล่งกำเนิด NG แยกตามเครื่องจักร (Defect Source Mapping)</p>
                    <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> กราฟแท่งแสดงข้อมูลการแจกแจงอาการเสียที่พบในเครื่องจักรแต่ละเครื่องอย่างละเอียด ช่วยตอบคำถามว่า "เครื่องจักรใด" เป็นต้นเหตุที่แท้จริงของการเกิด "ของเสียประเภทต่างๆ" (เครื่องที่มีสัดส่วนของเสียมากที่สุดในช่วงนี้คือ: <b class="text-red-600">${topMacNg.name}</b>)</p>
                    ${imgNgMac ? `<img src="${imgNgMac}" class="w-full h-auto max-w-4xl mx-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                </div>
            </div>
        </div>

        <div class="page-break-before print-page">
            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-green-500 pl-2 mb-3 bg-gray-50 py-1">4. ประสิทธิภาพแยกตามปัจจัยการผลิต (Performance Breakdown)</h3>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm flex flex-col">
                        <p class="text-sm font-bold text-gray-800 mb-1">📦 % Yield by Model (ผลตอบแทนตามรุ่นสินค้า)</p>
                        <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> แสดงอัตราผลตอบแทนจากการผลิตแยกตามโมเดลสินค้า ช่วยประเมินว่าสินค้ารุ่นใดมีความยาก/ง่ายในการผลิต หรือต้องการกระบวนการควบคุมคุณภาพที่เข้มงวดมากขึ้น (รุ่นที่ดีที่สุด: <b class="text-green-600">${bestModel.name}</b> | รุ่นที่สูญเสียมากที่สุด: <b class="text-red-600">${worstModel.name}</b>)</p>
                        <div class="mt-auto">
                            ${imgYieldModel ? `<img src="${imgYieldModel}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                        </div>
                    </div>
                    <div class="border border-gray-200 p-3 rounded bg-white shadow-sm flex flex-col">
                        <p class="text-sm font-bold text-gray-800 mb-1">⚙️ % Yield by Machine (ผลตอบแทนตามเครื่องจักร)</p>
                        <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> เปรียบเทียบประสิทธิภาพการเดินเครื่องจักรแบบรายตัว เครื่องจักรที่กราฟมีระดับต่ำกว่ามาตรฐานอย่างมีนัยสำคัญ ควรได้รับการตรวจสอบหรือตั้งค่าแจ้งเตือนการบำรุงรักษา (เครื่องที่มีประสิทธิภาพดีสุด: <b class="text-green-600">${highestYieldMac.name}</b> | ประสิทธิภาพต่ำสุด: <b class="text-red-600">${lowestYieldMac.name}</b>)</p>
                        <div class="mt-auto">
                            ${imgYieldMac ? `<img src="${imgYieldMac}" class="w-full h-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                        </div>
                    </div>
                </div>
                
                <div class="border border-gray-200 p-3 rounded bg-white shadow-sm page-break-inside-avoid">
                    <p class="text-sm font-bold text-gray-800 mb-1">⏱️ Hourly Production Profile (อัตราการผลิตรายชั่วโมง)</p>
                    <p class="text-[10px] text-gray-600 mb-3 leading-relaxed"><b>คำอธิบายกราฟ:</b> กราฟแสดงความต่อเนื่องในการผลิตของสายงานตลอดทั้งกะ ช่วยให้ผู้นำงานเห็นถึง "คอขวด" หรือช่วงเวลาที่มีปัญหาขัดข้อง ทำให้ความเร็วการผลิตตกลง และประเมินความสม่ำเสมอในการทำงานของพนักงานแต่ละช่วงเวลาได้ (ชั่วโมงที่มียอดการผลิตสูงที่สุดคือ: <b class="text-blue-600">${peakHour.label}</b> จำนวน ${peakHour.fg} ชิ้น)</p>
                    ${imgHourly ? `<img src="${imgHourly}" class="w-full h-auto max-w-4xl mx-auto border rounded border-gray-100" />` : '<p class="text-center text-xs">No Graph</p>'}
                </div>
            </div>

            <div class="mt-12 pt-8 grid grid-cols-3 gap-4 text-center page-break-inside-avoid">
                <div>
                    <div class="h-16 border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
                    <p class="text-sm font-bold">Reported By</p>
                    <p class="text-xs text-gray-500">(Production Leader)</p>
                </div>
                <div>
                    <div class="h-16 border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
                    <p class="text-sm font-bold">Checked By</p>
                    <p class="text-xs text-gray-500">(QA/QC Manager)</p>
                </div>
                <div>
                    <div class="h-16 border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
                    <p class="text-sm font-bold">Approved By</p>
                    <p class="text-xs text-gray-500">(Plant Manager)</p>
                </div>
            </div>
            
            <div class="text-center text-xs text-gray-400 mt-10 pt-4 border-t">
                Generated by CWM Auto Report System (Analytical Report Edition) - ${printTime}
            </div>
        </div>
    `;

    content.innerHTML = html;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
    
    document.body.style.overflow = '';
};
