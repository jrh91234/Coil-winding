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

    // 🌟 โหลดข้อมูล Pallet (ถ้ามีใน LocalStorage หรือใช้ค่าเริ่มต้น 1-20) 🌟
    if(localStorage.getItem('CWM_PALLET_LIST')) {
        window.palletList = JSON.parse(localStorage.getItem('CWM_PALLET_LIST'));
    } else {
        window.palletList = Array.from({length: 20}, (_, i) => String(i + 1));
    }
    window.renderPalletDropdown(); // แสดงผล Dropdown ทันที
    window.fetchPalletsFromCloud(); // อัปเดตรายการล่าสุดจาก Cloud

    // 🌟 ดึงข้อมูลอาการเสียลง Dropdown ของ RTV ทันทีที่เข้าสู่ระบบ 🌟
    if (typeof window.renderRtvSymptomsOptions === 'function') {
        window.renderRtvSymptomsOptions();
    }

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
    
    // ซ่อนเมนูทั้งหมดก่อน (เพิ่ม tab-packing เข้าไปในรายการซ่อน)
    ['tab-form', 'tab-planning', 'tab-dashboard', 'tab-rw', 'tab-admin', 'tab-maint', 'tab-rtv', 'tab-packing'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    let defaultTab = '';

    // จัดการสิทธิ์การมองเห็นเมนู (เปิด tab-packing ให้ Production และ Admin)
    if (role === 'Production') {
        ['tab-form', 'tab-dashboard', 'tab-rw', 'tab-maint', 'tab-rtv', 'tab-packing'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        defaultTab = 'form';
    } 
    else if (role === 'QC') {
        ['tab-form', 'tab-dashboard', 'tab-rw', 'tab-rtv'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
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
        ['tab-form', 'tab-planning', 'tab-dashboard', 'tab-rw', 'tab-admin', 'tab-maint', 'tab-rtv', 'tab-packing'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        defaultTab = 'dashboard'; 
        
        const btnWidgetMgr = document.getElementById('btn-widget-manager');
        if (btnWidgetMgr) {
            btnWidgetMgr.classList.remove('hidden');
            btnWidgetMgr.classList.add('flex');
        }
    }

    window.switchTab(defaultTab);
}

// ==========================================
// 🌟 ระบบ Admin (จัดการผู้ใช้)
// ==========================================
window.openAdminPanel = function() {
    if (!window.currentUser || window.currentUser.role !== 'Admin') {
        alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        return;
    }
    
    ['form', 'planning', 'dashboard', 'rtv', 'packing'].forEach(t => {
        const el = document.getElementById('section-'+t);
        if(el) el.classList.add('hidden');
    });
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

// ==========================================
// 📦 ระบบจัดการ Pallet No. (Cloud / Local)
// ==========================================
window.palletList = Array.from({length: 20}, (_, i) => String(i + 1));

// ฟังก์ชันดึงหมายเลขพาเลทไปใส่ใน Dropdown อัตโนมัติ
window.renderPalletDropdown = function() {
    // กำหนดให้ Select ใดๆ ในระบบที่มีคลาส "pallet-no-select" ดึงข้อมูลจากส่วนนี้
    const selects = document.querySelectorAll('.pallet-no-select'); 
    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">เลือกหมายเลขพาเลท...</option>' + 
            window.palletList.map(p => `<option value="${p}">Pallet No. ${p}</option>`).join('');
        if (currentVal && window.palletList.includes(currentVal)) {
            sel.value = currentVal;
        }
    });
};

// ฟังก์ชันดึงข้อมูลจาก Cloud แบบเงียบๆ ตอน Login
window.fetchPalletsFromCloud = async function() {
    try {
        const res = await fetch(`${SCRIPT_URL}?action=GET_PALLETS&_t=${Date.now()}`);
        const data = await res.json();
        if (data.success && data.pallets && data.pallets.length > 0) {
            window.palletList = data.pallets;
            localStorage.setItem('CWM_PALLET_LIST', JSON.stringify(window.palletList));
            window.renderPalletDropdown();
        }
    } catch (e) {
        console.warn("ไม่สามารถดึงข้อมูล Pallet จาก Cloud ได้, กำลังใช้ข้อมูล Local 1-20");
    }
};

// เพิ่มหมายเลขพาเลทใหม่
window.addPalletToCloud = async function() {
    const newPalletNo = prompt("ระบุ 'หมายเลขพาเลท' ใหม่ที่ต้องการเพิ่ม (เช่น 21, 22, หรือชื่อเฉพาะ):");
    if (!newPalletNo) return;
    
    try {
        const payload = { action: 'ADD_PALLET', palletNo: newPalletNo, adminUsername: window.currentUser.username };
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            alert("เพิ่มหมายเลขพาเลทสำเร็จ!");
            window.fetchPalletsFromCloud(); // โหลดใหม่ให้ Dropdown อัปเดต
        } else {
            alert("เกิดข้อผิดพลาด: " + data.message);
        }
    } catch (e) {
        alert("การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว");
    }
};

// ลบหมายเลขพาเลท
window.deletePalletFromCloud = async function() {
    const palletNo = prompt("ระบุ 'หมายเลขพาเลท' ที่ต้องการลบ:");
    if (!palletNo) return;

    if (!confirm(`ยืนยันการลบพาเลทหมายเลข: ${palletNo} ใช่หรือไม่?`)) return;
    try {
        const payload = { action: 'DELETE_PALLET', palletNo: palletNo, adminUsername: window.currentUser.username };
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            alert("ลบหมายเลขพาเลทสำเร็จ!");
            window.fetchPalletsFromCloud();
        } else {
            alert("เกิดข้อผิดพลาด: " + data.message);
        }
    } catch (e) {
        alert("การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว");
    }
};
