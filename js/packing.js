// ==========================================
// 📦 ระบบจัดการไลน์ Packing & Pallet
// ==========================================

// ฟังก์ชันเปิดหน้าต่างบันทึก Packing
window.openPackingModal = function() {
    const modal = document.getElementById('modal-packing');
    if (!modal) {
        alert("กรุณาเพิ่ม HTML สำหรับหน้าต่าง Packing ก่อนครับ");
        return;
    }
    
    // ตั้งค่าเริ่มต้น
    document.getElementById('pack-date').value = getShiftDateStr();
    if (window.currentUser) {
        document.getElementById('pack-recorder').value = window.currentUser.name || window.currentUser.username;
    }

    // ล้างรายการเดิมและสร้างแถวใหม่ 1 แถว
    document.getElementById('pack-batch-list').innerHTML = '';
    window.addPackingRow();

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
    let prodOpts = productList.map(p => `<option value="${p}">${p}</option>`).join('');

    const div = document.createElement('div');
    div.id = rowId;
    div.className = "bg-blue-50 p-3 border border-blue-200 rounded-lg shadow-sm flex flex-col md:flex-row gap-3 items-end md:items-center relative";
    
    // 💡 สังเกตว่าไม่มีปุ่ม NG แล้ว มีแค่ยอด FG (งานดี)
    div.innerHTML = `
        <div class="flex-1 w-full">
            <label class="text-[10px] text-gray-500 font-bold uppercase">ดึงงานมาจากเครื่อง (Machine)</label>
            <select class="pack-machine w-full p-2 border rounded bg-white text-sm font-bold text-blue-800">${machineOpts}</select>
        </div>
        <div class="flex-1 w-full">
            <label class="text-[10px] text-gray-500 font-bold uppercase">รุ่นสินค้า (Product)</label>
            <select class="pack-product w-full p-2 border rounded bg-white text-sm text-gray-700">${prodOpts}</select>
        </div>
        <div class="w-32">
            <label class="text-[10px] text-gray-500 font-bold uppercase">จำนวนบรรจุ (ชิ้น)</label>
            <input type="number" class="pack-qty w-full p-2 border border-green-300 rounded text-center font-black text-green-700 bg-white shadow-inner" value="1000" min="1">
        </div>
        <button type="button" onclick="document.getElementById('${rowId}').remove()" class="absolute -top-2 -right-2 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-sm transition-colors">&times;</button>
    `;
    container.appendChild(div);

    // ดึงค่ารุ่นอัตโนมัติเมื่อเลือกเครื่อง
    const mSelect = div.querySelector('.pack-machine');
    const pSelect = div.querySelector('.pack-product');
    
    mSelect.addEventListener('change', function() {
        const selectedM = this.value;
        // อาศัย machineMapping จาก form.js ตัวเดิม
        if(selectedM && typeof machineMapping !== 'undefined' && machineMapping[selectedM]) {
            pSelect.value = machineMapping[selectedM];
        }
    });
};

