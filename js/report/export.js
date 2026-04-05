// =========================================================
// 🌟 แก้ปัญหา Android Mobile Chrome พิมพ์หน้าจอไม่ได้ 🌟
// =========================================================
window.printAutoReport = function() {
    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    const shiftElement = document.getElementById('filterShift');
    const shift = shiftElement.options[shiftElement.selectedIndex].text;
    
    let dateStr = "";
    if (sDate) {
        const dateObj = new Date(sDate);
        if (!isNaN(dateObj.getTime())) { 
            const options = { day: 'numeric', month: 'short', year: 'numeric' };
            dateStr = dateObj.toLocaleDateString('en-GB', options);
        } else {
             dateStr = sDate; 
        }
    } else {
         dateStr = "Unknown Date";
    }

    if (eDate && eDate !== sDate) {
         const eDateObj = new Date(eDate);
         if (!isNaN(eDateObj.getTime())) {
             const eOptions = { day: 'numeric', month: 'short', year: 'numeric' };
             dateStr += ` to ${eDateObj.toLocaleDateString('en-GB', eOptions)}`;
         }
    }

    const targetTitle = `CWM_Report_Shift_${shift}_${dateStr.replace(/ /g, '_')}`;
    const originalTitle = document.title;
    document.title = targetTitle;

    const modal = document.getElementById('modal-auto-report');
    
    // เก็บ Class ดั้งเดิมไว้
    const originalModalClasses = modal.className;

    // ถอดความเป็น Modal ชั่วคราว (ทิ้ง Fixed / inset-0) เพราะ Android จะงงเวลา Spool PDF
    document.body.classList.add('printing-auto-report');
    modal.className = 'block w-full bg-white z-50'; // กำหนดให้เป็นเอกสารธรรมดา
    document.body.style.overflow = 'visible'; // บังคับให้ Scroll ได้ขณะพิมพ์

    // เลื่อนจอขึ้นบนสุดเพื่อให้ระบบ Spooler ของมือถือเก็บภาพได้ครบถ้วน
    window.scrollTo(0, 0);
    
    // หน่วงเวลาให้เบราว์เซอร์จัดเรียง DOM ใหม่ (Reflow) ก่อนสั่งพิมพ์
    setTimeout(() => {
        window.print();
        
        // คืนค่าเดิมหลังจากพิมพ์เสร็จ
        setTimeout(() => { 
            document.body.classList.remove('printing-auto-report'); 
            modal.className = originalModalClasses; // สวมชุด Modal กลับคืน
            document.title = originalTitle;
            document.body.style.overflow = '';
        }, 1000);
    }, 800); // ดีเลย์ 800ms ให้ Canvas และ Layout วาดตัวเสร็จ
};

window.exportCSV = function() {
    if (!currentDashboardData) {
        alert("⚠️ กรุณากดปุ่มค้นหาข้อมูล (ดึง Dashboard) ก่อนทำการส่งออก Excel");
        return;
    }
    
    const data = currentDashboardData;
    let csvContent = "\ufeff"; 
    
    csvContent += "--- Overall Summary ---\n";
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

    csvContent += "\n--- Daily Breakdown ---\n";
    csvContent += "Date,Machine,Product Assigned,FG (Pcs),NG (Pcs),NG (Kg),% Yield\n";

    const datesSet = new Set();
    if (data.machineData) {
        Object.values(data.machineData).forEach(mData => {
            if (mData.daily) Object.keys(mData.daily).forEach(d => datesSet.add(d));
        });
    }
    const sortedDates = Array.from(datesSet).sort();

    sortedDates.forEach(date => {
        for(let i=1; i<=16; i++) {
            const m = `CWM-${String(i).padStart(2,'0')}`;
            const productAssigned = machineMapping[m] || 'Unassigned';
            const mData = data.machineData ? data.machineData[m] : null;
            
            if (mData && mData.daily && mData.daily[date]) {
                const daily = mData.daily[date];
                const fg = daily.fg || 0;
                const ngPcs = daily.ngPcs || 0;
                
                let weightPerPc = 0.003; 
                if (productAssigned.includes("10A")) weightPerPc = 0.00228;
                else if (productAssigned.includes("16A")) weightPerPc = 0.00279;
                else if (productAssigned.includes("20A")) weightPerPc = 0.00357;
                else if (productAssigned.includes("25/32A")) weightPerPc = 0.005335; 
                
                const ngKg = (ngPcs * weightPerPc).toFixed(2);
                const total = fg + ngPcs;
                const y = total > 0 ? ((fg/total)*100).toFixed(2) : "0.00";
                
                if (total > 0) csvContent += `${date},${m},${productAssigned},${fg},${ngPcs},${ngKg},${y}%\n`;
            }
        }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `CWM_Report_${document.getElementById('startDate').value}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

