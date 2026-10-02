window.renderNgTrendChart = function() {
    if (!currentDashboardData || !charts) return;
    const data = currentDashboardData;
    const ctxNgTrend = document.getElementById('ngSymptomTrendChart');
    if (!ctxNgTrend) return;

    const selector = document.getElementById('ngTrendSelector');
    const mode = selector ? selector.value : 'pcs';

    // === Machine Filter (แยกดูรายเครื่อง) ===
    const macSel = document.getElementById('ngTrendMachineSelector');
    if (macSel) {
        const prevVal = macSel.value;
        macSel.innerHTML = '<option value="all">ทุกเครื่อง</option>';
        Object.keys(data.machineData || {}).sort().forEach(m => {
            const md = data.machineData[m];
            const hasNg = md && md.daily && Object.values(md.daily).some(day => day.ngBreakdown && Object.keys(day.ngBreakdown).length > 0);
            if (hasNg) {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                macSel.appendChild(opt);
            }
        });
        if (prevVal && [...macSel.options].some(o => o.value === prevVal)) macSel.value = prevVal;
    }
    const selectedMac = macSel ? macSel.value : 'all';

    if (charts.ngSymptomTrend) charts.ngSymptomTrend.destroy();
    let trendData = data.dailyTrend || [];

    // ถ้าเลือกเครื่องเฉพาะ: สร้างข้อมูลรายวันใหม่จาก machineData ของเครื่องนั้น (วันที่ตรงกับกราฟรวม)
    if (selectedMac !== 'all' && data.machineData && data.machineData[selectedMac]) {
        const mDaily = data.machineData[selectedMac].daily || {};
        trendData = trendData.map(d => {
            const day = mDaily[d.date] || {};
            return {
                date: d.date,
                ngBreakdown: day.ngBreakdown || {},
                fg: day.fg || 0,
                ng: day.ngPcs !== undefined ? day.ngPcs : (day.ng || 0)
            };
        });
    }
    
    // รวม Setup เข้ากับอาการหลัก + เก็บ setup แยก
    let ngTypeTotals = {};
    let setupTotals = {};
    trendData.forEach(d => {
        if(d.ngBreakdown) {
            Object.keys(d.ngBreakdown).forEach(k => {
                const parsed = window.parseSetupType(k);
                const baseKey = parsed.base;
                ngTypeTotals[baseKey] = (ngTypeTotals[baseKey] || 0) + d.ngBreakdown[k];
                if (parsed.isSetup && baseKey.toLowerCase() !== 'setup') {
                    setupTotals[baseKey] = (setupTotals[baseKey] || 0) + d.ngBreakdown[k];
                }
            });
        }
    });
    const uniqueNgTypes = Object.keys(ngTypeTotals).sort((a, b) => ngTypeTotals[b] - ngTypeTotals[a]);
    const hasSetupInTrend = Object.keys(setupTotals).length > 0;

    const lineColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];

    let trendDatasets = [];
    uniqueNgTypes.forEach((type, idx) => {
        const color = lineColors[idx % lineColors.length];
        // เส้นรวม (Production + Setup)
        trendDatasets.push({
            label: type,
            ngKey: type, ngSetupOnly: false,
            data: trendData.map(d => {
                if (!d.ngBreakdown) return 0;
                // รวม base + Setup ของ type นี้
                let rawPcs = 0;
                Object.keys(d.ngBreakdown).forEach(k => {
                    const parsed = window.parseSetupType(k);
                    if (parsed.base === type) rawPcs += d.ngBreakdown[k];
                });
                if (mode === 'percent') {
                    const total = (d.fg || 0) + (d.ng || 0);
                    if (total <= 0) return 0;
                    return Math.min(parseFloat(((rawPcs / total) * 100).toFixed(2)), 100);
                }
                return rawPcs;
            }),
            borderColor: color,
            backgroundColor: color,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: false
        });

        // เส้น Setup แยก (ถ้ามี) - เส้นประ
        if (setupTotals[type] > 0) {
            trendDatasets.push({
                label: type + ' (Setup)',
                ngKey: type, ngSetupOnly: true,
                data: trendData.map(d => {
                    if (!d.ngBreakdown) return 0;
                    let setupPcs = 0;
                    Object.keys(d.ngBreakdown).forEach(k => {
                        const parsed = window.parseSetupType(k);
                        if (parsed.isSetup && parsed.base === type) setupPcs += d.ngBreakdown[k];
                    });
                    if (mode === 'percent') {
                        const total = (d.fg || 0) + (d.ng || 0);
                        if (total <= 0) return 0;
                        return Math.min(parseFloat(((setupPcs / total) * 100).toFixed(2)), 100);
                    }
                    return setupPcs;
                }),
                borderColor: color,
                backgroundColor: color + '40',
                tension: 0.3,
                borderWidth: 1.5,
                borderDash: [5, 3],
                pointRadius: 2,
                pointHoverRadius: 5,
                pointStyle: 'triangle',
                fill: false
            });
        }
    });
    
    // จำนวนชิ้นเสียดิบของแต่ละเส้นต่อวัน ไว้แสดงรายการคำนวณใน tooltip
    trendDatasets.forEach(ds => {
        ds.rawPcs = trendData.map(d => {
            let n = 0;
            if (d.ngBreakdown) Object.keys(d.ngBreakdown).forEach(k => {
                const parsed = window.parseSetupType(k);
                if (parsed.base === ds.ngKey && (!ds.ngSetupOnly || parsed.isSetup)) n += d.ngBreakdown[k];
            });
            return n;
        });
    });

    const commonOpts = { 
         responsive: true, 
         maintainAspectRatio: false,
         plugins: {
             zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } }
         }
    };

    const dataLabelsPlugin = typeof window.ChartDataLabels !== 'undefined' ? window.ChartDataLabels : null;
    const activePlugins = dataLabelsPlugin ? [dataLabelsPlugin] : [];

    // 🌟 ตัวแปร state สำหรับ label toggle และ isolate
    window._ngTrendLabelsOn = window._ngTrendLabelsOn || false;

    // 🌟 ตัวแปรสำหรับตั้งเวลาเพื่อแยกการคลิก 1 ครั้ง / 2 ครั้ง 🌟
    let ngTrendClickTimer = null;

    // 🔒 คงอาการที่เลือกไว้ (Legend) แม้เปลี่ยนฟิวเตอร์ด้านบน — รีเซ็ตเมื่อกด "แสดงทั้งหมด"
    // window._ngTrendVisible = null (แสดงทุกเส้น) หรือ Set ของชื่อเส้นที่เลือกให้แสดง
    const lockedVisible = window._ngTrendVisible;
    if (lockedVisible) trendDatasets.forEach(ds => { ds.hidden = !lockedVisible.has(ds.label); });

    charts.ngSymptomTrend = new Chart(ctxNgTrend, {
        type: 'line',
        plugins: activePlugins.concat(window.qcCrosshairPlugin ? [window.qcCrosshairPlugin] : []),
        data: {
            labels: trendData.map(d=>d.date),
            datasets: trendDatasets
        },
        options: {
            ...commonOpts,
            // ============================================
            // 🌟 ระบบแยกคลิก 1 ครั้ง / 2 ครั้ง สำหรับกราฟนี้ 
            // ============================================
            onClick: function(e, elements, chart) {
                if (chart.$drawMode) return; // กำลังใช้เครื่องมือตีเส้น ไม่เปิด breakdown
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const datasetIndex = element.datasetIndex;
                const index = element.index;
                
                const dateStr = chart.data.labels[index];
                const symptom = chart.data.datasets[datasetIndex].label;
                const val = chart.data.datasets[datasetIndex].data[index];

                if (val === 0) return; // ไม่แสดงถ้าค่าเป็น 0

                if (ngTrendClickTimer) {
                    // 🌟 ดับเบิ้ลคลิก (2 clicks) -> ซูมเข้าเหมือนระบบเดิม
                    clearTimeout(ngTrendClickTimer);
                    ngTrendClickTimer = null;
                    
                    const axisId = chart.options.indexAxis === 'y' ? 'y' : 'x';
                    if(chart.options.scales[axisId]) {
                        chart.options.scales[axisId].min = index;
                        chart.options.scales[axisId].max = index;
                        chart.update();
                    }
                } else {
                    // 🌟 คลิกครั้งแรก (ตั้งเวลาเผื่อ 250ms เพื่อดูว่าจะมีการคลิกซ้ำเป็นดับเบิ้ลคลิกไหม)
                    ngTrendClickTimer = setTimeout(() => {
                        ngTrendClickTimer = null;
                        
                        // 🌟 คลิก 1 ครั้ง -> คำนวณและแสดงว่ามาจากเครื่องจักรไหนบ้าง
                        if (!currentDashboardData || !currentDashboardData.machineData) return;
                        
                        let machineBreakdown = [];
                        let totalPcs = 0;
                        
                        // วนลูปหาข้อมูลของเสียอาการนี้ ในวันที่เลือก จากทุกเครื่องจักร (รวม Setup)
                        // ถ้ากรองรายเครื่องอยู่ แสดงเฉพาะเครื่องนั้น
                        for (const [mac, mData] of Object.entries(currentDashboardData.machineData)) {
                            if (selectedMac !== 'all' && mac !== selectedMac) continue;
                            if (mData.daily && mData.daily[dateStr] && mData.daily[dateStr].ngBreakdown) {
                                const bd = mData.daily[dateStr].ngBreakdown;
                                // รวม base + Setup ของอาการนี้
                                let mPcs = 0;
                                Object.keys(bd).forEach(k => {
                                    const parsed = window.parseSetupType(k);
                                    if (parsed.base === symptom) mPcs += bd[k];
                                });
                                if (mPcs > 0) {
                                    machineBreakdown.push({ machine: mac, pcs: mPcs });
                                    totalPcs += mPcs;
                                }
                            }
                        }
                        
                        machineBreakdown.sort((a, b) => b.pcs - a.pcs); // เรียงจากมากไปน้อย
                        
                        // นำข้อมูลไปแสดงผลใน Modal (ใช้ Modal เดิมที่มีอยู่แล้วเพื่อความสวยงาม)
                        const container = document.getElementById('daily-ng-content');
                        const title = document.getElementById('daily-ng-title');
                        
                        if (title && container) {
                            title.innerHTML = `⚙️ แหล่งที่มา: <span class="text-yellow-300">${symptom}</span> <span class="text-xs font-normal text-white ml-1">(${dateStr})</span>`;
                            
                            let html = '<ul class="divide-y divide-gray-200">';
                            if (machineBreakdown.length === 0) {
                                html += '<li class="py-3 text-center text-gray-500">ไม่พบข้อมูลเครื่องจักร</li>';
                            } else {
                                machineBreakdown.forEach(item => {
                                    const pct = totalPcs > 0 ? ((item.pcs / totalPcs) * 100).toFixed(1) : 0;
                                    html += `
                                    <li class="py-3 flex justify-between items-center">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-bold text-gray-800">${item.machine}</span>
                                            <span class="text-xs text-gray-500">สัดส่วน: ${pct}%</span>
                                        </div>
                                        <span class="text-sm font-bold text-red-600">${item.pcs.toLocaleString()} ชิ้น</span>
                                    </li>`;
                                });
                                html += `
                                <li class="py-3 flex justify-between items-center bg-red-50 mt-2 px-3 rounded-lg font-bold border border-red-100">
                                    <span class="text-red-800">รวมทั้งหมด</span>
                                    <span class="text-red-800 text-lg">${totalPcs.toLocaleString()} ชิ้น</span>
                                </li>`;
                            }
                            html += '</ul>';
                            container.innerHTML = html;
                            
                            const modalWindow = document.getElementById('modal-daily-ng-breakdown');
                            if(modalWindow) {
                                modalWindow.classList.remove('hidden');
                                // 🌟 บังคับใส่ !important เพื่อให้ทะลุโหมด Maximize
                                modalWindow.style.setProperty('z-index', '999999', 'important'); 
                            }
                        }
                    }, 250); // รอ 250 มิลลิวินาที
                }
            },
            scales: {
                x: { offset: true },
                y: mode === 'percent' ? {
                    type: 'logarithmic',
                    min: 0.1,
                    max: 100,
                    title: { display: true, text: '% เทียบยอดผลิต' },
                    ticks: { callback: v => v + '%', autoSkip: true, maxTicksLimit: 10 }
                } : {
                    beginAtZero: true,
                    title: { display: true, text: 'จำนวน (ชิ้น)' }
                }
            },
            layout: { padding: { top: 20, right: 20 } },
            plugins: {
                ...commonOpts.plugins,
                legend: { display: false }, // ใช้ Legend แบบ HTML แทน (ngTrendRenderLegend) เพราะอาการเยอะ
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    itemSort: function(a, b) {
                        return b.raw - a.raw; 
                    },
                    filter: function(tooltipItem) {
                        return tooltipItem.raw > 0;
                    },
                    callbacks: {
                        label: function(context) {
                            const pcs = (context.dataset.rawPcs || [])[context.dataIndex];
                            if (mode === 'percent') {
                                return `${context.dataset.label}: ${context.parsed.y}%` + (pcs != null ? ` · ${pcs.toLocaleString()} ชิ้น` : '');
                            }
                            return `${context.dataset.label}: ${context.parsed.y} ชิ้น`;
                        },
                        // รายการคำนวณ: ยอดผลิตของวันนั้น + สูตร + ตัวอย่างจากเส้นบนสุด
                        footer: function(items) {
                            if (!items.length) return '';
                            const d = trendData[items[0].dataIndex] || {};
                            const fg = d.fg || 0, ng = d.ng || 0, total = fg + ng;
                            const lines = [`ยอดผลิตวันนี้ = FG ${fg.toLocaleString()} + NG ${ng.toLocaleString()} = ${total.toLocaleString()} ชิ้น`];
                            if (mode === 'percent') {
                                const top = items[0];
                                const pcs = (top.dataset.rawPcs || [])[top.dataIndex];
                                lines.push('% = ชิ้นเสียของอาการ ÷ ยอดผลิต × 100');
                                if (pcs != null && total > 0) lines.push(`เช่น ${top.dataset.label}: ${pcs.toLocaleString()} ÷ ${total.toLocaleString()} × 100 = ${top.parsed.y}%`);
                            }
                            return lines;
                        }
                    }
                },
                datalabels: {
                    display: function(ctx) {
                        if (!window._ngTrendLabelsOn) return false;
                        return ctx.dataset.data[ctx.dataIndex] > 0;
                    },
                    align: 'top',
                    color: function(context) {
                        return context.dataset.borderColor;
                    },
                    font: { weight: 'bold', size: 11 },
                    formatter: (value) => value > 0 ? value + (mode === 'percent' ? '%' : '') : null
                }
            }
        }
    });

    // 🖊️ เครื่องมือตีเส้นบนกราฟ (TradingView style) — js/charts/draw-tool.js
    if (window.initChartDrawTool) window.initChartDrawTool(charts.ngSymptomTrend, 'ngSymptomTrend', { suffix: mode === 'percent' ? '%' : '' });

    // Legend แบบกะทัดรัด + คำอธิบายรายการคำนวณ (ปุ่ม ℹ️)
    window.ngTrendRenderLegend();
    const helpBox = document.getElementById('ngTrendHelp');
    if (helpBox) {
        const scope = selectedMac === 'all' ? 'ทุกเครื่องรวมกัน' : 'เครื่อง ' + selectedMac;
        helpBox.innerHTML = mode === 'percent'
            ? `<b>% เทียบยอดผลิต</b> = ชิ้นเสียของอาการนั้น ÷ (FG + NG ของวันนั้น) × 100<br>• นับเป็นชิ้น (ไม่ถ่วงน้ำหนัก Kg) · ขอบเขต: ${scope}<br>• เส้นประ (Setup) = ส่วนที่เสียตอน Setup ซึ่งรวมอยู่ในเส้นหลักแล้ว ไม่ต้องบวกซ้ำ<br>• วางเมาส์บนกราฟเพื่อดูรายการคำนวณรายวัน (ยอดผลิต + ตัวอย่างสูตร)`
            : `<b>จำนวนเสีย (ชิ้น)</b> = ชิ้นเสียของอาการนั้นในวันนั้น · ขอบเขต: ${scope}<br>• เส้นประ (Setup) = ส่วนที่เสียตอน Setup ซึ่งรวมอยู่ในเส้นหลักแล้ว ไม่ต้องบวกซ้ำ<br>• วางเมาส์บนกราฟเพื่อดูยอดผลิตของวันนั้น`;
    }

    // ปุ่ม "แสดงทั้งหมด" โชว์เมื่อมีการล็อกอาการอยู่
    const showAllBtnInit = document.getElementById('ngTrendShowAll');
    if (showAllBtnInit) showAllBtnInit.classList.toggle('hidden', !window._ngTrendVisible);

    // อัพเดทสถานะปุ่ม toggle label
    const lblBtn = document.getElementById('ngTrendLabelToggle');
    if (lblBtn) {
        lblBtn.style.backgroundColor = window._ngTrendLabelsOn ? '#dbeafe' : '';
        lblBtn.style.fontWeight = window._ngTrendLabelsOn ? 'bold' : '';
    }
};

