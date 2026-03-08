const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyt3Bf_2h21BBcCHQSjizowy_kD5vsoUqgaC_YmVjLuQybJO1BBRt3eaSM0PuKEFfvruw/exec";
        
let ngSymptoms = ["ลวดถลอก (Scratched)", "พันหลวม (Loose)", "รอบไม่ครบ (Turn Error)", "ขาผิดรูป (Lead Deform)", "อื่นๆ (Others)"];
let productList = ["S1B29288-JR (10A)", "S1B71819-JR (16A)", "S1B29292-JR (20A)", "51207080HC-JR (25/32A)"];
let recorderList = ["พนักงาน 1", "พนักงาน 2"];

let machineMapping = {};
let hiddenWidgets = []; 

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
// 🌟 3. ระบบ Auto Report (3 Languages & Deep Analytics)
// ==========================================
window.openAutoReport = function() {
    if (!currentDashboardData) {
        alert("⚠️ กรุณากดปุ่ม 🔍ค้นหา เพื่อดึงข้อมูลสำหรับสร้างรายงานก่อนครับ");
        return;
    }

    const modal = document.getElementById('modal-auto-report');
    
    // 🌟 แก้ไขการดึงปุ่ม 3 ภาษาให้แสดงผลแน่นอน 100% 🌟
    let langSelector = document.getElementById('report-lang-selector');
    if (!langSelector) {
        // หา Header ของ Modal Auto Report (เอาตัวแรกสุดที่เป็นแถบเมนูด้านบน)
        const modalHeader = modal.querySelector('div:first-child');
        if (modalHeader) {
            // หา div ที่เป็นกล่องเก็บปุ่มด้านขวา (ปุ่ม พิมพ์ และ ปิด)
            const actionContainer = modalHeader.querySelector('div.flex');
            if (actionContainer) {
                actionContainer.insertAdjacentHTML('afterbegin', `
                    <select id="report-lang-selector" onchange="window.renderAutoReportContent(this.value)" class="border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors shadow-sm outline-none cursor-pointer">
                        <option value="TH">🇹🇭 TH (ภาษาไทย)</option>
                        <option value="EN">🇬🇧 EN (English)</option>
                        <option value="CH">🇨🇳 CH (中文)</option>
                    </select>
                `);
                langSelector = document.getElementById('report-lang-selector');
            }
        }
    }

    // โหลดภาษาตามที่ผู้ใช้เลือกไว้ หรือตั้งค่าเริ่มต้นเป็นภาษาไทย (TH)
    window.renderAutoReportContent(langSelector ? langSelector.value : 'TH');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
    
    document.body.style.overflow = '';
};

