// ==========================================
// 📦 ระบบจัดการไลน์ Packing & Pallet (Local Storage Mode)
// ==========================================

// โหลดข้อมูลหมายเลขพาเลทจาก Local Storage (ถ้าไม่มีให้สร้างค่าเริ่มต้น 1-20)
window.palletList = JSON.parse(localStorage.getItem('CWM_PALLET_LIST')) || Array.from({length: 20}, (_, i) => String(i + 1));

// ฟังก์ชันสำหรับเรนเดอร์ตัวเลือก Dropdown ของหมายเลขพาเลท
window.renderPalletDropdown = function() {
    const selects = document.querySelectorAll('.pallet-no-select'); 
    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">เลือกหมายเลขพาเลท...</option>' + 
            window.palletList.map(p => `<option value="${p}">Pallet No. ${p}</option>`).join('');
        // ถ้าค่าเดิมยังอยู่ในลิสต์ ให้เลือกค่าเดิม
        if (currentVal && window.palletList.includes(currentVal)) {
            sel.value = currentVal;
        }
    });
};

// ฟังก์ชันเพิ่มหมายเลขพาเลทใหม่ (Local)
window.addPalletLocal = function() {
    const newPalletNo = prompt("ระบุ 'หมายเลขพาเลท' ใหม่ที่ต้องการเพิ่ม (เช่น 21, 22, หรือชื่อเฉพาะ):");
    if (!newPalletNo || newPalletNo.trim() === '') return;
    
    const cleanNo = newPalletNo.trim();
    if (window.palletList.includes(cleanNo)) {
        alert("มีหมายเลขพาเลทนี้อยู่แล้ว!");
        return;
    }
    
    window.palletList.push(cleanNo);
    localStorage.setItem('CWM_PALLET_LIST', JSON.stringify(window.palletList));
    window.renderPalletDropdown();
    alert("เพิ่มหมายเลขพาเลทสำเร็จ!");
};

// ฟังก์ชันลบหมายเลขพาเลท (Local)
window.deletePalletLocal = function() {
    const palletNo = prompt("ระบุ 'หมายเลขพาเลท' ที่ต้องการลบ:");
    if (!palletNo || palletNo.trim() === '') return;
    
    const cleanNo = palletNo.trim();
    if (!window.palletList.includes(cleanNo)) {
        alert("ไม่พบหมายเลขพาเลทนี้ในระบบ!");
        return;
    }
    
    if (!confirm(`ยืนยันการลบพาเลทหมายเลข: ${cleanNo} ใช่หรือไม่?`)) return;
    
    window.palletList = window.palletList.filter(p => p !== cleanNo);
    localStorage.setItem('CWM_PALLET_LIST', JSON.stringify(window.palletList));
    window.renderPalletDropdown();
    alert("ลบหมายเลขพาเลทสำเร็จ!");
};