// 🌟 Toggle แสดง/ซ่อนตัวเลขบนกราฟ NG Symptom Trend
window.toggleNgTrendLabels = function() {
    window._ngTrendLabelsOn = !window._ngTrendLabelsOn;
    const lblBtn = document.getElementById('ngTrendLabelToggle');
    if (lblBtn) {
        lblBtn.style.backgroundColor = window._ngTrendLabelsOn ? '#dbeafe' : '';
        lblBtn.style.fontWeight = window._ngTrendLabelsOn ? 'bold' : '';
    }
    if (charts.ngSymptomTrend) charts.ngSymptomTrend.update();
};

// 🌟 แสดงทุกเส้นกลับมา
window.ngTrendShowAll = function() {
    window._ngTrendVisible = null; // ปลดล็อกอาการที่เลือกไว้
    if (charts.ngSymptomTrend) {
        charts.ngSymptomTrend.data.datasets.forEach((ds, i) => {
            charts.ngSymptomTrend.setDatasetVisibility(i, true);
        });
        charts.ngSymptomTrend.update();
    }
    const showAllBtn = document.getElementById('ngTrendShowAll');
    if (showAllBtn) showAllBtn.classList.add('hidden');
    window.ngTrendRenderLegend();
};



// 🏷️ Legend แบบ HTML กะทัดรัด: รวมเส้นหลัก + เส้น (Setup) ของอาการเดียวกันเป็น 1 ชิป
//  - คลิก = เลือกดูเฉพาะอาการนั้น (คลิกซ้ำ = แสดงทั้งหมด) · Ctrl/Shift+คลิก = เพิ่ม/ลดทีละอาการ
//  - ค่าเริ่มต้นแสดงชิปอาการที่เสียมากสุด 10 อันดับ (หรือเฉพาะที่เลือกไว้) กด "ดูทั้งหมด" เพื่อขยาย
window.ngTrendRenderLegend = function() {
    const chart = charts.ngSymptomTrend;
    const box = document.getElementById('ngTrendLegend');
    if (!chart || !box) return;
    const LIMIT = 10;
    const groups = [];
    const byKey = {};
    chart.data.datasets.forEach((ds, i) => {
        const key = ds.ngKey !== undefined ? ds.ngKey : ds.label;
        if (!byKey[key]) { byKey[key] = { key, color: ds.borderColor, idx: [] }; groups.push(byKey[key]); }
        byKey[key].idx.push(i);
    });
    const isOn = g => g.idx.some(i => chart.isDatasetVisible(i));
    const locked = !!window._ngTrendVisible;
    const expanded = !!window._ngTrendLegendExpanded;
    let shown = groups;
    if (!expanded) shown = locked ? groups.filter(isOn) : groups.slice(0, LIMIT);

    box.innerHTML = '';
    box.className = 'mt-1 flex flex-wrap gap-1 items-center overflow-y-auto' + (expanded ? ' max-h-32' : '');
    shown.forEach(g => {
        const on = isOn(g);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 bg-white hover:bg-gray-50 max-w-[260px]' + (on ? '' : ' opacity-40 line-through');
        b.title = g.key + (g.idx.length > 1 ? ' (รวมเส้น Setup)' : '') + '\nคลิก = ดูเฉพาะอาการนี้ · Ctrl/Shift+คลิก = เพิ่ม/ลด';
        const dot = document.createElement('span');
        dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:2px;flex:none;background:' + g.color;
        const txt = document.createElement('span');
        txt.className = 'truncate';
        txt.textContent = g.key;
        b.appendChild(dot); b.appendChild(txt);
        if (g.idx.length > 1) {
            const s = document.createElement('span');
            s.className = 'text-gray-400 flex-none';
            s.textContent = '+S';
            b.appendChild(s);
        }
        b.addEventListener('click', ev => window.ngTrendLegendClick(g.key, ev.ctrlKey || ev.shiftKey || ev.metaKey));
        box.appendChild(b);
    });
    if (groups.length > shown.length || expanded) {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'text-[10px] border rounded px-2 py-0.5 text-blue-600 bg-blue-50 hover:bg-blue-100 flex-none';
        t.textContent = expanded ? '▲ ย่อ' : `▼ ดูทั้งหมด (${groups.length})`;
        t.addEventListener('click', () => { window._ngTrendLegendExpanded = !expanded; window.ngTrendRenderLegend(); });
        box.appendChild(t);
    }
};

