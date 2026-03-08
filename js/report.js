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
            body: JSON.stringify({ action: 'SAVE_HIDDEN_WIDGETS', data: newHidden })
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
            if (hiddenWidgets.includes(w.id)) el.classList.add('hidden');
            else el.classList.remove('hidden');
        }
    });
};

window.openAutoReport = function() {
    if (!currentDashboardData) {
        alert("⚠️ กรุณากดปุ่ม 🔍ค้นหา เพื่อดึงข้อมูลสำหรับสร้างรายงานก่อนครับ");
        return;
    }
    const modal = document.getElementById('modal-auto-report');
    let langSelector = document.getElementById('report-lang-selector');
    if (!langSelector) {
        const modalHeader = modal.querySelector('div:first-child');
        if (modalHeader) {
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
    window.renderAutoReportContent(langSelector ? langSelector.value : 'TH');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => { modal.classList.remove('opacity-0'); }, 10);
    document.body.style.overflow = '';
};

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
            if(val > peakHour.fg) { peakHour = {label: data.hourlyLabels[idx], fg: val}; }
        });
    }

    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    const dateStr = sDate === eDate ? sDate : `${sDate} ถึง ${eDate}`;
    const shiftName = document.getElementById('filterShift').options[document.getElementById('filterShift').selectedIndex].text;
    const shiftType = document.getElementById('filterShiftType').options[document.getElementById('filterShiftType').selectedIndex].text;
    const printTime = new Date().toLocaleString('th-TH');

    const textData = {
        TH: {
            title: "Production Analytics Report", subtitle: "รายงานวิเคราะห์ผลการผลิตและดัชนีชี้วัดคุณภาพเชิงลึก (Target Limit: NG ≤ 0.5%)",
            printed: "Printed:", dateRange: "ขอบเขตข้อมูล:", shiftStr: "กะการทำงาน:",
            sec1: "1. ดัชนีชี้วัดผลการดำเนินงานหลัก (Key Performance Indicators)", fg: "Total Good (FG)", ng: "Total Defect (NG)", yield: "Overall Yield", pcs: "ชิ้น", overTarget: "OVER 0.5%", targetPassed: "TARGET PASSED",
            sec2: "2. การประเมินเสถียรภาพและแนวโน้มการผลิต (Production Stability Assessment)", sec2_1_title: "📊 บทวิเคราะห์การกระจายตัวของผลผลิต (Throughput Output)", sec2_1_desc: `จากการวิเคราะห์ความสัมพันธ์ระหว่างปริมาณงานดี (FG) และความสูญเสีย (NG) สะท้อนให้เห็นถึงขีดความสามารถการเดินเครื่องของฝ่ายผลิต หากกราฟแท่ง (FG) มีความสม่ำเสมอในแต่ละวัน บ่งชี้ถึงความพร้อมทางด้านทรัพยากรและประสิทธิภาพการดำเนินงานที่คงที่`, sec2_2_title: "📉 บทวิเคราะห์ความแปรปรวนของคุณภาพ (Process Variability)", sec2_2_desc: `สัดส่วนของเสียเฉลี่ย (Average NG Rate) ทรงตัวอยู่ที่ระดับ <b>${avgNgRate}%</b> โดยรูปแบบความผันผวนของเส้นกราฟรายวันจัดเป็นดัชนีชี้วัดสำคัญ เมื่อเทียบกับเป้าหมายองค์กรที่อนุญาตให้มีของเสียไม่เกิน <b>0.5%</b> หากพบว่ากราฟมีแนวโน้มพุ่งทะลุเส้นฐาน (Baseline 0.5%) อย่างผิดปกติ ควรระงับการผลิตชั่วคราวเพื่อประเมินความเบี่ยงเบนของตัวแปร 4M (Material, Machine) โดยด่วน`,
            sec3: "3. การวิเคราะห์สาเหตุความสูญเสียเชิงลึก (Defect Root Cause Diagnostics)", sec3_top: "💡 สรุปสถานการณ์ความผิดปกติหลัก (Top Quality Violations):", sec3_perfect: "🎉 สมบูรณ์แบบ ไม่พบของเสียหลุดรอดในกระบวนการผลิต", rank: "อันดับ", amount: "จำนวน", sec3_1_title: "📉 การจัดลำดับความสำคัญของปัญหา (Pareto Logic)", sec3_1_desc: `อ้างอิงจากหลักการพาเรโต (80/20 Rule) ปัญหาคอขวดด้านคุณภาพที่หล่อเลี้ยงความสูญเสียมากที่สุดคือ <b>{topNgSymptomName}</b> ซึ่งกินสัดส่วนสูงถึง <b>{topNgSymptomRatio}%</b> เพื่อผลักดันให้อัตราของเสียรวมของระบบลดลงสู่เป้าหมายที่ <b>0.5%</b> การกำหนดมาตรการ Corrective Action (CAR) โดยทุ่มเททรัพยากรพุ่งเป้าไปที่อาการเสียประเภทนี้เป็นอันดับแรก จะส่งมอบผลลัพธ์การกอบกู้ Yield กลับมาได้รวดเร็วที่สุด`, sec3_2_title: "📈 แนวโน้มการเกิดซ้ำของปัญหาเปรียบเทียบเป้าหมาย (Defect Chronology %)", sec3_2_desc: `การติดตามเปอร์เซ็นต์ของเสียแยกตามอาการแบบรายวัน ช่วยชี้ชัดว่าความผิดปกติเกิดจากตัวแปรภายนอกแบบชั่วคราว หรือฝังรากลึกในระบบ โดยกราฟด้านล่างมีเส้น <b>Target Limit 0.5% (เส้นประสีแดง)</b> หากกราฟอาการใดตัดผ่านเส้นนี้ขึ้นไป หมายถึงความล้มเหลวเฉพาะจุดที่ทำให้อัตราของเสียรวมหลุดเป้าหมายทันที`, sec3_3_title: "🏭 การชี้เป้าแหล่งกำเนิดปัญหาขัดข้อง (Defect Source Mapping)", sec3_3_desc: `ผลลัพธ์จากการ Mapping ข้อมูลเชื่อมโยงพฤติกรรมความเสียหายของชิ้นงานเข้ากับหมายเลขเครื่องจักร ยืนยันได้ว่าเครื่องจักร <b>${topMacNg.name}</b> เป็นศูนย์กลางหลักในการปั๊มของเสียสะสมที่ระดับ <b>${topMacNg.ng.toLocaleString()}</b> ชิ้น ข้อเสนอแนะเชิงวิศวกรรมคือ ควรยกระดับแผนการบำรุงรักษาเชิงป้องกัน (PM) หรือทำ Calibration พารามิเตอร์การเดินเครื่องจักรหมายเลขนี้ใหม่ทั้งหมด`,
            sec4: "4. ประเมินสมรรถนะการผลิตและอัตราการส่งผ่าน (Productivity Validation)", sec4_1_title: "📦 ข้อจำกัดทางการผลิตแยกตามรุ่น (Product Variance)", sec4_1_desc: `ความซับซ้อนของดีไซน์สินค้าสร้างความแตกต่างเชิงประสิทธิภาพอย่างเห็นได้ชัด รุ่น <b>${bestModel.name}</b> (บรรลุ Yield ที่ ${bestModel.yield}%) ควรนำมาถอดบทเรียนเป็น Best Practice ในแง่การตั้งค่า ส่วนรุ่น <b>${worstModel.name}</b> ที่ดึง Yield ตกลงไปต่ำสุด (${worstModel.yield}%) หรือมีสัดส่วนของเสียเกิน <b>0.5%</b> จำเป็นต้องจัดตั้งทีม Task Force พิเศษเพื่อประเมินความยากง่ายใน Manufacturing Process ใหม่อีกครั้ง`, sec4_2_title: "⚙️ ดัชนีความพร้อมของเครื่องจักร (Machine Health Index)", sec4_2_desc: `จากการประเมินรายตัวชี้ให้เห็นว่า เครื่อง <b>${highestYieldMac.name}</b> สามารถรักษาสถานะการทำงานได้สมบูรณ์ที่สุด (รันผลตอบแทนที่ ${highestYieldMac.yield}%) ในทางตรงกันข้าม เครื่อง <b>${lowestYieldMac.name}</b> อยู่ในภาวะเสื่อมถอยรุนแรง (Yield ตกไปที่ ${lowestYieldMac.yield}%, อัตราสูญเสียทะลุ 0.5% ร้ายแรง) ส่งสัญญาณเตือนถึงการขัดข้องเรื้อรังที่จำเป็นต้องสั่งพักเครื่องทันที`, sec4_3_title: "⏱️ จังหวะและอัตราเร่งการผลิตรายชั่วโมง (Throughput Profile)", sec4_3_desc: `ความลื่นไหลในการเดินสายพานมีความผันผวนตามความต่อเนื่องของช่วงเวลา ข้อมูลพบจุดสูบฉีดผลผลิตสูงสุด (Peak Performance Hour) ที่ช่วงเวลา <b>${peakHour.label}</b> โดยทำศักยภาพได้ถึง <b>${peakHour.fg.toLocaleString()}</b> ชิ้น ช่องว่างความเร็วระหว่างชั่วโมง Peak กับชั่วโมงที่ดรอปลง ถือเป็นความสูญเปล่าแฝง (Hidden Waste) อันอาจเกิดจากความเหนื่อยล้าของพนักงานหรือปัญหาการป้อนวัตถุดิบชะงักงัน หัวหน้างานควรนำพฤติกรรมกราฟนี้ไปใช้ประกอบการทำ Line Balancing`,
            sec5: "5. การวิเคราะห์แนวโน้มรายวันแยกตามเครื่องจักร (Machine-Level Daily Trend Analytics)", machine: "เครื่องจักร", avgYield: "Yield เฉลี่ย", targetEvalPass: "ผ่านเกณฑ์เป้าหมาย", targetEvalFail: "ตกเกณฑ์มาตรฐาน (NG > 0.5%)", defect: "ของเสีย", mDescPass: `จากการวิเคราะห์ข้อมูลเครื่องจักร <b>{m}</b> สามารถเดินผลผลิต FG ได้รวม <b>{totalMFg} ชิ้น</b> และพบของเสีย (NG) <b>{totalMNg} ชิ้น</b> เมื่อนำมาเทียบกับ<b>เป้าหมายควบคุมของเสียองค์กรที่ 0.5%</b> พบว่าเครื่องจักรเครื่องนี้ <b>{targetEval}</b> โดยมีอัตราความแปรปรวนรายวันที่ {variance}% ({stability}) ซึ่งสามารถรักษาความต่อเนื่องของคุณภาพได้อย่างดีเยี่ยมโดยไม่พบของเสียหลุดรอดในระบบ`, mDescFail: `จากการวิเคราะห์ข้อมูลเครื่องจักร <b>{m}</b> สามารถเดินผลผลิต FG ได้รวม <b>{totalMFg} ชิ้น</b> และพบของเสีย (NG) <b>{totalMNg} ชิ้น</b> เมื่อนำมาเทียบกับ<b>เป้าหมายควบคุมของเสียองค์กรที่ 0.5%</b> พบว่าเครื่องจักรเครื่องนี้ <b>{targetEval}</b> โดยมีอัตราความแปรปรวนรายวันที่ {variance}% ({stability}) ทั้งนี้ พบจุดวิกฤตที่อัตราของเสียพุ่งสูงสุดในวันที่ <b>{maxNgDate}</b> (แตะระดับ <b>{maxNgRate}%</b>) หากเกิน 0.5% ควรตรวจสอบประวัติ Maintenance เผื่อมีการตั้งค่า (Setup) หรือปัญหาขัดข้องแฝงเร้นในวันดังกล่าว`, noMachineData: "ไม่พบข้อมูลความแปรปรวนของเครื่องจักรในช่วงเวลานี้", repBy: "Reported By", chkBy: "Checked By", appBy: "Approved By", repByRole: "(Production Leader)", chkByRole: "(QA/QC Manager)", appByRole: "(Plant Manager)", footer: "Auto Generated & Analyzed by AI System Engine", stableHigh: "มีความเสถียรสูง (Highly Stable)", stableMod: "มีความผันผวนปานกลาง (Moderate Variance)", stableLow: "มีความผันผวนสูงมาก (Highly Unstable)", noGraph: "No Graph Available", targetLimit: "Target Limit (0.5%)"
        },
        EN: {
            title: "Production Analytics Report", subtitle: "In-depth Production and Quality Metric Analysis (Target Limit: NG ≤ 0.5%)",
            printed: "Printed:", dateRange: "Date Range:", shiftStr: "Shift:",
            sec1: "1. Key Performance Indicators (KPIs)", fg: "Total Good (FG)", ng: "Total Defect (NG)", yield: "Overall Yield", pcs: "pcs", overTarget: "OVER 0.5%", targetPassed: "TARGET PASSED",
            sec2: "2. Production Stability and Trend Assessment", sec2_1_title: "📊 Throughput Output Analysis", sec2_1_desc: `Analyzing the relationship between good output (FG) and defects (NG) reflects the production capability. A consistent bar trend across days indicates stable resource availability and constant operational efficiency.`, sec2_2_title: "📉 Process Variability Analysis", sec2_2_desc: `The average NG rate is stable at <b>${avgNgRate}%</b>. Daily fluctuation is a critical indicator. Compared to the organizational target of <b>≤ 0.5%</b>, if the trend abnormally spikes above the baseline, production should be temporarily suspended to assess 4M variations (Material, Machine) immediately.`,
            sec3: "3. Defect Root Cause Diagnostics", sec3_top: "💡 Top Quality Violations:", sec3_perfect: "🎉 Perfect! No defects found in the production process.", rank: "Rank", amount: "Qty", sec3_1_title: "📉 Defect Prioritization (Pareto Logic)", sec3_1_desc: `Based on the Pareto principle (80/20 Rule), the most critical quality bottleneck is <b>{topNgSymptomName}</b>, accounting for <b>{topNgSymptomRatio}%</b> of defects. Implementing Corrective Actions (CAR) targeting this issue will most significantly recover the overall Yield to meet the <b>0.5%</b> target.`, sec3_2_title: "📈 Defect Recurrence Trend vs Target (Chronology %)", sec3_2_desc: `Tracking the daily percentage of each defect type helps identify whether anomalies are temporary external factors or systemic root issues. The <b>Target Limit 0.5% (red dashed line)</b> is shown below. Any graph crossing this line signifies a localized failure causing the overall system to miss the target.`, sec3_3_title: "🏭 Defect Source Mapping", sec3_3_desc: `Mapping part damage behavior to specific machines confirms that <b>${topMacNg.name}</b> is the primary source, accumulating <b>${topMacNg.ng.toLocaleString()}</b> defects. Engineering recommendation: Escalate Preventive Maintenance (PM) plans or recalibrate this machine's parameters entirely.`,
            sec4: "4. Productivity and Throughput Validation", sec4_1_title: "📦 Production Constraints by Model (Product Variance)", sec4_1_desc: `Product design complexity creates visible performance variations. Model <b>${bestModel.name}</b> (achieving ${bestModel.yield}% Yield) should be documented as a Best Practice. Conversely, model <b>${worstModel.name}</b> (dropping to ${worstModel.yield}%) or any exceeding <b>0.5%</b> NG rate requires a special Task Force to re-evaluate the Manufacturing Process.`, sec4_2_title: "⚙️ Machine Health Index", sec4_2_desc: `Individual assessments indicate that Machine <b>${highestYieldMac.name}</b> maintains perfect operational health (Yield ${highestYieldMac.yield}%). On the other hand, Machine <b>${lowestYieldMac.name}</b> is severely degrading (Yield dropped to ${lowestYieldMac.yield}%, severely breaching 0.5% NG). This acts as a critical warning requiring immediate intervention.`, sec4_3_title: "⏱️ Hourly Production Rhythm (Throughput Profile)", sec4_3_desc: `Conveyor flow consistency fluctuates over time. Peak Performance Hour was identified at <b>${peakHour.label}</b>, reaching <b>${peakHour.fg.toLocaleString()}</b> pieces. The gap between peak and low throughput hours is a Hidden Waste caused by operator fatigue or material shortage. Supervisors must address this for Line Balancing.`,
            sec5: "5. Machine-Level Daily Trend Analytics", machine: "Machine", avgYield: "Avg Yield", targetEvalPass: "Target Passed", targetEvalFail: "Failed (NG > 0.5%)", defect: "Defect:", mDescPass: `Data for Machine <b>{m}</b> shows <b>{totalMFg} pcs</b> of FG and <b>{totalMNg} pcs</b> of NG. Compared to the <b>0.5% organizational target</b>, this machine has <b>{targetEval}</b>. With a daily variance of {variance}% ({stability}), it maintained excellent quality consistency with no significant defect leaks.`, mDescFail: `Data for Machine <b>{m}</b> shows <b>{totalMFg} pcs</b> of FG and <b>{totalMNg} pcs</b> of NG. Compared to the <b>0.5% organizational target</b>, this machine <b>{targetEval}</b>. With a daily variance of {variance}% ({stability}), a critical spike hit <b>{maxNgRate}%</b> on <b>{maxNgDate}</b>. Since it exceeds 0.5%, Maintenance logs must be reviewed for hidden setup or downtime issues on that day.`, noMachineData: "No machine variance data found in this period.", repBy: "Reported By", chkBy: "Checked By", appBy: "Approved By", repByRole: "(Production Leader)", chkByRole: "(QA/QC Manager)", appByRole: "(Plant Manager)", footer: "Auto Generated & Analyzed by AI System Engine", stableHigh: "Highly Stable", stableMod: "Moderate Variance", stableLow: "Highly Unstable", noGraph: "No Graph Available", targetLimit: "Target Limit (0.5%)"
        },
        CH: {
            title: "生产分析报告", subtitle: "深入生产与质量指标分析 (目标限制: NG ≤ 0.5%)",
            printed: "打印时间:", dateRange: "数据范围:", shiftStr: "班次:",
            sec1: "1. 关键绩效指标 (KPIs)", fg: "总良品数 (FG)", ng: "总不良品数 (NG)", yield: "总良率", pcs: "件", overTarget: "超过 0.5%", targetPassed: "达到目标",
            sec2: "2. 生产稳定性与趋势评估", sec2_1_title: "📊 产出吞吐量分析", sec2_1_desc: `分析良品 (FG) 与不良品 (NG) 之间的关系，反映了生产线的产能。每天一致的图表趋势表明资源稳定且员工效率恒定。`, sec2_2_title: "📉 过程变异性分析", sec2_2_desc: `平均不良率稳定在 <b>${avgNgRate}%</b>。日常波动模式是一个关键指标。与 <b>0.5%</b> 的企业目标相比，如果趋势异常飙升超过基线，应立即暂停生产以评估 4M (材料、机器) 的变异。`,
            sec3: "3. 不良品根本原因诊断", sec3_top: "💡 主要质量异常:", sec3_perfect: "🎉 完美！生产过程中未发现不良品。", rank: "排名", amount: "数量", sec3_1_title: "📉 缺陷优先级排序 (帕累托逻辑)", sec3_1_desc: `基于帕累托原理 (80/20 规则)，最关键的质量瓶颈是 <b>{topNgSymptomName}</b>，占缺陷的 <b>{topNgSymptomRatio}%</b>。针对此问题实施纠正措施 (CAR) 将最显著地恢复整体良率，以达到 <b>0.5%</b> 的目标。`, sec3_2_title: "📈 缺陷复发趋势与目标对比", sec3_2_desc: `跟踪每种缺陷类型的每日百分比，有助于确定异常是暂时的外部因素还是系统性的根本问题。下方显示了 <b>目标限制 0.5% (红色虚线)</b>。任何穿过这条线的图表都意味着局部故障导致整个系统未达到目标。`, sec3_3_title: "🏭 缺陷源映射", sec3_3_desc: `将零件损坏行为映射到特定机器证实 <b>${topMacNg.name}</b> 是主要来源，累计了 <b>${topMacNg.ng.toLocaleString()}</b> 件缺陷。工程建议：升级预防性维护 (PM) 计划或完全重新校准该机器的参数。`,
            sec4: "4. 生产力与吞吐量验证", sec4_1_title: "📦 按型号划分的生产限制 (产品变异)", sec4_1_desc: `产品设计的复杂性产生了明显的性能差异。型号 <b>${bestModel.name}</b> (达到 ${bestModel.yield}% 良率) 应被记录为最佳实践。相反，型号 <b>${worstModel.name}</b> (降至 ${worstModel.yield}%) 或任何超过 <b>0.5%</b> NG 率的型号，需要一个特别工作组重新评估制造过程。`, sec4_2_title: "⚙️ 机器健康指数", sec4_2_desc: `个别评估表明，机器 <b>${highestYieldMac.name}</b> 保持了完美的运行健康状态 (良率 ${highestYieldMac.yield}%)。另一方面，机器 <b>${lowestYieldMac.name}</b> 正在严重退化 (良率降至 ${lowestYieldMac.yield}%，严重突破 0.5% NG)。这是一个关键警告，需要立即干预。`, sec4_3_title: "⏱️ 每小时生产节奏与加速 (吞吐量)", sec4_3_desc: `传送带流动的一致性随时间波动。峰值生产时间确定在 <b>${peakHour.label}</b>，达到 <b>${peakHour.fg.toLocaleString()}</b> 件。高峰和低谷吞吐量小时之间的差距是由操作员疲劳或材料短缺引起的隐藏浪费。主管必须解决此问题以实现生产线平衡。`,
            sec5: "5. 机器级每日趋势分析", machine: "机器", avgYield: "平均良率", targetEvalPass: "达到目标", targetEvalFail: "未达标 (NG > 0.5%)", defect: "不良品:", mDescPass: `机器 <b>{m}</b> 的数据显示 FG 为 <b>{totalMFg} 件</b>，NG 为 <b>{totalMNg} 件</b>。与 <b>0.5% 的企业目标</b> 相比，该机器 <b>{targetEval}</b>。每日差异为 {variance}% ({stability})，保持了出色的质量一致性，没有明显的缺陷泄漏。`, mDescFail: `机器 <b>{m}</b> 的数据显示 FG 为 <b>{totalMFg} 件</b>，NG 为 <b>{totalMNg} 件</b>。与 <b>0.5% 的企业目标</b> 相比，该机器 <b>{targetEval}</b>。每日差异为 {variance}% ({stability})，在 <b>{maxNgDate}</b> 出现了高达 <b>{maxNgRate}%</b> 的关键峰值。由于超过 0.5%，必须审查当天的维护记录以查找隐藏的设置或停机问题。`, noMachineData: "此期间未找到机器的差异数据。", repBy: "报告人", chkBy: "审核人", appBy: "批准人", repByRole: "(生产组长)", chkByRole: "(QA/QC 经理)", appByRole: "(工厂经理)", footer: "Auto Generated & Analyzed by AI System Engine", stableHigh: "高度稳定", stableMod: "中等变异", stableLow: "高度不稳定", noGraph: "No Graph Available", targetLimit: "Target Limit (0.5%)"
        }
    };
    
    let topNgHtml = '';
    const tLang = textData[lang] || textData['TH'];

    if(ngItems.length > 0) {
        topNgHtml = `<ul class="list-disc pl-5 mt-2 space-y-1 text-sm text-gray-700">`;
        ngItems.slice(0, 3).forEach((item, idx) => {
            let pct = totalNG > 0 ? ((item.pcs / totalNG) * 100).toFixed(1) : 0;
            if(idx === 0) { topNgSymptomName = item.label; topNgSymptomRatio = pct; }
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

    let imgParetoDynamic = '';
    let autoReportParetoConfig = null;
    if (ngItems.length > 0 && typeof Chart !== 'undefined') {
        const pLabels = ngItems.map(item => item.label);
        const pDataPcs = ngItems.map(item => item.pcs);
        let cumulativeAcc = 0;
        const pDataCum = pDataPcs.map(val => {
            cumulativeAcc += val;
            return (cumulativeAcc / totalNG * 100).toFixed(2);
        });

        autoReportParetoConfig = {
            labels: pLabels,
            datasets: [
                { type: 'bar', label: tLang.ng + ' (' + tLang.pcs + ')', data: pDataPcs, backgroundColor: 'rgba(239, 68, 68, 0.8)', yAxisID: 'y' },
                { type: 'line', label: 'Cumulative (%)', data: pDataCum, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 1)', borderWidth: 2, tension: 0.3, yAxisID: 'y1' }
            ]
        };

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1200; canvas.height = 400;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            const pChart = new Chart(canvas, {
                data: autoReportParetoConfig,
                options: {
                    animation: false, responsive: false,
                    plugins: { legend: { display: true, position: 'top' }, datalabels: { display: false } },
                    scales: {
                        y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: tLang.ng + ' (' + tLang.pcs + ')' } },
                        y1: { type: 'linear', position: 'right', beginAtZero: true, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: 'Cumulative (%)' } }
                    }
                }
            });
            imgParetoDynamic = pChart.toDataURL('image/png', 1.0);
            pChart.destroy();
        } catch(e) { console.error(e); }
    }

    let imgNgTrendDynamic = '';
    let autoReportNgTrendConfig = null;
    if (data.dailyTrend && data.dailyTrend.length > 0 && typeof Chart !== 'undefined') {
        const symptomTotals = {};
        data.dailyTrend.forEach(d => {
            if(d.ngBreakdown) Object.keys(d.ngBreakdown).forEach(k => { symptomTotals[k] = (symptomTotals[k] || 0) + d.ngBreakdown[k]; });
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
                borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length], borderWidth: 2, tension: 0.3, fill: false
            };
        });

        ngTrendDatasets.push({
            label: tLang.targetLimit, data: data.dailyTrend.map(() => 0.5), borderColor: 'rgba(239, 68, 68, 1)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0
        });

        autoReportNgTrendConfig = { labels: data.dailyTrend.map(d => d.date), datasets: ngTrendDatasets };

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1200; canvas.height = 400;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            const tChart = new Chart(canvas, {
                type: 'line', data: autoReportNgTrendConfig,
                options: {
                    animation: false, responsive: false, plugins: { legend: { display: true, position: 'top' }, datalabels: { display: false } },
                    scales: { y: { type: 'linear', beginAtZero: true, title: { display: true, text: '% (Yield %)' } } }
                }
            });
            imgNgTrendDynamic = tChart.toDataURL('image/png', 1.0);
            tChart.destroy();
        } catch(e) { console.error(e); }
    }

    const imgDailyOutput = getChartImg('dailyOutputChart');
    const imgTrendNG = getChartImg('qcTrendChart'); 
    const imgNgMac = getChartImg('ngByMachineChart');
    const imgYieldModel = getChartImg('yieldModelChart');
    const imgYieldMac = getChartImg('yieldMachineChart');
    const imgHourly = getChartImg('hourlyChart');

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
            let totalMFg = 0; let totalMNg = 0; let maxNgRate = 0; let maxNgDate = '-'; let trend = [];

            dates.forEach(d => {
                const fg = mDaily[d].fg || 0; const ng = mDaily[d].ngPcs || 0; const total = fg + ng;
                const rate = total > 0 ? (ng / total) * 100 : 0;
                totalMFg += fg; totalMNg += ng; trend.push(rate);
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
                id: chartId, labels: dates, fgData: dates.map(d => mDaily[d].fg || 0), ngData: dates.map(d => mDaily[d].ngPcs || 0),
                rateData: dates.map(d => {
                    const f = mDaily[d].fg || 0; const n = mDaily[d].ngPcs || 0;
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
                    <p class="text-[12px] text-gray-700 leading-relaxed text-justify indent-8 mb-4">${descHtml}</p>
                    <div class="bg-gray-50 p-4 rounded-lg border border-gray-100 w-full h-[280px] relative">
                        <canvas id="${chartId}" style="width:100%; height:100%;"></canvas>
                    </div>
                </div>
            `;
        }
    }
    
    if(!hasMachineData) machineAnalysisHtml += `<p class="text-xs text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded bg-gray-50">${tLang.noMachineData}</p>`;
    machineAnalysisHtml += `</div></div></div>`;

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

            <div class="mb-8">
                <h3 class="text-lg font-bold text-gray-800 border-l-4 border-indigo-500 pl-2 mb-4 bg-gray-50 py-1">${tLang.sec2}</h3>
                <div class="grid grid-cols-1 gap-6">
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec2_1_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">${tLang.sec2_1_desc}</p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgDailyOutput ? `<img src="${imgDailyOutput}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec2_2_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">${tLang.sec2_2_desc}</p>
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
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-4 border border-gray-100 h-[300px] relative">
                            <!-- 🌟 พื้นที่สำหรับกราฟ Pareto Maximize 🌟 -->
                            <canvas id="auto-report-pareto-chart" style="width:100%; height:100%;"></canvas>
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec3_2_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">
                            ${tLang.sec3_2_desc}
                        </p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-4 border border-gray-100 h-[300px] relative">
                            <!-- 🌟 พื้นที่สำหรับกราฟ NG Trend %เทียบยอดผลิต Maximize 🌟 -->
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
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">${tLang.sec4_1_desc}</p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgYieldModel ? `<img src="${imgYieldModel}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec4_2_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">${tLang.sec4_2_desc}</p>
                        <div class="mt-auto w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                            ${imgYieldMac ? `<img src="${imgYieldMac}" class="w-full h-[280px] object-contain mx-auto" />` : `<p class="text-center text-sm text-gray-400">${tLang.noGraph}</p>`}
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 p-5 rounded-xl bg-white shadow-sm page-break-inside-avoid">
                        <p class="text-base font-bold text-gray-800 mb-2">${tLang.sec4_3_title}</p>
                        <p class="text-[12px] text-gray-600 mb-4 leading-relaxed indent-8 text-justify">${tLang.sec4_3_desc}</p>
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

        if (autoReportParetoConfig) {
            const ctxPareto = document.getElementById('auto-report-pareto-chart');
            if (ctxPareto) {
                window.autoReportCharts.push(new Chart(ctxPareto, {
                    data: autoReportParetoConfig,
                    options: {
                        animation: false, responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: true, position: 'top' }, datalabels: { display: false } },
                        scales: {
                            y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: tLang.ng + ' (' + tLang.pcs + ')' } },
                            y1: { type: 'linear', position: 'right', beginAtZero: true, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: 'Cumulative (%)' } }
                        }
                    }
                }));
            }
        }

        if (autoReportNgTrendConfig) {
            const ctxNgTrend = document.getElementById('auto-report-ng-trend-chart');
            if (ctxNgTrend) {
                window.autoReportCharts.push(new Chart(ctxNgTrend, {
                    type: 'line', data: autoReportNgTrendConfig,
                    options: {
                        animation: false, responsive: true, maintainAspectRatio: false,
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
                        animation: false, responsive: true, maintainAspectRatio: false,
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
    setTimeout(() => { document.body.classList.remove('printing-auto-report'); }, 1000);
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
                else if (productAssigned.includes("16A")) weightPerPc = 0.0028;
                else if (productAssigned.includes("20A")) weightPerPc = 0.0036;
                else if (productAssigned.includes("25/32A")) weightPerPc = 0.0045; 
                
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