// ฟังก์ชันหลักสำหรับ Render Report Content ตามภาษา
window.renderAutoReportContent = function(lang = 'TH') {
    const data = currentDashboardData;
    const content = document.getElementById('auto-report-content');

    const totalFG = data.totalFg || 0;
    const totalNG = data.totalNgPcs !== undefined ? data.totalNgPcs : (data.totalNg || 0);
    const totalQty = totalFG + totalNG;
    const yieldPct = totalQty > 0 ? ((totalFG/totalQty)*100).toFixed(2) : "0.00";
    const avgNgRate = (totalQty > 0 ? (totalNG/totalQty)*100 : 0).toFixed(2);
    const isPassTarget = parseFloat(avgNgRate) <= 0.5;

    const labels = data.ngLabels || [];
    const vals = data.ngValuesPcs || data.ngValues || [];
    const ngItems = labels.map((l, i) => ({ label: l, pcs: vals[i] || 0 })).filter(i => i.pcs > 0).sort((a,b)=>b.pcs-a.pcs);
    
    let topNgSymptomName = '-';
    let topNgSymptomRatio = 0;

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

    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    const dateStr = sDate === eDate ? sDate : `${sDate} ถึง ${eDate}`;
    const shiftName = document.getElementById('filterShift').options[document.getElementById('filterShift').selectedIndex].text;
    const shiftType = document.getElementById('filterShiftType').options[document.getElementById('filterShiftType').selectedIndex].text;
    const printTime = new Date().toLocaleString('th-TH');

    // 🌟 ระบบแปลภาษา (Dictionary) 🌟
    const textData = {
        TH: {
            title: "Production Analytics Report",
            subtitle: "รายงานวิเคราะห์ผลการผลิตและดัชนีชี้วัดคุณภาพเชิงลึก (Target Limit: NG ≤ 0.5%)",
            printed: "Printed:",
            dateRange: "ขอบเขตข้อมูล:",
            shiftStr: "กะการทำงาน:",
            sec1: "1. ดัชนีชี้วัดผลการดำเนินงานหลัก (Key Performance Indicators)",
            fg: "Total Good (FG)",
            ng: "Total Defect (NG)",
            yield: "Overall Yield",
            pcs: "ชิ้น",
            overTarget: "OVER 0.5%",
            targetPassed: "TARGET PASSED",
            sec2: "2. การประเมินเสถียรภาพและแนวโน้มการผลิต (Production Stability Assessment)",
            sec2_1_title: "📊 บทวิเคราะห์การกระจายตัวของผลผลิต (Throughput Output)",
            sec2_1_desc: `จากการวิเคราะห์ความสัมพันธ์ระหว่างปริมาณงานดี (FG) และความสูญเสีย (NG) สะท้อนให้เห็นถึงขีดความสามารถการเดินเครื่องของฝ่ายผลิต หากกราฟแท่ง (FG) มีความสม่ำเสมอในแต่ละวัน บ่งชี้ถึงความพร้อมทางด้านทรัพยากรและประสิทธิภาพการดำเนินงานที่คงที่`,
            sec2_2_title: "📉 บทวิเคราะห์ความแปรปรวนของคุณภาพ (Process Variability)",
            sec2_2_desc: `สัดส่วนของเสียเฉลี่ย (Average NG Rate) ทรงตัวอยู่ที่ระดับ <b>${avgNgRate}%</b> โดยรูปแบบความผันผวนของเส้นกราฟรายวันจัดเป็นดัชนีชี้วัดสำคัญ เมื่อเทียบกับเป้าหมายองค์กรที่อนุญาตให้มีของเสียไม่เกิน <b>0.5%</b> หากพบว่ากราฟมีแนวโน้มพุ่งทะลุเส้นฐาน (Baseline 0.5%) อย่างผิดปกติ ควรระงับการผลิตชั่วคราวเพื่อประเมินความเบี่ยงเบนของตัวแปร 4M (Material, Machine) โดยด่วน`,
            sec3: "3. การวิเคราะห์สาเหตุความสูญเสียเชิงลึก (Defect Root Cause Diagnostics)",
            sec3_top: "💡 สรุปสถานการณ์ความผิดปกติหลัก (Top Quality Violations):",
            sec3_perfect: "🎉 สมบูรณ์แบบ ไม่พบของเสียหลุดรอดในกระบวนการผลิต",
            rank: "อันดับ",
            amount: "จำนวน",
            sec3_1_title: "📉 การจัดลำดับความสำคัญของปัญหา (Pareto Logic)",
            sec3_1_desc: `อ้างอิงจากหลักการพาเรโต (80/20 Rule) ปัญหาคอขวดด้านคุณภาพที่หล่อเลี้ยงความสูญเสียมากที่สุดคือ <b>{topNgSymptomName}</b> ซึ่งกินสัดส่วนสูงถึง <b>{topNgSymptomRatio}%</b> เพื่อผลักดันให้อัตราของเสียรวมของระบบลดลงสู่เป้าหมายที่ <b>0.5%</b> การกำหนดมาตรการ Corrective Action (CAR) โดยทุ่มเททรัพยากรพุ่งเป้าไปที่อาการเสียประเภทนี้เป็นอันดับแรก จะส่งมอบผลลัพธ์การกอบกู้ Yield กลับมาได้รวดเร็วที่สุด`,
            sec3_2_title: "📈 แนวโน้มการเกิดซ้ำของปัญหาเปรียบเทียบเป้าหมาย (Defect Chronology %)",
            sec3_2_desc: `การติดตามเปอร์เซ็นต์ของเสียแยกตามอาการแบบรายวัน ช่วยชี้ชัดว่าความผิดปกติเกิดจากตัวแปรภายนอกแบบชั่วคราว หรือฝังรากลึกในระบบ โดยกราฟด้านล่างมีเส้น <b>Target Limit 0.5% (เส้นประสีแดง)</b> หากกราฟอาการใดตัดผ่านเส้นนี้ขึ้นไป หมายถึงความล้มเหลวเฉพาะจุดที่ทำให้อัตราของเสียรวมหลุดเป้าหมายทันที`,
            sec3_3_title: "🏭 การชี้เป้าแหล่งกำเนิดปัญหาขัดข้อง (Defect Source Mapping)",
            sec3_3_desc: `ผลลัพธ์จากการ Mapping ข้อมูลเชื่อมโยงพฤติกรรมความเสียหายของชิ้นงานเข้ากับหมายเลขเครื่องจักร ยืนยันได้ว่าเครื่องจักร <b>${topMacNg.name}</b> เป็นศูนย์กลางหลักในการปั๊มของเสียสะสมที่ระดับ <b>${topMacNg.ng.toLocaleString()}</b> ชิ้น ข้อเสนอแนะเชิงวิศวกรรมคือ ควรยกระดับแผนการบำรุงรักษาเชิงป้องกัน (PM) หรือทำ Calibration พารามิเตอร์การเดินเครื่องจักรหมายเลขนี้ใหม่ทั้งหมด`,
            sec4: "4. ประเมินสมรรถนะการผลิตและอัตราการส่งผ่าน (Productivity Validation)",
            sec4_1_title: "📦 ข้อจำกัดทางการผลิตแยกตามรุ่น (Product Variance)",
            sec4_1_desc: `ความซับซ้อนของดีไซน์สินค้าสร้างความแตกต่างเชิงประสิทธิภาพอย่างเห็นได้ชัด รุ่น <b>${bestModel.name}</b> (บรรลุ Yield ที่ ${bestModel.yield}%) ควรนำมาถอดบทเรียนเป็น Best Practice ในแง่การตั้งค่า ส่วนรุ่น <b>${worstModel.name}</b> ที่ดึง Yield ตกลงไปต่ำสุด (${worstModel.yield}%) หรือมีสัดส่วนของเสียเกิน <b>0.5%</b> จำเป็นต้องจัดตั้งทีม Task Force พิเศษเพื่อประเมินความยากง่ายใน Manufacturing Process ใหม่อีกครั้ง`,
            sec4_2_title: "⚙️ ดัชนีความพร้อมของเครื่องจักร (Machine Health Index)",
            sec4_2_desc: `จากการประเมินรายตัวชี้ให้เห็นว่า เครื่อง <b>${highestYieldMac.name}</b> สามารถรักษาสถานะการทำงานได้สมบูรณ์ที่สุด (รันผลตอบแทนที่ ${highestYieldMac.yield}%) ในทางตรงกันข้าม เครื่อง <b>${lowestYieldMac.name}</b> อยู่ในภาวะเสื่อมถอยรุนแรง (Yield ตกไปที่ ${lowestYieldMac.yield}%, อัตราสูญเสียทะลุ 0.5% ร้ายแรง) ส่งสัญญาณเตือนถึงการขัดข้องเรื้อรังที่จำเป็นต้องสั่งพักเครื่องทันที`,
            sec4_3_title: "⏱️ จังหวะและอัตราเร่งการผลิตรายชั่วโมง (Throughput Profile)",
            sec4_3_desc: `ความลื่นไหลในการเดินสายพานมีความผันผวนตามความต่อเนื่องของช่วงเวลา ข้อมูลพบจุดสูบฉีดผลผลิตสูงสุด (Peak Performance Hour) ที่ช่วงเวลา <b>${peakHour.label}</b> โดยทำศักยภาพได้ถึง <b>${peakHour.fg.toLocaleString()}</b> ชิ้น ช่องว่างความเร็วระหว่างชั่วโมง Peak กับชั่วโมงที่ดรอปลง ถือเป็นความสูญเปล่าแฝง (Hidden Waste) อันอาจเกิดจากความเหนื่อยล้าของพนักงานหรือปัญหาการป้อนวัตถุดิบชะงักงัน หัวหน้างานควรนำพฤติกรรมกราฟนี้ไปใช้ประกอบการทำ Line Balancing`,
            sec5: "5. การวิเคราะห์แนวโน้มรายวันแยกตามเครื่องจักร (Machine-Level Daily Trend Analytics)",
            machine: "เครื่องจักร",
            avgYield: "Yield เฉลี่ย",
            targetEvalPass: "ผ่านเกณฑ์เป้าหมาย",
            targetEvalFail: "ตกเกณฑ์มาตรฐาน (NG > 0.5%)",
            defect: "ของเสีย",
            mDescPass: `จากการวิเคราะห์ข้อมูลเครื่องจักร <b>{m}</b> สามารถเดินผลผลิต FG ได้รวม <b>{totalMFg} ชิ้น</b> และพบของเสีย (NG) <b>{totalMNg} ชิ้น</b> เมื่อนำมาเทียบกับ<b>เป้าหมายควบคุมของเสียองค์กรที่ 0.5%</b> พบว่าเครื่องจักรเครื่องนี้ <b>{targetEval}</b> โดยมีอัตราความแปรปรวนรายวันที่ {variance}% ({stability}) ซึ่งสามารถรักษาความต่อเนื่องของคุณภาพได้อย่างดีเยี่ยมโดยไม่พบของเสียหลุดรอดในระบบ`,
            mDescFail: `จากการวิเคราะห์ข้อมูลเครื่องจักร <b>{m}</b> สามารถเดินผลผลิต FG ได้รวม <b>{totalMFg} ชิ้น</b> และพบของเสีย (NG) <b>{totalMNg} ชิ้น</b> เมื่อนำมาเทียบกับ<b>เป้าหมายควบคุมของเสียองค์กรที่ 0.5%</b> พบว่าเครื่องจักรเครื่องนี้ <b>{targetEval}</b> โดยมีอัตราความแปรปรวนรายวันที่ {variance}% ({stability}) ทั้งนี้ พบจุดวิกฤตที่อัตราของเสียพุ่งสูงสุดในวันที่ <b>{maxNgDate}</b> (แตะระดับ <b>{maxNgRate}%</b>) หากเกิน 0.5% ควรตรวจสอบประวัติ Maintenance เผื่อมีการตั้งค่า (Setup) หรือปัญหาขัดข้องแฝงเร้นในวันดังกล่าว`,
            noMachineData: "ไม่พบข้อมูลความแปรปรวนของเครื่องจักรในช่วงเวลานี้",
            repBy: "Reported By",
            chkBy: "Checked By",
            appBy: "Approved By",
            repByRole: "(Production Leader)",
            chkByRole: "(QA/QC Manager)",
            appByRole: "(Plant Manager)",
            footer: "Auto Generated & Analyzed by AI System Engine",
            stableHigh: "มีความเสถียรสูง (Highly Stable)",
            stableMod: "มีความผันผวนปานกลาง (Moderate Variance)",
            stableLow: "มีความผันผวนสูงมาก (Highly Unstable)",
            noGraph: "No Graph Available",
            targetLimit: "Target Limit (0.5%)"
        },
        EN: {
            title: "Production Analytics Report",
            subtitle: "In-depth Production and Quality Metric Analysis (Target Limit: NG ≤ 0.5%)",
            printed: "Printed:",
            dateRange: "Date Range:",
            shiftStr: "Shift:",
            sec1: "1. Key Performance Indicators (KPIs)",
            fg: "Total Good (FG)",
            ng: "Total Defect (NG)",
            yield: "Overall Yield",
            pcs: "pcs",
            overTarget: "OVER 0.5%",
            targetPassed: "TARGET PASSED",
            sec2: "2. Production Stability and Trend Assessment",
            sec2_1_title: "📊 Throughput Output Analysis",
            sec2_1_desc: `Analyzing the relationship between good output (FG) and defects (NG) reflects the production capability. A consistent bar trend across days indicates stable resource availability and constant operational efficiency.`,
            sec2_2_title: "📉 Process Variability Analysis",
            sec2_2_desc: `The average NG rate is stable at <b>${avgNgRate}%</b>. Daily fluctuation is a critical indicator. Compared to the organizational target of <b>≤ 0.5%</b>, if the trend abnormally spikes above the baseline, production should be temporarily suspended to assess 4M variations (Material, Machine) immediately.`,
            sec3: "3. Defect Root Cause Diagnostics",
            sec3_top: "💡 Top Quality Violations:",
            sec3_perfect: "🎉 Perfect! No defects found in the production process.",
            rank: "Rank",
            amount: "Qty",
            sec3_1_title: "📉 Defect Prioritization (Pareto Logic)",
            sec3_1_desc: `Based on the Pareto principle (80/20 Rule), the most critical quality bottleneck is <b>{topNgSymptomName}</b>, accounting for <b>{topNgSymptomRatio}%</b> of defects. Implementing Corrective Actions (CAR) targeting this issue will most significantly recover the overall Yield to meet the <b>0.5%</b> target.`,
            sec3_2_title: "📈 Defect Recurrence Trend vs Target (Chronology %)",
            sec3_2_desc: `Tracking the daily percentage of each defect type helps identify whether anomalies are temporary external factors or systemic root issues. The <b>Target Limit 0.5% (red dashed line)</b> is shown below. Any graph crossing this line signifies a localized failure causing the overall system to miss the target.`,
            sec3_3_title: "🏭 Defect Source Mapping",
            sec3_3_desc: `Mapping part damage behavior to specific machines confirms that <b>${topMacNg.name}</b> is the primary source, accumulating <b>${topMacNg.ng.toLocaleString()}</b> defects. Engineering recommendation: Escalate Preventive Maintenance (PM) plans or recalibrate this machine's parameters entirely.`,
            sec4: "4. Productivity and Throughput Validation",
            sec4_1_title: "📦 Production Constraints by Model (Product Variance)",
            sec4_1_desc: `Product design complexity creates visible performance variations. Model <b>${bestModel.name}</b> (achieving ${bestModel.yield}% Yield) should be documented as a Best Practice. Conversely, model <b>${worstModel.name}</b> (dropping to ${worstModel.yield}%) or any exceeding <b>0.5%</b> NG rate requires a special Task Force to re-evaluate the Manufacturing Process.`,
            sec4_2_title: "⚙️ Machine Health Index",
            sec4_2_desc: `Individual assessments indicate that Machine <b>${highestYieldMac.name}</b> maintains perfect operational health (Yield ${highestYieldMac.yield}%). On the other hand, Machine <b>${lowestYieldMac.name}</b> is severely degrading (Yield dropped to ${lowestYieldMac.yield}%, severely breaching 0.5% NG). This acts as a critical warning requiring immediate intervention.`,
            sec4_3_title: "⏱️ Hourly Production Rhythm (Throughput Profile)",
            sec4_3_desc: `Conveyor flow consistency fluctuates over time. Peak Performance Hour was identified at <b>${peakHour.label}</b>, reaching <b>${peakHour.fg.toLocaleString()}</b> pieces. The gap between peak and low throughput hours is a Hidden Waste caused by operator fatigue or material shortage. Supervisors must address this for Line Balancing.`,
            sec5: "5. Machine-Level Daily Trend Analytics",
            machine: "Machine",
            avgYield: "Avg Yield",
            targetEvalPass: "Target Passed",
            targetEvalFail: "Failed (NG > 0.5%)",
            defect: "Defect:",
            mDescPass: `Data for Machine <b>{m}</b> shows <b>{totalMFg} pcs</b> of FG and <b>{totalMNg} pcs</b> of NG. Compared to the <b>0.5% organizational target</b>, this machine has <b>{targetEval}</b>. With a daily variance of {variance}% ({stability}), it maintained excellent quality consistency with no significant defect leaks.`,
            mDescFail: `Data for Machine <b>{m}</b> shows <b>{totalMFg} pcs</b> of FG and <b>{totalMNg} pcs</b> of NG. Compared to the <b>0.5% organizational target</b>, this machine <b>{targetEval}</b>. With a daily variance of {variance}% ({stability}), a critical spike hit <b>{maxNgRate}%</b> on <b>{maxNgDate}</b>. Since it exceeds 0.5%, Maintenance logs must be reviewed for hidden setup or downtime issues on that day.`,
            noMachineData: "No machine variance data found in this period.",
            repBy: "Reported By",
            chkBy: "Checked By",
            appBy: "Approved By",
            repByRole: "(Production Leader)",
            chkByRole: "(QA/QC Manager)",
            appByRole: "(Plant Manager)",
            footer: "Auto Generated & Analyzed by AI System Engine",
            stableHigh: "Highly Stable",
            stableMod: "Moderate Variance",
            stableLow: "Highly Unstable",
            noGraph: "No Graph Available",
            targetLimit: "Target Limit (0.5%)"
        },
        CH: {
            title: "生产分析报告",
            subtitle: "深入生产与质量指标分析 (目标限制: NG ≤ 0.5%)",
            printed: "打印时间:",
            dateRange: "数据范围:",
            shiftStr: "班次:",
            sec1: "1. 关键绩效指标 (KPIs)",
            fg: "总良品数 (FG)",
            ng: "总不良品数 (NG)",
            yield: "总良率",
            pcs: "件",
            overTarget: "超过 0.5%",
            targetPassed: "达到目标",
            sec2: "2. 生产稳定性与趋势评估",
            sec2_1_title: "📊 产出吞吐量分析",
            sec2_1_desc: `分析良品 (FG) 与不良品 (NG) 之间的关系，反映了生产线的产能。每天一致的图表趋势表明资源稳定且员工效率恒定。`,
            sec2_2_title: "📉 过程变异性分析",
            sec2_2_desc: `平均不良率稳定在 <b>${avgNgRate}%</b>。日常波动模式是一个关键指标。与 <b>0.5%</b> 的企业目标相比，如果趋势异常飙升超过基线，应立即暂停生产以评估 4M (材料、机器) 的变异。`,
            sec3: "3. 不良品根本原因诊断",
            sec3_top: "💡 主要质量异常:",
            sec3_perfect: "🎉 完美！生产过程中未发现不良品。",
            rank: "排名",
            amount: "数量",
            sec3_1_title: "📉 缺陷优先级排序 (帕累托逻辑)",
            sec3_1_desc: `基于帕累托原理 (80/20 规则)，最关键的质量瓶颈是 <b>{topNgSymptomName}</b>，占缺陷的 <b>{topNgSymptomRatio}%</b>。针对此问题实施纠正措施 (CAR) 将最显著地恢复整体良率，以达到 <b>0.5%</b> 的目标。`,
            sec3_2_title: "📈 缺陷复发趋势与目标对比",
            sec3_2_desc: `跟踪每种缺陷类型的每日百分比，有助于确定异常是暂时的外部因素还是系统性的根本问题。下方显示了 <b>目标限制 0.5% (红色虚线)</b>。任何穿过这条线的图表都意味着局部故障导致整个系统未达到目标。`,
            sec3_3_title: "🏭 缺陷源映射",
            sec3_3_desc: `将零件损坏行为映射到特定机器证实 <b>${topMacNg.name}</b> 是主要来源，累计了 <b>${topMacNg.ng.toLocaleString()}</b> 件缺陷。工程建议：升级预防性维护 (PM) 计划或完全重新校准该机器的参数。`,
            sec4: "4. 生产力与吞吐量验证",
            sec4_1_title: "📦 按型号划分的生产限制 (产品变异)",
            sec4_1_desc: `产品设计的复杂性产生了明显的性能差异。型号 <b>${bestModel.name}</b> (达到 ${bestModel.yield}% 良率) 应被记录为最佳实践。相反，型号 <b>${worstModel.name}</b> (降至 ${worstModel.yield}%) 或任何超过 <b>0.5%</b> NG 率的型号，需要一个特别工作组重新评估制造过程。`,
            sec4_2_title: "⚙️ 机器健康指数",
            sec4_2_desc: `个别评估表明，机器 <b>${highestYieldMac.name}</b> 保持了完美的运行健康状态 (良率 ${highestYieldMac.yield}%)。另一方面，机器 <b>${lowestYieldMac.name}</b> 正在严重退化 (良率降至 ${lowestYieldMac.yield}%，严重突破 0.5% NG)。这是一个关键警告，需要立即干预。`,
            sec4_3_title: "⏱️ 每小时生产节奏与加速 (吞吐量)",
            sec4_3_desc: `传送带流动的一致性随时间波动。峰值生产时间确定在 <b>${peakHour.label}</b>，达到 <b>${peakHour.fg.toLocaleString()}</b> 件。高峰和低谷吞吐量小时之间的差距是由操作员疲劳或材料短缺引起的隐藏浪费。主管必须解决此问题以实现生产线平衡。`,
            sec5: "5. 机器级每日趋势分析",
            machine: "机器",
            avgYield: "平均良率",
            targetEvalPass: "达到目标",
            targetEvalFail: "未达标 (NG > 0.5%)",
            defect: "不良品:",
            mDescPass: `机器 <b>{m}</b> 的数据显示 FG 为 <b>{totalMFg} 件</b>，NG 为 <b>{totalMNg} 件</b>。与 <b>0.5% 的企业目标</b> 相比，该机器 <b>{targetEval}</b>。每日差异为 {variance}% ({stability})，保持了出色的质量一致性，没有明显的缺陷泄漏。`,
            mDescFail: `机器 <b>{m}</b> 的数据显示 FG 为 <b>{totalMFg} 件</b>，NG 为 <b>{totalMNg} 件</b>。与 <b>0.5% 的企业目标</b> 相比，该机器 <b>{targetEval}</b>。每日差异为 {variance}% ({stability})，在 <b>{maxNgDate}</b> 出现了高达 <b>{maxNgRate}%</b> 的关键峰值。由于超过 0.5%，必须审查当天的维护记录以查找隐藏的设置或停机问题。`,
            noMachineData: "此期间未找到机器的差异数据。",
            repBy: "报告人",
            chkBy: "审核人",
            appBy: "批准人",
            repByRole: "(生产组长)",
            chkByRole: "(QA/QC 经理)",
            appByRole: "(工厂经理)",
            footer: "Auto Generated & Analyzed by AI System Engine",
            stableHigh: "高度稳定",
            stableMod: "中等变异",
            stableLow: "高度不稳定",
            noGraph: "No Graph Available",
            targetLimit: "Target Limit (0.5%)"
        }
    };
    
    const tLang = textData[lang] || textData['TH'];

    if(ngItems.length > 0) {
        topNgSymptomName = ngItems[0].label;
        topNgSymptomRatio = ((ngItems[0].pcs / totalNG) * 100).toFixed(1);

        topNgHtml = `<ul class="list-disc pl-5 mt-2 space-y-1 text-sm text-gray-700">`;
        ngItems.slice(0, 3).forEach((item, idx) => {
            let pct = totalNG > 0 ? ((item.pcs / totalNG) * 100).toFixed(1) : 0;
            topNgHtml += `<li>${tLang.rank} ${idx+1}: <b>${item.label}</b> ${tLang.amount} ${item.pcs.toLocaleString()} ${tLang.pcs} (${pct}%)</li>`;
        });
        topNgHtml += `</ul>`;
    } else {
        topNgHtml = `<p class="mt-2 text-green-600 font-bold text-sm">${tLang.sec3_perfect}</p>`;
    }

    const getChartImg = (id) => {
        const canvas = document.getElementById(id);
        return (canvas && canvas.toDataURL) ? canvas.toDataURL('image/png', 1.0) : '';
    };

    // เตรียม Config สำหรับสร้างกราฟ NG Trend (Line Chart % เทียบยอดผลิต)
    let autoReportNgTrendConfig = null;
    if (data.dailyTrend && data.dailyTrend.length > 0 && typeof Chart !== 'undefined') {
        const symptomTotals = {};
        data.dailyTrend.forEach(d => {
            if(d.ngBreakdown) {
                Object.keys(d.ngBreakdown).forEach(k => {
                    symptomTotals[k] = (symptomTotals[k] || 0) + d.ngBreakdown[k];
                });
            }
        });
        const topSymptoms = Object.entries(symptomTotals).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
        
        const ngTrendDatasets = topSymptoms.map((sym, i) => {
            const colors = ['#3b82f6', '#f97316', '#eab308', '#a855f7', '#ec4899'];
            return {
                label: sym + ' (%)',
                data: data.dailyTrend.map(d => {
                    const totalProd = d.fg + d.ng;
                    const symPcs = (d.ngBreakdown && d.ngBreakdown[sym]) ? d.ngBreakdown[sym] : 0;
                    return totalProd > 0 ? parseFloat(((symPcs / totalProd) * 100).toFixed(2)) : 0;
                }),
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length],
                borderWidth: 2,
                tension: 0.3,
                fill: false
            };
        });

        ngTrendDatasets.push({
            label: tLang.targetLimit,
            data: data.dailyTrend.map(() => 0.5),
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0
        });

        autoReportNgTrendConfig = {
            labels: data.dailyTrend.map(d => d.date),
            datasets: ngTrendDatasets
        };
    }

    const imgDailyOutput = getChartImg('dailyOutputChart');
    const imgTrendNG = getChartImg('qcTrendChart'); 
    const imgPareto = getChartImg('paretoChart');
    const imgNgMac = getChartImg('ngByMachineChart');
    const imgYieldModel = getChartImg('yieldModelChart');
    const imgYieldMac = getChartImg('yieldMachineChart');
    const imgHourly = getChartImg('hourlyChart');

    // 🌟 วิเคราะห์เทรนแยกตามเครื่องจักร พร้อมเตรียมพื้นที่สร้าง Canvas Daily Trend ของแต่ละเครื่อง 🌟
    let machineChartConfigs = [];
    let machineAnalysisHtml = `<div class="page-break-before print-page">
        <div class="mb-8 page-break-inside-avoid">
        <h3 class="text-lg font-bold text-gray-800 border-l-4 border-purple-600 pl-2 mb-4 bg-gray-50 py-1">${tLang.sec5}</h3>
        <div class="space-y-8">`;
    
    let hasMachineData = false;
    if(data.machineData) {
        for(let m in data.machineData) {
            const mData = data.machineData[m];
            const mDaily = mData.daily;
            if (!mDaily || Object.keys(mDaily).length === 0) continue;

            const dates = Object.keys(mDaily).sort();
            let totalMFg = 0;
            let totalMNg = 0;
            let maxNgRate = 0;
            let maxNgDate = '-';
            let trend = [];

            dates.forEach(d => {
                const fg = mDaily[d].fg || 0;
                const ng = mDaily[d].ngPcs || 0;
                const total = fg + ng;
                const rate = total > 0 ? (ng / total) * 100 : 0;
                totalMFg += fg;
                totalMNg += ng;
                trend.push(rate);
                if (rate > maxNgRate) { maxNgRate = rate; maxNgDate = d; }
            });

            if (totalMFg === 0 && totalMNg === 0) continue;
            hasMachineData = true;

            const avgMYield = totalMFg + totalMNg > 0 ? ((totalMFg / (totalMFg + totalMNg)) * 100).toFixed(2) : 0;
            const avgMNgRate = (100 - avgMYield).toFixed(2);
            const variance = trend.length > 1 ? (Math.max(...trend) - Math.min(...trend)).toFixed(2) : 0;
            
            let stability = variance < 5 ? tLang.stableHigh : (variance < 15 ? tLang.stableMod : tLang.stableLow);
            let targetEval = parseFloat(avgMNgRate) <= 0.5 ? tLang.targetEvalPass : tLang.targetEvalFail;
            let targetColor = parseFloat(avgMNgRate) <= 0.5 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";

            const chartId = `mchart_${m.replace(/\W/g, '')}`;

            machineChartConfigs.push({
                id: chartId,
                labels: dates,
                fgData: dates.map(d => mDaily[d].fg || 0),
                ngData: dates.map(d => mDaily[d].ngPcs || 0),
                rateData: dates.map(d => {
                    const f = mDaily[d].fg || 0;
                    const n = mDaily[d].ngPcs || 0;
                    return (f+n) > 0 ? (n/(f+n)*100).toFixed(2) : 0;
                }),
                targetData: dates.map(() => 0.5) 
            });

            let descHtml = totalMNg > 0 
                ? tLang.mDescFail.replace('{m}', m).replace('{totalMFg}', totalMFg.toLocaleString()).replace('{totalMNg}', totalMNg.toLocaleString()).replace('{targetEval}', targetEval).replace('{variance}', variance).replace('{stability}', stability).replace('{maxNgDate}', maxNgDate).replace('{maxNgRate}', maxNgRate.toFixed(2))
                : tLang.mDescPass.replace('{m}', m).replace('{totalMFg}', totalMFg.toLocaleString()).replace('{totalMNg}', totalMNg.toLocaleString()).replace('{targetEval}', targetEval).replace('{variance}', variance).replace('{stability}', stability);

            machineAnalysisHtml += `
                <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm page-break-inside-avoid">
                    <div class="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                        <h4 class="font-black text-blue-800 text-base flex items-center gap-2">🏭 ${tLang.machine}: ${m}</h4>
                        <span class="text-xs font-bold ${targetColor} px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                            ${targetEval} | ${tLang.defect} ${avgMNgRate}%
                        </span>
                    </div>
                    <p class="text-[12px] text-gray-700 leading-relaxed text-justify indent-8 mb-4">
                        ${descHtml}
                    </p>
                    <div class="bg-gray-50 p-4 rounded-lg border border-gray-100 w-full h-[280px] relative">
                        <canvas id="${chartId}" style="width:100%; height:100%;"></canvas>
                    </div>
                </div>
            `;
        }
    }
    
    if(!hasMachineData) {
        machineAnalysisHtml += `<p class="text-xs text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded bg-gray-50">${tLang.noMachineData}</p>`;
    }
    machineAnalysisHtml += `</div></div></div>`;

    // 🌟 โครงสร้างหน้ากระดาษและกราฟหลัก 🌟
    let html = `
        <div class="print-page bg-white shadow-lg ring-1 ring-gray-200 rounded p-8 mb-6">
            <div class="border-b-2 border-gray-800 pb-4 mb-6">
                <div class="flex justify-between items-end">
                    <div>
                        <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tight">${tLang.title}</h1>
                        <p class="text-gray-600 mt-1 font-medium">${tLang.subtitle}</p>
                    </div>
                    <div class="text-right text-sm text-gray-500">
                        <p><b>${tLang.printed}</b> ${printTime}</p>
                    </div>
                </div>
                <div class="mt-4 flex gap-6 text-sm bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span class="font-bold">${tLang.dateRange} <span class="font-normal text-blue-700">${dateStr}</span></span>
                    <span class="font-bold">${tLang.shiftStr} <span class="font-normal text-blue-700">${shiftName} (${shiftType})</span></span>
                </div>
            </div>

            <div class="mb-8">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-2 mb-4 bg-gray-50 py-1">${tLang.sec1}</h3>
                <div class="grid grid-cols-3 gap-6 text-center">
                    <div class="border border-gray-300 rounded p-4 bg-white shadow-sm">
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">${tLang.fg}</p>
                        <p class="text-2xl font-black text-blue-600 mt-1">${totalFG.toLocaleString()} <span class="text-sm font-normal">${tLang.pcs}</span></p>
                    </div>
                    <div class="border ${isPassTarget ? 'border-gray-300 bg-white' : 'border-red-300 bg-red-50'} rounded p-4 shadow-sm relative overflow-hidden">
                        ${!isPassTarget ? `<div class="absolute top-0 right-0 bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-bl-lg font-bold">${tLang.overTarget}</div>` : ''}
                        <p class="text-[10px] ${isPassTarget ? 'text-gray-500' : 'text-red-600'} font-bold uppercase tracking-wider">${tLang.ng}</p>
                        <p class="text-2xl font-black ${isPassTarget ? 'text-gray-800' : 'text-red-600'} mt-1">${totalNG.toLocaleString()} <span class="text-sm font-normal">${tLang.pcs}</span></p>
                    </div>
                    <div class="border ${isPassTarget ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white'} rounded p-4 shadow-sm relative overflow-hidden">
                        ${isPassTarget ? `<div class="absolute top-0 right-0 bg-green-600 text-white text-[9px] px-2 py-0.5 rounded-bl-lg font-bold">${tLang.targetPassed}</div>` : ''}
                        <p class="text-[10px] ${isPassTarget ? 'text-green-700' : 'text-gray-500'} font-bold uppercase tracking-wider">${tLang.yield}</p>
                        <p class="text-2xl font-black ${isPassTarget ? 'text-green-700' : 'text-gray-800'} mt-1">${yieldPct}%</p>
                    </div>
                </div>
            </div>

            <!-- ไม่ใช้ page-break-inside-avoid ในกล่องคลุม เพื่อให้ Section 1 และ 2 ยืดหยุ่นในหน้าแรก -->
            <div class="mb-8">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-indigo-500 pl-2 mb-4 bg-gray-50 py-1">${tLang.sec2}</h3>
                <div class="grid grid-cols-1 gap-6">
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec2_1_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec2_1_desc}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgDailyOutput ? `<img src="${imgDailyOutput}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec2_2_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec2_2_desc}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgTrendNG ? `<img src="${imgTrendNG}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="print-page bg-white shadow-lg ring-1 ring-gray-200 rounded p-8 mb-6 page-break-before">
            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-red-500 pl-2 mb-4 bg-gray-50 py-1">${tLang.sec3}</h3>
                
                <div class="bg-red-50 border border-red-200 p-5 rounded-lg mb-6 shadow-sm">
                    <p class="text-sm font-bold text-red-800 mb-3 flex items-center gap-2"><span>💡</span> ${tLang.sec3_top}</p>
                    ${topNgHtml}
                </div>

                <div class="grid grid-cols-1 gap-6 mb-6">
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec3_1_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec3_1_desc.replace('{topNgSymptomName}', topNgSymptomName).replace('{topNgSymptomRatio}', topNgSymptomRatio)}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgPareto ? `<img src="${imgPareto}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec3_2_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec3_2_desc}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-4 border border-gray-100 h-[300px] relative">
                            <!-- 🌟 พื้นที่สำหรับกราฟ %เทียบยอดผลิต 🌟 -->
                            <canvas id="auto-report-ng-trend-chart" style="width:100%; height:100%;"></canvas>
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec3_3_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec3_3_desc.replace('{topMacNg.name}', topMacNg.name).replace('{topMacNgNg}', topMacNg.ng.toLocaleString())}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgNgMac ? `<img src="${imgNgMac}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="print-page bg-white shadow-lg ring-1 ring-gray-200 rounded p-8 mb-6 page-break-before">
            <div class="mb-8 page-break-inside-avoid">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-green-500 pl-2 mb-4 bg-gray-50 py-1">${tLang.sec4}</h3>
                
                <div class="grid grid-cols-1 gap-6 mb-6">
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec4_1_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec4_1_desc}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgYieldModel ? `<img src="${imgYieldModel}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec4_2_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec4_2_desc}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgYieldMac ? `<img src="${imgYieldMac}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec4_3_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec4_3_desc}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgHourly ? `<img src="${imgHourly}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        ${machineAnalysisHtml}

        <div class="print-page bg-white shadow-lg ring-1 ring-gray-200 rounded p-8 mt-6 page-break-inside-avoid">
            <div class="pt-4 grid grid-cols-3 gap-8 text-center">
                <div>
                    <div class="h-16 border-b border-gray-400 mb-3 w-4/5 mx-auto"></div>
                    <p class="text-sm font-bold text-gray-800">${tLang.repBy}</p>
                    <p class="text-xs text-gray-500 mt-1">${tLang.repByRole}</p>
                </div>
                <div>
                    <div class="h-16 border-b border-gray-400 mb-3 w-4/5 mx-auto"></div>
                    <p class="text-sm font-bold text-gray-800">${tLang.chkBy}</p>
                    <p class="text-xs text-gray-500 mt-1">${tLang.chkByRole}</p>
                </div>
                <div>
                    <div class="h-16 border-b border-gray-400 mb-3 w-4/5 mx-auto"></div>
                    <p class="text-sm font-bold text-gray-800">${tLang.appBy}</p>
                    <p class="text-xs text-gray-500 mt-1">${tLang.appByRole}</p>
                </div>
            </div>
            
            <div class="text-center text-[10px] text-gray-400 mt-12 pt-4 border-t border-gray-200 uppercase tracking-widest">
                ${tLang.footer} - ${printTime}
            </div>
        </div>
    `;

    document.getElementById('modal-auto-report').className = 'fixed inset-0 bg-gray-200 z-50 flex flex-col overflow-y-auto pb-10 transition-opacity duration-300';
    content.className = 'w-full max-w-[210mm] mx-auto mt-6 px-4 md:px-0'; 
    content.innerHTML = html;
    
    // 🌟 วาดกราฟของจริงลงไปในหน้าต่าง Report อัตโนมัติ (แก้ปัญหาไม่ยอมแสดงผล) 🌟
    setTimeout(() => {
        if (window.autoReportCharts) window.autoReportCharts.forEach(c => c.destroy());
        window.autoReportCharts = [];

        if (autoReportNgTrendConfig) {
            const ctxNgTrend = document.getElementById('auto-report-ng-trend-chart');
            if (ctxNgTrend) {
                window.autoReportCharts.push(new Chart(ctxNgTrend, {
                    type: 'line',
                    data: autoReportNgTrendConfig,
                    options: {
                        animation: false,
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true, position: 'top' }, datalabels: { display: false } },
                        scales: { y: { type: 'linear', beginAtZero: true, title: { display: true, text: '% (Yield %)' } } }
                    }
                }));
            }
        }

        machineChartConfigs.forEach(cfg => {
            const ctx = document.getElementById(cfg.id);
            if (ctx) {
                window.autoReportCharts.push(new Chart(ctx, {
                    data: {
                        labels: cfg.labels,
                        datasets: [
                            { type: 'bar', label: 'FG', data: cfg.fgData, backgroundColor: 'rgba(59, 130, 246, 0.7)', yAxisID: 'y' },
                            { type: 'bar', label: 'NG', data: cfg.ngData, backgroundColor: 'rgba(239, 68, 68, 0.8)', yAxisID: 'y' },
                            { type: 'line', label: 'NG Rate (%)', data: cfg.rateData, borderColor: 'rgba(168, 85, 247, 1)', backgroundColor: 'rgba(168, 85, 247, 1)', borderWidth: 2, tension: 0.3, yAxisID: 'y1' },
                            { type: 'line', label: tLang.targetLimit, data: cfg.targetData, borderColor: 'rgba(239, 68, 68, 1)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0, yAxisID: 'y1' }
                        ]
                    },
                    options: {
                        animation: false,
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true, position: 'top' }, datalabels: { display: false } },
                        scales: {
                            y: { type: 'linear', position: 'left', beginAtZero: true },
                            y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } }
                        }
                    }
                }));
            }
        });
    }, 100); 
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
    
    const ngTrendSel = document.getElementById('ngTrendSelector');
    if(ngTrendSel) ngTrendSel.value = 'percent';
    
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