// ฟังก์ชันเปิดหน้าต่างบันทึก Packing
window.openPackingModal = function() {
    const modal = document.getElementById('modal-packing');
    if (!modal) {
        alert("กรุณาเพิ่ม HTML สำหรับหน้าต่าง Packing ก่อนครับ");
        return;
    }
    
    // ตั้งค่าเริ่มต้น
    document.getElementById('pack-date').value = typeof getShiftDateStr === 'function' ? getShiftDateStr() : new Date().toISOString().split('T')[0];
    if (window.currentUser) {
        document.getElementById('pack-recorder').value = window.currentUser.name || window.currentUser.username;
    }

    // ล้างรายการเดิมและสร้างแถวใหม่ 1 แถว
    document.getElementById('pack-batch-list').innerHTML = '';
    window.addPackingRow();

    // 🌟 เพิ่มระบบจัดการพาเลท (เพิ่ม/ลบ) อัตโนมัติ โดยไม่ต้องแก้ HTML 🌟
    const palletSelect = document.getElementById('pack-pallet-no') || document.querySelector('select[id*="pallet"]');
    if (palletSelect) {
        if (!palletSelect.classList.contains('pallet-no-select')) {
            palletSelect.classList.add('pallet-no-select');
        }
        
        // เช็คสิทธิ์ว่ามีปุ่มหรือยัง ถ้ายังไม่มี และเป็น Production หรือ Admin ให้เสกปุ่มขึ้นมา (เปลี่ยนเป็นเรียก Local Function)
        if (!document.getElementById('btn-manage-pallet') && window.currentUser && (window.currentUser.role === 'Admin' || window.currentUser.role === 'Production')) {
            const btnContainer = document.createElement('div');
            btnContainer.id = 'btn-manage-pallet';
            btnContainer.className = 'flex gap-2 mt-2';
            btnContainer.innerHTML = `
                <button type="button" onclick="addPalletLocal()" class="text-xs bg-green-100 text-green-700 font-bold px-3 py-1.5 rounded shadow-sm border border-green-300 hover:bg-green-200 transition-colors flex items-center gap-1">➕ เพิ่มพาเลท</button>
                <button type="button" onclick="deletePalletLocal()" class="text-xs bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded shadow-sm border border-red-300 hover:bg-red-200 transition-colors flex items-center gap-1">🗑️ ลบพาเลท</button>
            `;
            palletSelect.parentNode.appendChild(btnContainer);
        }
        
        if(typeof window.renderPalletDropdown === 'function') {
            window.renderPalletDropdown();
        }
    }

    modal.classList.remove('hidden');
};

// ฟังก์ชันปิดหน้าต่าง
window.closePackingModal = function() {
    document.getElementById('modal-packing').classList.add('hidden');
};

