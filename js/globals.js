const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyt3Bf_2h21BBcCHQSjizowy_kD5vsoUqgaC_YmVjLuQybJO1BBRt3eaSM0PuKEFfvruw/exec";
        
let ngSymptoms = ["ลวดถลอก (Scratched)", "พันหลวม (Loose)", "รอบไม่ครบ (Turn Error)", "ขาผิดรูป (Lead Deform)", "Setup", "อื่นๆ (Others)"];
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
// 🌟 Utilities & Global UI Functions
// ==========================================

window.formatNumber = function(value, decimals = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

window.formatKg = function(value, decimals = 2) {
    return window.formatNumber(value, decimals);
};

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

function normalizeNgSymptomName(raw) {
    const text = (raw || '').trim();
    if (!text) return '';
    const setupMatch = text.match(/^setup\s*-\s*(.+)$/i);
    if (setupMatch) return capitalizeFirst(setupMatch[1]);
    if (text.toLowerCase() === 'setup') return 'Setup';
    return capitalizeFirst(text);
}

function normalizeNgSymptomMasterList(list) {
    const unique = [];
    (list || []).forEach(item => {
        const normalized = normalizeNgSymptomName(item);
        if (!normalized) return;
        if (!unique.some(u => u.toLowerCase() === normalized.toLowerCase())) {
            unique.push(normalized);
        }
    });
    if (!unique.some(s => s.toLowerCase() === 'setup')) {
        unique.push('Setup');
    }
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
        
        if (data.recorders && data.recorders.length > 0) {
            recorderList = data.recorders; 
        }
        
        if(typeof window.renderRecorderOptions === 'function') {
            window.renderRecorderOptions();
        }
        
        if (data.ngTypes && data.ngTypes.length > 0) {
            ngSymptoms = normalizeNgSymptomMasterList([...ngSymptoms, ...data.ngTypes]);
            if (typeof window.renderRtvSymptomsOptions === 'function') {
                window.renderRtvSymptomsOptions();
            }
        } else {
            ngSymptoms = normalizeNgSymptomMasterList(ngSymptoms);
        }
        
        if (data.machineMapping) {
            machineMapping = data.machineMapping;
            localStorage.setItem('CWM_MACHINE_MAPPING', JSON.stringify(machineMapping));
            
            const rows = document.getElementById('batchList');
            if(rows) {
                for(let r of rows.children) {
                    const mSel = r.querySelector('.machine-select-trigger');
                    const pSel = r.querySelector('.product-select-target');
                    if(mSel && mSel.value && machineMapping[mSel.value]) {
                        pSel.value = machineMapping[mSel.value];
                        pSel.dispatchEvent(new Event('change'));
                    }
                }
            }
        }

        if (data.hiddenWidgets) {
            hiddenWidgets = data.hiddenWidgets;
            if(typeof window.applyWidgetVisibility === 'function') {
                window.applyWidgetVisibility();
            }
        }

    } catch (e) { 
        console.log("Error fetching options", e); 
    }
};

window.initSortable = function() {
    const grid = document.getElementById('sortable-grid');
    if(!grid) return;
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
    if(menu) menu.classList.toggle('hidden');
};