// ฟังก์ชันบันทึกและสร้างใบแท็กพาเลท (Save & Print)
window.submitPacking = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-pack');
    const originalText = btn.innerHTML;
    
    const palletNo = document.getElementById('pack-pallet-no').value.trim();
    const category = document.getElementById('pack-category').value;
    const date = document.getElementById('pack-date').value;
    const recorder = document.getElementById('pack-recorder').value;

    if (!palletNo) {
        alert("กรุณาระบุหมายเลขพาเลท (Pallet No.)");
        return;
    }

    // รวบรวมข้อมูลรายการ
    const rows = document.getElementById('pack-batch-list').children;
    const items = [];
    let totalQty = 0;

    for (let row of rows) {
        const machine = row.querySelector('.pack-machine').value;
        const product = row.querySelector('.pack-product').value;
        const qty = parseInt(row.querySelector('.pack-qty').value) || 0;

        if (machine && qty > 0) {
            items.push({ machine, product, qty });
            totalQty += qty;
        }
    }

    if (items.length === 0) {
        alert("กรุณาเพิ่มรายการเครื่องจักรและจำนวนงานอย่างน้อย 1 รายการ");
        return;
    }

    // เตรียม Payload ส่ง Backend
    const payload = {
        action: 'SAVE_PACKING',
        timestamp: new Date().toLocaleString('th-TH'),
        date: date,
        palletNo: palletNo,
        category: category,
        recorder: recorder,
        totalQty: totalQty,
        items: items // Array ของแต่ละเครื่องที่อยู่ในพาเลทนี้
    };

    btn.disabled = true;
    btn.innerHTML = "⏳ กำลังบันทึกข้อมูล...";

    try {
        // ส่งข้อมูลไปเซิร์ฟเวอร์
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        
        // เมื่อบันทึกเสร็จ ให้เด้งหน้าต่างปริ้นใบแท็กพาเลททันที
        window.closePackingModal();
        window.printPalletTag(payload);
        
    } catch(e) {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// 🌟 ฟังก์ชันสร้างใบแท็กพาเลทสำหรับสั่งพิมพ์ (Pallet Tag Printout) 🌟
window.printPalletTag = function(data) {
    // กำหนดสีของประเภทงาน
    let catColor = "text-gray-800 border-gray-800";
    if (data.category === "งานส่งคืนทดแทน") catColor = "text-orange-600 border-orange-600 bg-orange-50";
    else if (data.category.includes("ตีกลับ")) catColor = "text-purple-600 border-purple-600 bg-purple-50";

    // สร้างตารางรายการเครื่องจักร
    let itemsHtml = '';
    data.items.forEach((item, index) => {
        itemsHtml += `
            <tr class="border-b border-dashed border-gray-400">
                <td class="py-2 text-center">${index + 1}</td>
                <td class="py-2 font-bold">${item.machine}</td>
                <td class="py-2 text-sm">${item.product}</td>
                <td class="py-2 text-right font-black text-lg">${item.qty.toLocaleString()}</td>
            </tr>
        `;
    });

    // สร้างหน้าต่าง HTML สำหรับปริ้น
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Pallet Tag - ${data.palletNo}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700;800&display=swap');
                body { font-family: 'Sarabun', sans-serif; padding: 20px; color: #000; }
                .tag-container { border: 3px solid #000; padding: 20px; max-width: 500px; margin: 0 auto; border-radius: 10px; position: relative; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .pallet-no { font-size: 48px; font-weight: 900; margin: 10px 0; letter-spacing: 2px; }
                .category-badge { display: inline-block; padding: 5px 15px; border: 2px solid; border-radius: 50px; font-weight: bold; font-size: 18px; margin-bottom: 15px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background-color: #f0f0f0; border-bottom: 2px solid #000; padding: 8px; text-align: left; font-size: 12px; }
                th.right { text-align: right; }
                .total-box { background-color: #000; color: #fff; padding: 15px; text-align: center; border-radius: 5px; }
                .total-box .lbl { font-size: 14px; }
                .total-box .val { font-size: 36px; font-weight: 900; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="tag-container">
                <div class="header">
                    <h2 style="margin:0; color:#555;">PRODUCTION PALLET TAG</h2>
                    <div class="pallet-no">${data.palletNo}</div>
                    <div class="category-badge ${catColor}">${data.category}</div>
                </div>
                
                <div class="info-grid">
                    <div><b>วันที่บรรจุ:</b> ${data.date}</div>
                    <div style="text-align:right;"><b>ผู้บรรจุ:</b> ${data.recorder}</div>
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
                    <div class="val">${data.totalQty.toLocaleString()} PCS</div>
                </div>
                
                <div style="margin-top:30px; display:flex; justify-content:space-between; font-size:12px; text-align:center;">
                    <div style="width:45%; border-top:1px solid #000; padding-top:5px;">ลายเซ็นผู้บรรจุ (Packer)</div>
                    <div style="width:45%; border-top:1px solid #000; padding-top:5px;">ลายเซ็นผู้ตรวจ (QC/Leader)</div>
                </div>
            </div>
            <script>
                // สั่งปริ้นอัตโนมัติเมื่อหน้าโหลดเสร็จ
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        // ปิดหน้าต่างนี้หลังปริ้นเสร็จ (ทางเลือกเสริม)
                        // window.close(); 
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};