// ฟังก์ชันเพิ่มแถวรายการเครื่องจักรที่เอาลงพาเลท
window.addPackingRow = function() {
    const container = document.getElementById('pack-batch-list');
    const rowId = 'pack-row-' + Date.now() + Math.random().toString(36).substr(2, 5);
    
    let machineOpts = '<option value="">เลือกเครื่อง...</option>';
    for(let i=1; i<=16; i++) {
        machineOpts += `<option value="CWM-${String(i).padStart(2,'0')}">CWM-${String(i).padStart(2,'0')}</option>`;
    }
    
    let productOpts = '<option value="">เลือกรุ่น...</option>';
    if (typeof productList !== 'undefined') {
        productList.forEach(p => {
            productOpts += `<option value="${p}">${p}</option>`;
        });
    }
    
    const rowHtml = `
        <div id="${rowId}" class="flex flex-col md:flex-row gap-3 items-end bg-gray-50 p-3 rounded-lg border border-gray-200 mb-2 relative transition-all">
            <div class="w-full md:w-1/3">
                <label class="block text-xs font-bold text-gray-700 mb-1">แหล่งที่มา (Machine)</label>
                <select class="pack-machine w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500" onchange="window.autoSelectProductPacking('${rowId}')" required>
                    ${machineOpts}
                </select>
            </div>
            <div class="w-full md:w-1/3">
                <label class="block text-xs font-bold text-gray-700 mb-1">รุ่นสินค้า (Model)</label>
                <select class="pack-product w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-100" required>
                    ${productOpts}
                </select>
            </div>
            <div class="w-full md:w-1/4">
                <label class="block text-xs font-bold text-gray-700 mb-1">จำนวน (Pcs)</label>
                <input type="number" class="pack-qty w-full p-2 border border-gray-300 rounded-lg text-sm text-right font-bold text-blue-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="0" required min="1">
            </div>
            <div class="w-full md:w-auto">
                <button type="button" onclick="document.getElementById('${rowId}').remove()" class="w-full md:w-auto px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 border border-red-200 transition-colors">
                    ลบ
                </button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHtml);
};

// ดึงรุ่นสินค้ามาใส่อัตโนมัติตามเครื่องที่เลือก
window.autoSelectProductPacking = function(rowId) {
    const row = document.getElementById(rowId);
    if(!row) return;
    const mSel = row.querySelector('.pack-machine');
    const pSel = row.querySelector('.pack-product');
    if(mSel.value && typeof machineMapping !== 'undefined' && machineMapping[mSel.value]) {
        pSel.value = machineMapping[mSel.value];
    }
};

// ฟังก์ชันพิมพ์ใบปะหน้าพาเลท
window.printPackingTag = function() {
    const date = document.getElementById('pack-date')?.value || '-';
    const palletNo = document.getElementById('pack-pallet-no')?.value || document.querySelector('.pallet-no-select')?.value || '-';
    const recorder = document.getElementById('pack-recorder')?.value || '-';
    
    if (palletNo === '-' || palletNo === '') {
        alert("⚠️ กรุณาเลือกหมายเลขพาเลทก่อนพิมพ์");
        return;
    }

    const rows = document.querySelectorAll('#pack-batch-list > div');
    if (rows.length === 0) {
        alert("⚠️ กรุณาเพิ่มรายการลงพาเลทก่อนพิมพ์");
        return;
    }

    let itemsHtml = '';
    let totalQty = 0;
    let isComplete = true;

    rows.forEach((row, idx) => {
        const m = row.querySelector('.pack-machine').value;
        const p = row.querySelector('.pack-product').value;
        const q = parseInt(row.querySelector('.pack-qty').value) || 0;
        
        if(!m || !p || q <= 0) isComplete = false;

        totalQty += q;
        itemsHtml += `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td>${m}</td>
                <td>${p}</td>
                <td class="right">${q.toLocaleString()}</td>
            </tr>
        `;
    });

    if (!isComplete) {
        alert("⚠️ กรุณากรอกข้อมูล (เครื่อง, รุ่น, จำนวน) ให้ครบถ้วนทุกแถว");
        return;
    }

    // สร้างหน้าต่างสำหรับพิมพ์
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Pallet Tag No. ${palletNo}</title>
            <style>
                body { font-family: 'Sarabun', 'Segoe UI', sans-serif; padding: 20px; color: #000; }
                .tag-container { border: 2px solid #000; padding: 20px; max-width: 100%; border-radius: 8px; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 28px; text-transform: uppercase; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #555; }
                .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 16px; font-weight: bold; }
                .pallet-badge { background: #000; color: #fff; padding: 5px 15px; border-radius: 4px; font-size: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #000; padding: 10px; font-size: 14px; }
                th { background-color: #f0f0f0; text-align: left; }
                .right { text-align: right; }
                .total-box { display: flex; justify-content: space-between; border: 2px solid #000; padding: 10px; font-size: 18px; font-weight: bold; background: #f9f9f9; }
                @media print {
                    body { padding: 0; }
                    .tag-container { border: none; }
                }
            </style>
        </head>
        <body>
            <div class="tag-container">
                <div class="header">
                    <h1>PALLET IDENTIFICATION TAG</h1>
                    <p>ใบปะหน้าพาเลทสินค้า (Finished Goods)</p>
                </div>
                
                <div class="info-grid">
                    <div>วันที่บันทึก (Date): ${date}</div>
                    <div>ผู้จัดพาเลท (Packer): ${recorder}</div>
                    <div class="pallet-badge">PALLET NO. ${palletNo}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="text-align:center; width:40px;">No.</th>
                            <th>แหล่งที่มา (Machine)</th>
                            <th>รุ่น (Model)</th>
                            <th class="right">จำนวน (Pcs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="total-box">
                    <div class="lbl">TOTAL QUANTITY / ยอดรวมทั้งพาเลท</div>
                    <div class="val">${totalQty.toLocaleString()} PCS</div>
                </div>
                
                <div style="margin-top:30px; display:flex; justify-content:space-between; font-size:12px; text-align:center;">
                    <div style="width:45%; border-top:1px solid #000; padding-top:5px;">ลายเซ็นผู้บรรจุ (Packer)</div>
                    <div style="width:45%; border-top:1px solid #000; padding-top:5px;">ลายเซ็นผู้ตรวจ (QC/Leader)</div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};