window.toggleLayout = function() {
    const debugOut = document.getElementById('debug-output');
    try {
        if(debugOut) debugOut.innerText += "\n[System] ฟังก์ชัน toggleLayout ทำงานแล้ว...";
        window.isDualLayout = !window.isDualLayout;
        if(debugOut) debugOut.innerText += `\n[System] สถานะเลย์เอาต์ที่ต้องการ: ${window.isDualLayout ? 'คู่' : 'เดี่ยว'}`;
        
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
        
        if(debugOut) debugOut.innerText += "\n[System] เปลี่ยนคลาสสำเร็จ เริ่มรีไซส์กราฟ...";

        setTimeout(() => {
            let count = 0;
            Object.values(charts).forEach(c => { 
                if(c && typeof c.resize === 'function') {
                    c.resize(); 
                    count++;
                }
            });
            if(debugOut) debugOut.innerText += `\n[System] รีไซส์กราฟเสร็จสิ้น ${count} อัน (สำเร็จ!)`;
        }, 150);
    } catch (err) {
        if(debugOut) debugOut.innerText += `\n[Fatal Error] โค้ดพัง: ${err.message}`;
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
        
        const sDate = document.getElementById('startDate')?.value || '';
        const eDate = document.getElementById('endDate')?.value || '';
        const shiftElement = document.getElementById('filterShift');
        const typeElement = document.getElementById('filterShiftType');
        
        const shift = shiftElement ? shiftElement.options[shiftElement.selectedIndex].text : '';
        const shiftType = typeElement ? typeElement.options[typeElement.selectedIndex].text : '';
        
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
    const toggle = document.querySelector(`input[name="shift_type_toggle"][value="${type}"]`);
    if(toggle) toggle.checked = true;
    window.updateHourSlots(type);
};

window.updateHourSlots = function(type) {
    const select = document.getElementById('hourSlot');
    if(!select) return;
    const hours = (type === "Day") ? DAY_HOURS : NIGHT_HOURS;
    select.innerHTML = hours.map(h => `<option value="${h}">${h}</option>`).join('');
    
    const currentHourStr = new Date().getHours().toString().padStart(2, '0') + ":00";
    const match = hours.find(h => h.startsWith(currentHourStr));
    if(match) select.value = match;
};

// 🌟 อัปเดตสิทธิ์การเข้าถึง (สลับ Section) 🌟
window.switchTab = function(tab) {
    if (!window.currentUser) return;
    const role = window.currentUser.role;

    // จำกัดสิทธิ์
    if (role === 'Production' && (tab === 'planning' || tab === 'admin')) return;
    if (role === 'QC' && (tab === 'planning' || tab === 'admin' || tab === 'packing')) return;
    if (role === 'Planning' && (tab === 'form' || tab === 'rw' || tab === 'admin' || tab === 'maint' || tab === 'rtv' || tab === 'packing' || tab === 'sort')) return;
    if (role === 'Viewer' && tab !== 'dashboard') return;

    // สลับหน้าจอ Section (แยกเมนูที่เป็นลิงก์ออก ไม่ต้องนำมาจัดการในนี้)
    ['form', 'planning', 'dashboard', 'admin', 'rtv', 'packing'].forEach(t => {
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
    if(tab === 'dashboard' && typeof window.loadDashboard === 'function') window.loadDashboard();
};

function applyPermissions() {
    const role = window.currentUser?.role;
    if (!role) return;

    // รองรับ ID ทั้งรูปแบบเก่าและใหม่ที่คุณอาจจะพิมพ์ลงใน index.html
    const desktopSortIds = ['btn-desktop-sort', 'btn-link-sort'];
    const mobileSortIds = ['tab-sort', 'tab-sort-mobile'];

    // 1. ซ่อนเมนูทั้งหมดก่อน รวมถึงปุ่ม Sort ทุกแบบที่อาจมี
    const allMenus = ['tab-form', 'tab-planning', 'tab-dashboard', 'tab-rw', 'tab-admin', 'tab-maint', 'tab-parts', 'tab-rtv', 'tab-packing', ...desktopSortIds, ...mobileSortIds];
    
    allMenus.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.classList.add('hidden');
            el.style.setProperty('display', 'none', 'important'); // บังคับซ่อนเด็ดขาด
        }
    });

    let defaultTab = '';
    let allowedMenus = [];

    // 2. กำหนดว่า Role ไหนเห็นเมนูไหนบ้าง
    if (role === 'Production') {
        allowedMenus = ['tab-form', 'tab-dashboard', 'tab-rw', 'tab-maint', 'tab-parts', 'tab-rtv', 'tab-packing', ...desktopSortIds, ...mobileSortIds];
        defaultTab = 'form';
    } 
    else if (role === 'QC') {
        allowedMenus = ['tab-form', 'tab-dashboard', 'tab-rw', 'tab-rtv', ...desktopSortIds, ...mobileSortIds];
        defaultTab = 'form';
    }
    else if (role === 'Planning') {
        allowedMenus = ['tab-planning', 'tab-dashboard'];
        defaultTab = 'planning';
    } 
    else if (role === 'Viewer') {
        allowedMenus = ['tab-dashboard'];
        defaultTab = 'dashboard';
    } 
    else if (role === 'Admin') {
        allowedMenus = allMenus;
        defaultTab = 'dashboard'; 
        
        const btnWidgetMgr = document.getElementById('btn-widget-manager');
        if (btnWidgetMgr) {
            btnWidgetMgr.classList.remove('hidden');
            btnWidgetMgr.style.display = 'flex';
        }
    }

    // 3. เปิดแสดงเฉพาะปุ่มที่ได้รับสิทธิ์ แบบบังคับเปิดทะลุคลาส Tailwind
    allowedMenus.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.classList.remove('hidden');
            if (id.includes('desktop') || id.includes('link')) {
                el.style.setProperty('display', 'flex', 'important'); // เปิดปุ่ม Desktop
            } else {
                el.style.setProperty('display', 'block', 'important'); // เปิดปุ่ม Hamburger
            }
        }
    });

    window.switchTab(defaultTab);
}