window.ngTrendLegendClick = function(key, multi) {
    const chart = charts.ngSymptomTrend;
    if (!chart) return;
    const all = chart.data.datasets;
    const inGroup = ds => (ds.ngKey !== undefined ? ds.ngKey : ds.label) === key;
    const idx = all.map((ds, i) => inGroup(ds) ? i : -1).filter(i => i >= 0);
    if (multi) {
        const on = idx.some(i => chart.isDatasetVisible(i));
        idx.forEach(i => chart.setDatasetVisibility(i, !on));
    } else {
        const onlyThis = idx.every(i => chart.isDatasetVisible(i)) && all.every((ds, i) => idx.includes(i) || !chart.isDatasetVisible(i));
        all.forEach((ds, i) => chart.setDatasetVisibility(i, onlyThis ? true : idx.includes(i)));
    }
    // จำเส้นที่แสดงอยู่ไว้ ใช้ตอนเปลี่ยนฟิวเตอร์ (null = แสดงทั้งหมด)
    const anyHidden = all.some((ds, i) => !chart.isDatasetVisible(i));
    window._ngTrendVisible = anyHidden ? new Set(all.filter((ds, i) => chart.isDatasetVisible(i)).map(ds => ds.label)) : null;
    const showAllBtn = document.getElementById('ngTrendShowAll');
    if (showAllBtn) showAllBtn.classList.toggle('hidden', !anyHidden);
    chart.update();
    window.ngTrendRenderLegend();
};
