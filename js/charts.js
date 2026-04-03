try { Chart.register(ChartDataLabels); } catch(e) { console.warn("ChartDataLabels not loaded"); }

// ==========================================
// Helper: แยก Setup vs Production จาก NG data
// "Setup - ลวดถลอก (Scratched)" → base = "ลวดถลอก (Scratched)", isSetup = true
// ==========================================
window.parseSetupType = function(typeName) {
    const t = (typeName || '').trim();
    const match = t.match(/^setup\s*-\s*(.+)$/i);
    if (match) return { base: capitalizeFirst(match[1].trim()), isSetup: true };
    if (t.toLowerCase() === 'setup') return { base: 'Setup', isSetup: true };
    return { base: capitalizeFirst(t), isSetup: false };
};

// รวม NG data โดยแยกชั้น Production vs Setup
// input: { "ลวดถลอก (Scratched)": 100, "Setup - ลวดถลอก (Scratched)": 30, "พันหลวม (Loose)": 50 }
// output: { labels: [...], production: [...], setup: [...] }
window.separateSetupData = function(breakdownMap) {
    const prodMap = {};
    const setupMap = {};

    Object.entries(breakdownMap || {}).forEach(([type, val]) => {
        const parsed = window.parseSetupType(type);
        if (parsed.base.toLowerCase() === 'setup') {
            // "Setup" ที่ไม่มี sub-symptom → ไม่รวมเข้ากับอาการอื่น
            prodMap[parsed.base] = (prodMap[parsed.base] || 0) + val;
        } else if (parsed.isSetup) {
            setupMap[parsed.base] = (setupMap[parsed.base] || 0) + val;
        } else {
            prodMap[parsed.base] = (prodMap[parsed.base] || 0) + val;
        }
    });

    // รวม labels ทั้งหมด (unique)
    const allLabels = [...new Set([...Object.keys(prodMap), ...Object.keys(setupMap)])];
    // sort by total descending
    allLabels.sort((a, b) => ((prodMap[b] || 0) + (setupMap[b] || 0)) - ((prodMap[a] || 0) + (setupMap[a] || 0)));

    return {
        labels: allLabels,
        production: allLabels.map(l => prodMap[l] || 0),
        setup: allLabels.map(l => setupMap[l] || 0),
        total: allLabels.map(l => (prodMap[l] || 0) + (setupMap[l] || 0))
    };
};

window.renderFgByModel = function(data) {
    const container = document.getElementById('fgModelList');
    if(!container) return;
    const models = [
        "S1B29288-JR (10A)",
        "S1B71819-JR (16A)",
        "S1B29292-JR (20A)",
        "51207080HC-JR (25/32A)"
    ];

    // ฟังก์ชันคำนวณน้ำหนัก (Kg) จากจำนวนชิ้นตามแต่ละรุ่น
    const getKgFromPcs = (prod, pcs) => {
        if (!pcs || pcs <= 0) return 0;
        let w = 0.003; // ค่าเริ่มต้น
        if(prod.includes("10A")) w = 0.00228;
        else if(prod.includes("16A")) w = 0.00279;
        else if(prod.includes("20A")) w = 0.00357;
        else if(prod.includes("25/32A")) w = 0.005335;
        return pcs * w;
    };

    let html = '<ul class="divide-y divide-gray-100">';
    models.forEach(m => {
        // ดึงยอดชิ้นงาน FG
        const fg = (data.productData && data.productData[m]) ? data.productData[m].fg : 0;
        
        // คำนวณยอดชิ้นงานเป็นกิโลกรัม
        const fgKg = getKgFromPcs(m, fg);

        html += `
        <li class="py-3 flex flex-col gap-1">
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-800 font-bold">${m}</span>
            </div>
            <div class="flex justify-between items-center text-xs mt-1 bg-blue-50 p-2 rounded border border-blue-100">
                <span class="text-gray-700">ยอดงานดี (FG)</span>
                <div class="text-right">
                    <span class="font-bold text-blue-700 text-sm">${fg.toLocaleString()} ชิ้น</span>
                    <span class="text-gray-500 ml-2">(${fgKg.toFixed(3)} Kg)</span>
                </div>
            </div>
        </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
};

window.renderSimulator = function(data) {
    const container = document.getElementById('simulator-checkboxes');
    if (!container) return;

    const labels = data.ngLabels || [];
    const valsPcs = data.ngValuesPcs || data.ngValues || [];

    const ngItems = labels.map((l, i) => ({ label: l, pcs: valsPcs[i] || 0 })).sort((a,b)=>b.pcs-a.pcs);

    let html = '';
    ngItems.forEach((item) => {
        if(item.pcs > 0) {
            html += `
            <label class="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-200 rounded transition-colors">
                <input type="checkbox" class="sim-cb w-4 h-4 text-blue-600 rounded flex-none" value="${item.label}" data-pcs="${item.pcs}" onchange="window.updateSimulator()">
                <span class="truncate leading-tight flex-1" title="${item.label}">${item.label} (<span class="text-red-500 font-bold">${item.pcs}</span>)</span>
            </label>
            `;
        }
    });
    
    container.innerHTML = html || '<div class="text-gray-400 col-span-2 text-center py-4">ไม่มีข้อมูล NG ในรอบนี้</div>';

    window.updateSimulator();
};

window.updateSimulator = function() {
    if (!currentDashboardData) return;

    const fg = currentDashboardData.totalFg || 0;
    const originalNg = currentDashboardData.totalNgPcs !== undefined ? currentDashboardData.totalNgPcs : (currentDashboardData.totalNg || 0);

    let savedNg = 0;
    const checkboxes = document.querySelectorAll('.sim-cb:checked');
    checkboxes.forEach(cb => {
        savedNg += parseInt(cb.dataset.pcs) || 0;
    });

    const newNg = originalNg - savedNg;
    
    const totalOriginal = fg + originalNg;
    const originalYield = totalOriginal > 0 ? (fg / totalOriginal) * 100 : 0;

    const totalNew = fg + newNg;
    const newYield = totalNew > 0 ? (fg / totalNew) * 100 : 0;

    const yieldDiff = newYield - originalYield;

    document.getElementById('sim-yield').innerHTML = `${newYield.toFixed(2)}% <span class="text-sm font-medium ${yieldDiff > 0 ? 'text-green-500' : 'text-gray-400'}">(+${yieldDiff.toFixed(2)}%)</span>`;
    document.getElementById('sim-ng-saved').innerHTML = `${savedNg.toLocaleString()} ชิ้น <span class="text-gray-400 font-normal ml-1">(เหลือ NG: ${newNg.toLocaleString()})</span>`;
};

window.renderModelChart = function() {
    if (!currentDashboardData || !charts) return;
    
    const data = currentDashboardData;
    const pData = data.productData || {};
    const labels = Object.keys(pData);
    const selector = document.getElementById('modelChartSelector');
    const viewBySelector = document.getElementById('modelViewBySelector');
    const type = selector ? selector.value : 'yield';
    const viewBy = viewBySelector ? viewBySelector.value : 'model';

    const rawMatMap = {
        "S1B29288-JR (10A)": "51150220",
        "S1B71819-JR (16A)": "51150221",
        "S1B29292-JR (20A)": "51150222",
        "51207080HC-JR (25/32A)": "51150244" 
    };

    const displayLabels = labels.map(model => {
        if (viewBy === 'rawmat') {
            return rawMatMap[model] || model;
        }
        return model;
    });

    const ctxYM = document.getElementById('yieldModelChart');
    if(!ctxYM) return;
    if(charts.yieldModel) charts.yieldModel.destroy();

    const getKgFromPcs = (prod, pcs) => {
        if (!pcs || pcs <= 0) return 0;
        let w = 0.003;
        if(prod.includes("10A")) w = 0.00228;
        else if(prod.includes("16A")) w = 0.00279;
        else if(prod.includes("20A")) w = 0.00357;
        else if(prod.includes("25/32A")) w = 0.005335;
        return pcs * w;
    };

    let datasets = [];
    let scales = { y: { stacked: false } };

    if (type === 'yield') {
        datasets = [{ 
            label: '% Yield', 
            data: Object.values(pData).map(d => {
                const ngCount = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
                const t = d.fg + ngCount; 
                return t > 0 ? parseFloat(((d.fg/t)*100).toFixed(1)) : 0;
            }), 
            backgroundColor: '#10b981' 
        }];
        scales.x = { max: 100, beginAtZero: true };
    } else if (type === 'ng_rate') {
        datasets = [{ 
            label: '% NG Rate', 
            data: Object.values(pData).map(d => {
                const ngCount = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
                const t = d.fg + ngCount; 
                return t > 0 ? parseFloat(((ngCount/t)*100).toFixed(2)) : 0;
            }), 
            backgroundColor: '#f43f5e' 
        }];
        scales.x = { max: 100, beginAtZero: true, title: {display: true, text: '% NG Rate'} };
    }  else if (type === 'ng_pcs') {
        datasets = [{ 
            label: 'NG (ชิ้น)', 
            data: Object.entries(pData).map(([prod, d]) => d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0)), 
            backgroundColor: '#ef4444' 
        }];
        scales.x = { beginAtZero: true };
    } else if (type === 'ng_kg') {
        datasets = [{ 
            label: 'NG (Kg)', 
            data: Object.entries(pData).map(([prod, d]) => {
                const pcs = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
                return parseFloat(getKgFromPcs(prod, pcs).toFixed(2));
            }), 
            backgroundColor: '#f59e0b' 
        }];
        scales.x = { beginAtZero: true };
    } else if (type === 'ng_both') {
        datasets = [
            { 
                label: 'NG (ชิ้น)', 
                data: Object.entries(pData).map(([prod, d]) => d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0)), 
                backgroundColor: '#ef4444',
                xAxisID: 'x'
            },
            { 
                label: 'NG (Kg)', 
                data: Object.entries(pData).map(([prod, d]) => {
                    const pcs = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
                    return parseFloat(getKgFromPcs(prod, pcs).toFixed(2));
                }), 
                backgroundColor: '#f59e0b',
                xAxisID: 'x1'
            }
        ];
        scales.x = { position: 'bottom', beginAtZero: true, title: {display: true, text: 'จำนวน (ชิ้น)'} };
        scales.x1 = { position: 'top', beginAtZero: true, grid: { drawOnChartArea: false }, title: {display: true, text: 'น้ำหนัก (Kg)'} };
    }

    const commonOpts = { 
         responsive: true, 
         maintainAspectRatio: false,
         onClick: (e, elements, chart) => {
             if (elements && elements.length > 0 && chart.options.scales) {
                 const axisId = chart.options.indexAxis === 'y' ? 'y' : 'x';
                 const index = elements[0].index;
                 if(chart.options.scales[axisId]) {
                     chart.options.scales[axisId].min = index;
                     chart.options.scales[axisId].max = index;
                     chart.update();
                 }
             }
         },
         plugins: {
             zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } }
         }
    };

    let dlFormatter = (value) => value > 0 ? value : null;
    if (type === 'yield' || type === 'ng_rate') dlFormatter = (value) => value > 0 ? value + '%' : null; // <--- แก้บรรทัดนี้
    else if (type === 'ng_pcs') dlFormatter = (value) => value > 0 ? value + ' ชิ้น' : null;
    else if (type === 'ng_kg') dlFormatter = (value) => value > 0 ? value + ' Kg' : null;
    else if (type === 'ng_both') dlFormatter = (value, ctx) => value > 0 ? value + (ctx.datasetIndex === 0 ? ' ชิ้น' : ' Kg') : null;

    const dataLabelsPlugin = typeof window.ChartDataLabels !== 'undefined' ? window.ChartDataLabels : null;
    const activePlugins = dataLabelsPlugin ? [dataLabelsPlugin] : [];

    charts.yieldModel = new Chart(ctxYM, { 
        type: 'bar', 
        plugins: activePlugins,
        data: { labels: displayLabels, datasets: datasets }, 
        options: {
            ...commonOpts, 
            indexAxis:'y', 
            scales: scales,
            layout: { padding: { right: 40, top: type==='ng_both'? 20 : 0 } }, 
            plugins: {
                ...commonOpts.plugins,
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const idx = context[0].dataIndex;
                            const originalModel = labels[idx];
                            const displayLabel = context[0].label;
                            if (viewBy === 'rawmat') {
                                return `Raw Mat: ${displayLabel}\nModel: ${originalModel}`;
                            }
                            return displayLabel;
                        },
                        label: function(context) {
                            let unit = '%';
                            if(type === 'ng_pcs' || (type === 'ng_both' && context.datasetIndex === 0)) unit = ' ชิ้น';
                            if(type === 'ng_kg' || (type === 'ng_both' && context.datasetIndex === 1)) unit = ' Kg';
                            return `${context.dataset.label}: ${context.parsed.x}${unit}`;
                        },
                        afterLabel: function(context) {
                            const idx = context.dataIndex;
                            const productName = labels[idx]; 
                            const prData = (data.productData && data.productData[productName]) ? data.productData[productName] : null;
                            if(!prData) return [];
                            
                            const fg = prData.fg || 0;
                            const ngTotal = prData.ngTotalPcs !== undefined ? prData.ngTotalPcs : (prData.ngTotal || 0);
                            
                            let lines = [
                                `----------------------`,
                                `✅ FG: ${fg.toLocaleString()} ชิ้น`,
                                `❌ NG รวม: ${ngTotal.toLocaleString()} ชิ้น`
                            ];
                            
                            if(prData.ngBreakdownPcs && Object.keys(prData.ngBreakdownPcs).length > 0) {
                                const prSep = window.separateSetupData(prData.ngBreakdownPcs);
                                const sortedNg = prSep.labels
                                    .map((l, idx) => [l, prSep.total[idx], prSep.setup[idx]])
                                    .filter(x => x[1] > 0)
                                    .sort((a, b) => b[1] - a[1]);

                                if(sortedNg.length > 0) {
                                    lines.push(`-- รายละเอียด NG --`);
                                    sortedNg.forEach(([k, total, setup]) => {
                                        let setupNote = setup > 0 ? ` (Setup: ${setup.toLocaleString()})` : '';
                                        lines.push(`   • ${k}: ${total.toLocaleString()} ชิ้น${setupNote}`);
                                    });
                                }
                            }
                            return lines;
                        }
                    }
                },
                datalabels: {
                    display: function(ctx) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; },
                    color: (ctx) => {
                        if (type === 'yield') return '#065f46';
                        if (type === 'ng_pcs' || (type==='ng_both' && ctx.datasetIndex === 0)) return '#b91c1c';
                        return '#b45309';
                    },
                    anchor: 'end',
                    align: 'right',
                    font: { weight: 'bold' },
                    formatter: dlFormatter
                }
            }
        } 
    });
};

window.renderDailyOutputChart = function() {
    if (!currentDashboardData || !charts) return;
    const data = currentDashboardData;
    const ctxDaily = document.getElementById('dailyOutputChart');
    if (!ctxDaily) return;

    const selector = document.getElementById('dailyOutputSelector');
    const mode = selector ? selector.value : 'pcs';

    if(charts.dailyOutput) charts.dailyOutput.destroy();
    const trendData = data.dailyTrend || [];

    let fgData = [];
    let ngData = [];

    trendData.forEach(d => {
        let fg = d.fg || 0;
        let ng = d.ng || 0;
        if (mode === 'percent') {
            let total = fg + ng;
            fgData.push(total > 0 ? parseFloat(((fg/total)*100).toFixed(1)) : 0);
            ngData.push(total > 0 ? parseFloat(((ng/total)*100).toFixed(1)) : 0);
        } else {
            fgData.push(fg);
            ngData.push(ng);
        }
    });

    const commonOpts = { 
         responsive: true, 
         maintainAspectRatio: false,
         onClick: (e, elements, chart) => {
             if (elements && elements.length > 0 && chart.options.scales) {
                 const axisId = chart.options.indexAxis === 'y' ? 'y' : 'x';
                 const index = elements[0].index;
                 if(chart.options.scales[axisId]) {
                     chart.options.scales[axisId].min = index;
                     chart.options.scales[axisId].max = index;
                     chart.update();
                 }
             }
         },
         plugins: {
             zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } }
         }
    };

    const dataLabelsPlugin = typeof window.ChartDataLabels !== 'undefined' ? window.ChartDataLabels : null;
    const activePlugins = dataLabelsPlugin ? [dataLabelsPlugin] : [];

    let scales = { x: { stacked: true }, y: { stacked: true, beginAtZero: true } };
    if (mode === 'percent') {
        scales.y.max = 100;
        scales.y.title = { display: true, text: 'สัดส่วน (%)' };
    } else {
        scales.y.title = { display: true, text: 'จำนวน (ชิ้น)' };
    }

    charts.dailyOutput = new Chart(ctxDaily, { 
         type: 'bar',
         plugins: activePlugins,
         data: { 
             labels: trendData.map(d=>d.date), 
             datasets: [
                 {label:'FG (งานดี)', data:fgData, backgroundColor:'#3b82f6', borderRadius: 2},
                 {label:'NG (เสียเป็นชิ้น)', data:ngData, backgroundColor:'#ef4444', borderRadius: 2}
             ] 
         }, 
         options: { 
             ...commonOpts, 
             scales: scales,
             plugins: {
                 ...commonOpts.plugins,
                 tooltip: {
                     callbacks: {
                         label: function(context) {
                             return `${context.dataset.label}: ${context.parsed.y}${mode === 'percent' ? '%' : ' ชิ้น'}`;
                         }
                     }
                 },
                 datalabels: {
                     display: function(ctx) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; },
                     color: '#ffffff',
                     font: { weight: 'bold', size: 11 },
                     formatter: (value) => value > 0 ? value + (mode === 'percent' ? '%' : '') : null
                 }
             }
         } 
    });
};

window.renderNgTrendChart = function() {
    if (!currentDashboardData || !charts) return;
    const data = currentDashboardData;
    const ctxNgTrend = document.getElementById('ngSymptomTrendChart');
    if (!ctxNgTrend) return;

    const selector = document.getElementById('ngTrendSelector');
    const mode = selector ? selector.value : 'pcs';

    if (charts.ngSymptomTrend) charts.ngSymptomTrend.destroy();
    const trendData = data.dailyTrend || [];
    
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

    charts.ngSymptomTrend = new Chart(ctxNgTrend, {
        type: 'line',
        plugins: activePlugins,
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
                        for (const [mac, mData] of Object.entries(currentDashboardData.machineData)) {
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
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, font: {size: 10} },
                    onClick: function(e, legendItem, legend) {
                        const chart = legend.chart;
                        const ci = legendItem.datasetIndex;
                        const showAllBtn = document.getElementById('ngTrendShowAll');

                        if (e.native.ctrlKey || e.native.shiftKey || e.native.metaKey) {
                            // Ctrl/Shift/Cmd+คลิก = toggle เส้นนั้นเพิ่ม/ลด
                            const isVisible = chart.isDatasetVisible(ci);
                            chart.setDatasetVisibility(ci, !isVisible);
                            // เช็คว่ายังมีเส้นซ่อนอยู่หรือไม่
                            const anyHidden = chart.data.datasets.some((ds, i) => !chart.isDatasetVisible(i));
                            if (showAllBtn) showAllBtn.classList.toggle('hidden', !anyHidden);
                        } else {
                            // คลิกปกติ = isolate / show all
                            const allHidden = chart.data.datasets.every((ds, i) => i === ci ? false : !chart.isDatasetVisible(i));

                            if (allHidden) {
                                chart.data.datasets.forEach((ds, i) => {
                                    chart.setDatasetVisibility(i, true);
                                });
                                if (showAllBtn) showAllBtn.classList.add('hidden');
                            } else {
                                chart.data.datasets.forEach((ds, i) => {
                                    chart.setDatasetVisibility(i, i === ci);
                                });
                                if (showAllBtn) showAllBtn.classList.remove('hidden');
                            }
                        }
                        chart.update();
                    }
                },
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
                            return `${context.dataset.label}: ${context.parsed.y}${mode === 'percent' ? '%' : ' ชิ้น'}`;
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
    if (charts.ngSymptomTrend) {
        charts.ngSymptomTrend.data.datasets.forEach((ds, i) => {
            charts.ngSymptomTrend.setDatasetVisibility(i, true);
        });
        charts.ngSymptomTrend.update();
    }
    const showAllBtn = document.getElementById('ngTrendShowAll');
    if (showAllBtn) showAllBtn.classList.add('hidden');
};

window.renderCharts = function(data) {
    try {
         if(!charts) charts = {};
         
         const commonOpts = { 
             responsive: true, 
             maintainAspectRatio: false,
             onClick: (e, elements, chart) => {
                 if (elements && elements.length > 0 && chart.options.scales) {
                     const axisId = chart.options.indexAxis === 'y' ? 'y' : 'x';
                     const index = elements[0].index;
                     if(chart.options.scales[axisId]) {
                         chart.options.scales[axisId].min = index;
                         chart.options.scales[axisId].max = index;
                         chart.update();
                     }
                 }
             },
             plugins: {
                 zoom: {
                     pan: { enabled: true, mode: 'xy' },
                     zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                 }
             }
         };
         
         const dataLabelsPlugin = typeof window.ChartDataLabels !== 'undefined' ? window.ChartDataLabels : null;
         const activePlugins = dataLabelsPlugin ? [dataLabelsPlugin] : [];

         const labels = data.ngLabels || [];
         const valsPcs = data.ngValuesPcs || data.ngValues || [];
         const valsKg = data.ngValuesKg || [];

         // สร้าง raw map แล้วแยก Setup vs Production
         const rawPcsMap = {};
         labels.forEach((l, i) => { rawPcsMap[l] = (rawPcsMap[l] || 0) + (valsPcs[i] || 0); });
         const separated = window.separateSetupData(rawPcsMap);

         const totalNG = separated.total.reduce((a,b) => a+b, 0);
         let acc = 0;
         const cumulative = separated.total.map(v => { acc += v; return totalNG > 0 ? ((acc/totalNG)*100).toFixed(1) : 0; });
         const hasSetup = separated.setup.some(v => v > 0);

         const ctxP = document.getElementById('paretoChart');
         if(ctxP) {
             if(charts.pareto) charts.pareto.destroy();
             const paretoDatasets = [
                 { label: '% สะสม', data: cumulative, type: 'line', borderColor: '#8b5cf6', yAxisID: 'y1', datalabels: { display: false }, stack: false },
                 { label: hasSetup ? 'Production (ชิ้น)' : 'NG (ชิ้น)', data: separated.production, backgroundColor: '#ef4444', yAxisID: 'y', stack: 'paretoStack', datalabels: {
                    display: function(ctx) { if (!hasSetup) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; } return false; },
                    align: 'end', anchor: 'end', formatter: (v) => v > 0 ? v + ' ชิ้น' : null
                 } }
             ];
             if (hasSetup) {
                 paretoDatasets.push({
                     label: 'Setup (ชิ้น)', data: separated.setup, backgroundColor: '#fb923c', yAxisID: 'y', stack: 'paretoStack',
                     borderColor: '#ea580c', borderWidth: 1, borderDash: [3, 2],
                     datalabels: {
                         display: function(ctx) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; },
                         align: 'end', anchor: 'end',
                         formatter: (v, ctx) => {
                             const total = separated.total[ctx.dataIndex];
                             return total > 0 ? total + ' ชิ้น' : null;
                         }
                     }
                 });
             }
             charts.pareto = new Chart(ctxP, {
                 type: 'bar', plugins: activePlugins,
                 data: { labels: separated.labels, datasets: paretoDatasets },
                 options: {
                     ...commonOpts, layout: { padding: { top: 20 } },
                     scales: {
                         x: { stacked: true },
                         y: { stacked: true, beginAtZero: true, grace: '10%' },
                         y1: { beginAtZero: true, max: 105, position: 'right', grid: { display: false } }
                     },
                     plugins: {
                         ...commonOpts.plugins,
                         tooltip: {
                             callbacks: {
                                 afterBody: function(context) {
                                     if (!hasSetup) return '';
                                     const idx = context[0].dataIndex;
                                     const prod = separated.production[idx] || 0;
                                     const setup = separated.setup[idx] || 0;
                                     const total = prod + setup;
                                     if (total <= 0) return '';
                                     return `รวม: ${total} ชิ้น (Production: ${prod}, Setup: ${setup})`;
                                 }
                             }
                         }
                     }
                 }
             });
         }
         
         const ctxNgMac = document.getElementById('ngByMachineChart');
         if(ctxNgMac) {
             if(charts.ngMachine) charts.ngMachine.destroy();

             // ใช้ merged labels จาก Pareto (Setup รวมเข้ากับอาการหลัก)
             const sortedNgLabels = separated.labels.filter((l, i) => separated.total[i] > 0);

             const macColors = [
                 '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
                 '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
             ];
             let macDatasets = [];
             let colorIdx = 0;

             const allMacs = Object.keys(data.machineData || {}).sort();

             allMacs.forEach(m => {
                 const mData = data.machineData[m];
                 if (!mData.ngBreakdownPcs) return;
                 // แยก Setup ของเครื่องนี้
                 const macSep = window.separateSetupData(mData.ngBreakdownPcs);
                 let hasNg = false;

                 // Production layer
                 const prodData = sortedNgLabels.map(ngLabel => {
                     const idx = macSep.labels.indexOf(ngLabel);
                     const val = idx >= 0 ? macSep.production[idx] : 0;
                     if (val > 0) hasNg = true;
                     return val;
                 });

                 // Setup layer
                 const setupData = sortedNgLabels.map(ngLabel => {
                     const idx = macSep.labels.indexOf(ngLabel);
                     return idx >= 0 ? macSep.setup[idx] : 0;
                 });
                 const hasSetupForMac = setupData.some(v => v > 0);
                 if (hasSetupForMac) hasNg = true;

                 if (hasNg) {
                     const color = macColors[colorIdx % macColors.length];
                     macDatasets.push({
                         label: m,
                         data: prodData,
                         backgroundColor: color,
                         stack: 'StackProd'
                     });
                     if (hasSetupForMac) {
                         // Setup ใช้สีเดียวกันแต่จางลง + ลายเส้น
                         macDatasets.push({
                             label: m + ' (Setup)',
                             data: setupData,
                             backgroundColor: color + '80', // 50% opacity
                             borderColor: color,
                             borderWidth: 1,
                             borderDash: [4, 2],
                             stack: 'StackSetup'
                         });
                     }
                     colorIdx++;
                 }
             });

             charts.ngMachine = new Chart(ctxNgMac, {
                 type: 'bar',
                 data: {
                     labels: sortedNgLabels,
                     datasets: macDatasets
                 },
                 options: {
                     ...commonOpts,
                     scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                     plugins: {
                         ...commonOpts.plugins,
                         legend: {
                             display: window.innerWidth > 768,
                             position: 'right',
                             labels: {
                                 boxWidth: 12, font: { size: 10 },
                                 filter: function(item) {
                                     // ซ่อน "(Setup)" จาก legend ถ้าไม่จำเป็น
                                     return !item.text.includes('(Setup)');
                                 }
                             }
                         },
                         tooltip: {
                             mode: 'index',
                             intersect: false,
                             itemSort: function(a, b) { return b.raw - a.raw; },
                             filter: function(tooltipItem) { return tooltipItem.raw > 0; },
                             callbacks: {
                                 title: function(context) { return `อาการ: ${context[0].label}`; }
                             }
                         },
                         datalabels: {
                             display: function(ctx) {
                                 const c = ctx.chart.canvas.closest('.widget-card');
                                 const isMax = c ? c.classList.contains('maximized-card') : false;
                                 return ctx.dataset.data[ctx.dataIndex] > 0 && isMax;
                             },
                             color: '#ffffff',
                             font: { weight: 'bold', size: 11 },
                             formatter: (value, ctx) => { return `${ctx.dataset.label}: ${value}`; }
                         }
                     }
                 }
             });
         }

         window.renderDailyOutputChart();

         const hNgPcs = data.hourlyNgPcsData || data.hourlyNgData || []; 
         const ctxH = document.getElementById('hourlyChart');
         if(ctxH) {
             if(charts.hourly) charts.hourly.destroy();
             
             const cleanHourlyLabels = (data.hourlyLabels || []).map(label => {
                 const parts = label.split('-');
                 if (parts.length > 1) {
                     const match = parts[1].match(/(\d{2}):/);
                     return match ? match[1] + ":00" : label;
                 }
                 const fallbackMatch = label.match(/(\d{2}):/);
                 return fallbackMatch ? fallbackMatch[1] + ":00" : label;
             });

             let hourlyDatasets = [];
             
             if (data.hourlyByModel && Object.keys(data.hourlyByModel).length > 0) {
                 const fgColors = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a']; 
                 const ngColors = ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d'];
                 
                 let cIdx = 0;
                 for (const [model, d] of Object.entries(data.hourlyByModel)) {
                     hourlyDatasets.push({
                         label: `FG - ${model}`,
                         data: d.fg,
                         backgroundColor: fgColors[cIdx % fgColors.length],
                         stack: 'Stack 0',
                         borderWidth: 1,
                         borderColor: 'rgba(255,255,255,0.2)'
                     });
                     cIdx++;
                 }
                 
                 cIdx = 0;
                 for (const [model, d] of Object.entries(data.hourlyByModel)) {
                     hourlyDatasets.push({
                         label: `NG - ${model}`,
                         data: d.ng,
                         backgroundColor: ngColors[cIdx % ngColors.length],
                         stack: 'Stack 0',
                         borderWidth: 1,
                         borderColor: 'rgba(255,255,255,0.2)'
                     });
                     cIdx++;
                 }
             } else {
                 hourlyDatasets = [
                     {label:'FG (รวม)', data:data.hourlyData || [], backgroundColor:'#3b82f6', stack: 'Stack 0'}, 
                     {label:'NG (เสียเป็นชิ้น)', data:hNgPcs, backgroundColor:'#ef4444', stack: 'Stack 0'}
                 ];
             }

             charts.hourly = new Chart(ctxH, { 
                 type: 'bar', 
                 data: { 
                     labels: cleanHourlyLabels, 
                     datasets: hourlyDatasets
                 }, 
                 options: {
                     ...commonOpts, 
                     scales:{x:{stacked:true}, y:{stacked:true}},
                     plugins: {
                         ...commonOpts.plugins,
                         legend: { display: false }, 
                         tooltip: {
                             mode: 'index',
                             intersect: false,
                             filter: function(tooltipItem) {
                                 return tooltipItem.raw > 0;
                             }
                         },
                         datalabels: {
                             display: function(ctx) { 
                                 const c = ctx.chart.canvas.closest('.widget-card'); 
                                 const isMax = c ? c.classList.contains('maximized-card') : true; 
                                 return isMax && ctx.dataset.data[ctx.dataIndex] > 0; 
                             },
                             color: '#ffffff',
                             font: { weight: 'bold', size: 10 },
                             formatter: (value) => value > 0 ? value : null
                         }
                     }
                 },
                 plugins: [
                     ...(activePlugins || []),
                     {
                         id: 'customHtmlLegend',
                         afterUpdate: function(chart) {
                             const container = document.getElementById('hourly-legend-ul');
                             if (!container) return;
                             container.innerHTML = ''; 
                             
                             const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                             
                             const half = Math.ceil(items.length / 2);
                             let interleaved = [];
                             for(let i = 0; i < half; i++) {
                                 interleaved.push(items[i]);                 
                                 if(items[i+half]) interleaved.push(items[i+half]); 
                             }
                             
                             interleaved.forEach(item => {
                                 const li = document.createElement('li');
                                 li.className = `flex items-center cursor-pointer text-[10px] md:text-xs ${item.hidden ? 'line-through text-gray-300' : 'text-gray-700'} hover:text-blue-600 transition-colors`;
                                 
                                 li.onclick = () => {
                                     const isHidden = chart.isDatasetVisible(item.datasetIndex);
                                     chart.setDatasetVisibility(item.datasetIndex, !isHidden);
                                     chart.update();
                                 };
                                 
                                 const box = document.createElement('span');
                                 box.className = 'w-3 h-3 md:w-4 md:h-4 inline-block mr-1.5 flex-none rounded-sm shadow-sm';
                                 box.style.backgroundColor = item.fillStyle;
                                 box.style.border = item.lineWidth > 0 ? `${item.lineWidth}px solid ${item.strokeStyle}` : '1px solid rgba(0,0,0,0.1)';
                                 
                                 const text = document.createElement('span');
                                 text.className = 'truncate leading-none';
                                 text.title = item.text; 
                                 text.innerText = item.text;
                                 
                                 li.appendChild(box);
                                 li.appendChild(text);
                                 container.appendChild(li);
                             });
                         }
                     }
                 ]
             });
         }

         const ctxYieldM = document.getElementById('yieldMachineChart');
         if(ctxYieldM) {
            if(charts.yieldMachine) charts.yieldMachine.destroy();
            const macs = []; for(let i=1;i<=16;i++) macs.push(`CWM-${String(i).padStart(2,'0')}`);
            charts.yieldMachine = new Chart(ctxYieldM, { 
                type: 'bar', 
                data: { 
                    labels: macs, 
                    datasets: [{ 
                        label: '% Yield', 
                        data: macs.map(m=>{
                            const d = (data.machineData && data.machineData[m]) ? data.machineData[m] : null; 
                            if(!d) return 0; 
                            const ngCount = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
                            const t = d.fg + ngCount; 
                            return t > 0 ? ((d.fg/t)*100).toFixed(1) : 0;
                        }), 
                        backgroundColor: '#6366f1' 
                    }] 
                }, 
                options: {
                    ...commonOpts, 
                    scales:{y:{max:100}},
                    layout: { padding: { top: 40 } }, 
                    plugins: {
                        ...commonOpts.plugins,
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Yield: ${context.parsed.y}%`;
                                },
                                afterLabel: function(context) {
                                    const machineName = context.label;
                                    const mData = (data.machineData && data.machineData[machineName]) ? data.machineData[machineName] : null;
                                    if(!mData) return [];
                                    
                                    const fg = mData.fg || 0;
                                    const ngTotal = mData.ngTotalPcs !== undefined ? mData.ngTotalPcs : (mData.ngTotal || 0);
                                    
                                    let lines = [
                                        `----------------------`,
                                        `✅ FG: ${fg.toLocaleString()} ชิ้น`,
                                        `❌ NG รวม: ${ngTotal.toLocaleString()} ชิ้น`
                                    ];
                                    
                                    if(mData.ngBreakdownPcs && Object.keys(mData.ngBreakdownPcs).length > 0) {
                                        const mdSep = window.separateSetupData(mData.ngBreakdownPcs);
                                        const sortedNg = mdSep.labels
                                            .map((l, idx) => [l, mdSep.total[idx], mdSep.setup[idx]])
                                            .filter(x => x[1] > 0)
                                            .sort((a, b) => b[1] - a[1]);

                                        if(sortedNg.length > 0) {
                                            lines.push(`-- รายละเอียด NG --`);
                                            sortedNg.forEach(([k, total, setup]) => {
                                                let sn = setup > 0 ? ` (Setup: ${setup.toLocaleString()})` : '';
                                                lines.push(`   • ${k}: ${total.toLocaleString()} ชิ้น${sn}`);
                                            });
                                        }
                                    }
                                    return lines;
                                }
                            }
                        },
                        datalabels: {
                            display: function(ctx) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; },
                            color: '#4338ca', 
                            anchor: 'end',    
                            align: 'top',     
                            font: { weight: 'bold' },
                            formatter: (value) => value > 0 ? value + '%' : null
                        }
                    }
                } 
            });
         }

const ctxQC = document.getElementById('qcTrendChart');
         if(ctxQC) {
            if(charts.qcTrend) charts.qcTrend.destroy();
            
            // 🌟 อ่านค่า Model ที่ต้องการกรอง
            const qcSelector = document.getElementById('qcModelSelector');
            const selectedModel = qcSelector ? qcSelector.value : 'all';

            const trendData = data.dailyTrend || [];
            
            const getKgFromPcs = (prod, pcs) => {
                if (!pcs || pcs <= 0) return 0;
                let w = 0.003; 
                if(prod && prod.includes("10A")) w = 0.00228;
                else if(prod && prod.includes("16A")) w = 0.00279;
                else if(prod && prod.includes("20A")) w = 0.00357;
                else if(prod && prod.includes("25/32A")) w = 0.005335;
                return pcs * w;
            };

            let displayTrendData = trendData.map(originalDay => {
                const dateStr = originalDay.date;
                
                let mFgKg = 0; let mNgKg = 0; let mPendingKg = 0;
                let mFgPcs = 0; let mNgPcs = 0; let mPendingPcs = 0; 
                let modelNgBreakdownKg = {};
                let modelSortFgPcs = 0; let modelSortNgPcs = 0;

                Object.entries(data.machineData || {}).forEach(([mac, mData]) => {
                    let assignedModel = '';
                    if (typeof machineMapping !== 'undefined' && machineMapping[mac]) {
                        assignedModel = machineMapping[mac];
                    } else if (typeof globalMachineMapping !== 'undefined' && globalMachineMapping[mac]) {
                        assignedModel = globalMachineMapping[mac];
                    } else if (data.machineMapping && data.machineMapping[mac]) {
                        assignedModel = data.machineMapping[mac];
                    }

                    if (selectedModel === 'all' || assignedModel === selectedModel || assignedModel.includes(selectedModel)) {
                        if (mData.daily && mData.daily[dateStr]) {
                            const dailyFgPcs = mData.daily[dateStr].fg || 0;
                            const dailyNgPcs = mData.daily[dateStr].ngPcs !== undefined ? mData.daily[dateStr].ngPcs : (mData.daily[dateStr].ng || 0);
                            
                            mFgPcs += dailyFgPcs;
                            mNgPcs += dailyNgPcs;
                            
                            mFgKg += getKgFromPcs(assignedModel, dailyFgPcs);
                            mNgKg += getKgFromPcs(assignedModel, dailyNgPcs);

                            if (mData.daily[dateStr].ngBreakdown) {
                                for (const [symp, pcs] of Object.entries(mData.daily[dateStr].ngBreakdown)) {
                                    const sympKg = getKgFromPcs(assignedModel, pcs);
                                    modelNgBreakdownKg[symp] = (modelNgBreakdownKg[symp] || 0) + sympKg;
                                }
                            }
                        }
                        if (mData.sortData && mData.sortData[dateStr]) {
                            const pendingPcs = mData.sortData[dateStr].pendingPcs || 0;
                            mPendingPcs += pendingPcs;
                            mPendingKg += getKgFromPcs(assignedModel, pendingPcs);
                            
                            modelSortFgPcs += mData.sortData[dateStr].fgPcs || 0;
                            modelSortNgPcs += mData.sortData[dateStr].ngPcs || 0;
                        }
                    }
                });

                const totalKg = mFgKg + mNgKg;
                const ngRate = totalKg > 0 ? (mNgKg / totalKg) * 100 : 0;
                let worstNgRate = null; let bestNgRate = null; let forecastNgRate = null;
                let projectedNgKg = 0; 

                if (mPendingKg > 0 && totalKg > 0) {
                    const projTotalKg = totalKg + mPendingKg;
                    worstNgRate = ((mNgKg + mPendingKg) / projTotalKg) * 100;
                    bestNgRate = (mNgKg / projTotalKg) * 100;
                    
                    const dynamicWeights = data.dynamicSymptomWeights || {};
                    let totalWeightedNgRatio = 0;
                    
                    if (Object.keys(modelNgBreakdownKg).length > 0 && mNgKg > 0) {
                        for (const [symp, sympKg] of Object.entries(modelNgBreakdownKg)) {
                            const fgRate = dynamicWeights[symp] !== undefined ? dynamicWeights[symp] : (1 - ((data.globalSortNgRatio || 50)/100));
                            totalWeightedNgRatio += ((sympKg / mNgKg) * (1 - fgRate));
                        }
                        projectedNgKg = mPendingKg * totalWeightedNgRatio;
                        forecastNgRate = ((mNgKg + projectedNgKg) / projTotalKg) * 100;
                    } else {
                        let avgNgRatio = (data.globalSortNgRatio || 50) / 100;
                        if ((modelSortFgPcs + modelSortNgPcs) > 0) avgNgRatio = modelSortNgPcs / (modelSortFgPcs + modelSortNgPcs);
                        projectedNgKg = mPendingKg * avgNgRatio;
                        forecastNgRate = ((mNgKg + projectedNgKg) / projTotalKg) * 100;
                    }
                }

                return { 
                    date: dateStr, 
                    fgKg: mFgKg, ngKg: mNgKg, pendingSortQty: mPendingPcs, 
                    pendingKg: mPendingKg, projectedNgKg: projectedNgKg,
                    ngRate: ngRate, worstNgRate: worstNgRate, bestNgRate: bestNgRate, forecastNgRate: forecastNgRate 
                };
            });

            const hasPendingSort = displayTrendData.some(d => d.pendingSortQty > 0);
            
            // 🌟 1. ดึงยอดรวม (Kg) ทั้งหมดเพื่อสร้าง True Average ของแต่ละ Case 🌟
            let sumTotalProdKg = 0;
            let sumTotalNgKg = 0;
            let sumTotalPendingKg = 0;
            let sumTotalProjectedNgKg = 0;

            displayTrendData.forEach(d => {
                sumTotalProdKg += (d.fgKg + d.ngKg);
                sumTotalNgKg += d.ngKg;
                sumTotalPendingKg += (d.pendingKg || 0);
                sumTotalProjectedNgKg += (d.projectedNgKg || 0);
            });

            const avgNgRate = sumTotalProdKg > 0 ? (sumTotalNgKg / sumTotalProdKg) * 100 : 0;
            
            let avgWorstNgRate = null; let avgBestNgRate = null; let avgForecastNgRate = null;

            if (sumTotalPendingKg > 0) {
                const totalProjProdKg = sumTotalProdKg + sumTotalPendingKg;
                avgWorstNgRate = ((sumTotalNgKg + sumTotalPendingKg) / totalProjProdKg) * 100;
                avgBestNgRate = (sumTotalNgKg / totalProjProdKg) * 100;
                avgForecastNgRate = ((sumTotalNgKg + sumTotalProjectedNgKg) / totalProjProdKg) * 100;
            }

            // 🌟 2. เพิ่มเส้น Average เข้าไปใน Datasets 🌟
            const datasets = [
                {label:'% NG Rate (ถ่วงน้ำหนัก Kg)', data:displayTrendData.map(d=> Math.min(d.ngRate, 100)), borderColor:'#f97316', borderWidth: 2, pointRadius: 3},
                {label: `Avg NG (${avgNgRate.toFixed(2)}%)`, data: displayTrendData.map(() => parseFloat(avgNgRate.toFixed(2))), borderColor: '#6b7280', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0}
            ];

            if (hasPendingSort) {
                // เส้น Worst Case + Avg Worst
                datasets.push({label:'NG 100% (Worst)', data: displayTrendData.map(d => d.worstNgRate != null ? Math.min(d.worstNgRate, 100) : null), borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderWidth: 2, borderDash: [6, 4], pointRadius: 2, fill: false, spanGaps: false});
                if (avgWorstNgRate !== null) {
                    datasets.push({label: `Avg Worst (${avgWorstNgRate.toFixed(2)}%)`, data: displayTrendData.map(() => parseFloat(avgWorstNgRate.toFixed(2))), borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false, tension: 0});
                }

                // เส้น Best Case + Avg Best
                datasets.push({label:'FG 100% (Best)', data: displayTrendData.map(d => d.bestNgRate != null ? Math.min(d.bestNgRate, 100) : null), borderColor: 'rgba(34, 197, 94, 0.35)', backgroundColor: 'rgba(34, 197, 94, 0.05)', borderWidth: 2, borderDash: [6, 4], pointRadius: 2, fill: false, spanGaps: false});
                if (avgBestNgRate !== null) {
                    datasets.push({label: `Avg Best (${avgBestNgRate.toFixed(2)}%)`, data: displayTrendData.map(() => parseFloat(avgBestNgRate.toFixed(2))), borderColor: 'rgba(34, 197, 94, 0.4)', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false, tension: 0});
                }

                // เส้น Forecast + Avg Forecast
                datasets.push({label:'📊 Forecast', data: displayTrendData.map(d => d.forecastNgRate != null ? Math.min(d.forecastNgRate, 100) : null), borderColor: 'rgba(139, 92, 246, 0.8)', borderWidth: 2.5, borderDash: [8, 3], pointRadius: 3, pointStyle: 'triangle', fill: false, spanGaps: false});
                if (avgForecastNgRate !== null) {
                    datasets.push({label: `Avg Forecast (${avgForecastNgRate.toFixed(2)}%)`, data: displayTrendData.map(() => parseFloat(avgForecastNgRate.toFixed(2))), borderColor: 'rgba(139, 92, 246, 0.6)', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0});
                }
            }

            // 🌟 3. สร้างกราฟ Chart.js 🌟
            charts.qcTrend = new Chart(ctxQC, {
                type: 'line',
                data: {
                    labels: displayTrendData.map(d=>d.date),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { offset: true },
                        y: {
                            type: 'logarithmic',
                            min: 0.1,
                            max: 100,
                            ticks: { callback: v => v + '%', autoSkip: true, maxTicksLimit: 10 }
                        }
                    },
                    layout: { padding: { top: 20 } },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                afterBody: function(tooltipItems) {
                                    const idx = tooltipItems[0].dataIndex;
                                    const d = displayTrendData[idx];
                                    if (d && d.pendingSortQty > 0) return `รองาน Sort: ${d.pendingSortQty.toLocaleString()} ชิ้น`;
                                    return '';
                                }
                            }
                        },
                        datalabels: {
                            display: function(ctx) {
                                if (ctx.datasetIndex !== 0) return false;
                                const c = ctx.chart.canvas.closest('.widget-card');
                                return c ? c.classList.contains('maximized-card') : true;
                            },
                            color: '#c2410c', align: 'top', anchor: 'end', font: { weight: 'bold' },
                            formatter: (value) => value > 0 ? value.toFixed(1) + '%' : null
                        }
                    }
                }
            });
         }

         window.renderNgTrendChart();

         const ctxNG = document.getElementById('ngChart');
         if(ctxNG) {
            if(charts.ng) charts.ng.destroy();

            // ใช้ separated data (Setup รวมเข้ากับอาการหลัก)
            const ngItemsMerged = separated.labels.map((l, i) => ({ label: l, pcs: separated.total[i] || 0 }));
            const sortedLabels = ngItemsMerged.filter(item => item.pcs > 0).map(item => item.label);
            const sortedData = ngItemsMerged.filter(item => item.pcs > 0).map(item => item.pcs);
            const totalNGPcs = sortedData.reduce((a, b) => a + b, 0);
            
            charts.ng = new Chart(ctxNG, { 
                type: 'doughnut',
                plugins: activePlugins,
                data: { 
                    labels: sortedLabels, 
                    datasets: [{ 
                        data: sortedData, 
                        backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'],
                        borderWidth: 0
                    }] 
                }, 
                options: {
                    ...commonOpts,
                    scales: { 
                        x: { display: false }, 
                        y: { display: false } 
                    },
                    plugins: {
                        ...commonOpts.plugins,
                        datalabels: {
                            display: function(ctx) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; },
                            color: '#ffffff',
                            font: { weight: 'bold', size: 12 },
                            formatter: (value) => {
                                if (totalNGPcs === 0 || value === 0) return null;
                                return ((value / totalNGPcs) * 100).toFixed(1) + '%';
                            }
                        }
                    }
                } 
            });
         }
         
         window.renderModelChart();

    } catch (err) {
         const debugOut = document.getElementById('debug-output');
         if (debugOut) {
             document.getElementById('debug-panel').classList.remove('hidden');
             debugOut.innerText += `\n[Chart Rendering Error] ${err.message}`;
         }
         console.error(err);
    }
};

window.renderTable = function(data) {
    // รวม Setup เข้ากับอาการหลักสำหรับ column headers
    let rawColumns = normalizeSymptomList(ngSymptoms);
    if (data.machineData) {
        for (let m in data.machineData) {
            const d = data.machineData[m];
            if (d.ngBreakdownPcs) {
                Object.keys(d.ngBreakdownPcs).forEach(k => {
                    const parsed = window.parseSetupType(k);
                    const stdK = capitalizeFirst(parsed.base);
                    if (!rawColumns.some(s => s.toLowerCase() === stdK.toLowerCase())) {
                        rawColumns.push(stdK);
                    }
                });
            }
        }
    }

    // ลบ "Setup" ออกจาก column ถ้ามี (เพราะรวมเข้ากับอาการหลักแล้ว)
    let dynamicColumns = [...new Set(rawColumns.map(s => capitalizeFirst(s)))];
    dynamicColumns = dynamicColumns.filter(s => s.toLowerCase() !== 'setup');

    const h = document.getElementById('table-header');
    const b = document.getElementById('table-body');
    
    // 1. แก้ไขหัวตารางให้แสดง (ชิ้น/Kg)
    h.innerHTML = '<th>Machine</th><th>FG (ชิ้น/Kg)</th><th>NG (ชิ้น/Kg)</th><th>% Yield</th>' + dynamicColumns.map(s=>`<th>${s}</th>`).join('');
    b.innerHTML = '';

    // 2. เพิ่มฟังก์ชันคำนวณ Kg สำหรับแปลงยอด FG 
    const getKgFromPcs = (prod, pcs) => {
        if (!pcs || pcs <= 0) return 0;
        let w = 0.003;
        if(prod && prod.includes("10A")) w = 0.00228;
        else if(prod && prod.includes("16A")) w = 0.00279;
        else if(prod && prod.includes("20A")) w = 0.00357;
        else if(prod && prod.includes("25/32A")) w = 0.005335;
        return pcs * w;
    };

    for(let i=1; i<=16; i++) {
        const m = `CWM-${String(i).padStart(2,'0')}`;
        const d = (data.machineData && data.machineData[m]) ? data.machineData[m] : {fg:0, ngTotal:0, ngTotalKg:0, ngTotalPcs:0, ngBreakdownKg:{}, ngBreakdownPcs:{}};

        const ngPcs = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
        const ngKg = d.ngTotalKg || 0;

        const t = d.fg + ngPcs;
        const y = t > 0 ? ((d.fg/t)*100).toFixed(1) : "0.0";

        const productAssigned = machineMapping[m] || 'ไม่ได้ระบุรุ่น';

        // แยก Setup data สำหรับเครื่องนี้
        const macSep = window.separateSetupData(d.ngBreakdownPcs || {});
        const macSepKg = window.separateSetupData(d.ngBreakdownKg || {});

        // คำนวณ FG Kg
        const fgKg = getKgFromPcs(productAssigned, d.fg);

        let html = `<td class="p-4 border-b font-bold cursor-pointer text-blue-600 hover:underline" onclick="window.showMachineDetail('${m}')">
                <div class="flex flex-col">
                    <span>👉 ${m}</span>
                    <span class="text-[10px] text-gray-500 font-normal mt-0.5">📦 ${productAssigned}</span>
                </div>
            </td>
            <td class="p-4 border-b font-bold text-gray-800">${d.fg} <br><span class="text-[10px] text-gray-500 font-normal">(${fgKg.toFixed(2)} Kg)</span></td>
            <td class="p-4 border-b text-red-600 font-bold">${ngPcs} <br><span class="text-[10px] text-gray-500 font-normal">(${ngKg.toFixed(2)} Kg)</span></td>
            <td class="p-4 border-b">${y}%</td>`;

        dynamicColumns.forEach(s => {
            const idx = macSep.labels.findIndex(l => l.toLowerCase() === s.toLowerCase());
            const idxKg = macSepKg.labels.findIndex(l => l.toLowerCase() === s.toLowerCase());

            const totalPcs = idx >= 0 ? macSep.total[idx] : 0;
            const totalKg = idxKg >= 0 ? macSepKg.total[idxKg] : 0;
            const setupPcs = idx >= 0 ? macSep.setup[idx] : 0;
            const prodPcs = idx >= 0 ? macSep.production[idx] : 0;

            let cellContent = '-';
            if (totalPcs > 0) {
                cellContent = totalPcs + '<br><span class="text-[10px] text-gray-500 font-normal">(' + totalKg.toFixed(2) + ' Kg)</span>';
                if (setupPcs > 0) {
                    cellContent += `<br><span class="text-[9px] text-orange-600 font-medium">Setup: ${setupPcs}</span>`;
                }
            }
            html += `<td class="${totalPcs>0?'bg-red-50 text-red-700 font-bold':''}">${cellContent}</td>`;
        });
        b.innerHTML += `<tr>${html}</tr>`;
    }
};

window.switchMachineChart = function() {
    const val = document.getElementById('machineChartToggle').value;
    const hint = document.getElementById('daily-chart-hint');
    
    if(val === 'hourly') {
        document.getElementById('machine-hourly-wrapper').classList.remove('hidden');
        document.getElementById('machine-daily-wrapper').classList.add('hidden');
        if(hint) hint.classList.add('hidden');
        
        // ใช้ setTimeout หน่วงเวลา 100ms เพื่อให้ CSS แสดงผลเสร็จก่อนค่อย resize กราฟ
        setTimeout(() => {
            if (typeof machineDetailChart !== 'undefined' && machineDetailChart) {
                machineDetailChart.resize();
                machineDetailChart.update();
            }
        }, 100);
        
    } else {
        document.getElementById('machine-hourly-wrapper').classList.add('hidden');
        document.getElementById('machine-daily-wrapper').classList.remove('hidden');
        if(hint) hint.classList.remove('hidden');
        
        setTimeout(() => {
            if (typeof machineDailyChartInst !== 'undefined' && machineDailyChartInst) {
                machineDailyChartInst.resize();
                machineDailyChartInst.update();
            }
        }, 100);
    }
};

window.showMachineDetail = function(machineName) {
    if(!currentDashboardData) return;
    window.currentSelectedMachine = machineName; 
    const modal = document.getElementById('modal-machine-detail');
    const mData = currentDashboardData.machineData[machineName] || { fg: 0, ngTotal: 0, ngTotalKg: 0, ngTotalPcs: 0, hourlyFg: [], hourlyNgPcs: [], hourlyNg: [], hourlyNgKg: [], remarks: [], daily: {}, maintenanceLogs: [] };

    const ngPcs = mData.ngTotalPcs !== undefined ? mData.ngTotalPcs : (mData.ngTotal || 0);
    const ngKg = mData.ngTotalKg || 0;

    document.getElementById('machine-detail-title').innerText = `📊 รายละเอียดเครื่อง ${machineName}`;
    document.getElementById('machine-detail-stats').innerHTML = `<div class="bg-blue-50 p-2 rounded">FG รวม: <b class="text-blue-700 text-xl">${mData.fg}</b></div><div class="bg-red-50 p-2 rounded">NG รวม: <b class="text-red-700 text-xl">${ngPcs} ชิ้น</b><br><span class="text-xs text-gray-500">(${ngKg.toFixed(2)} Kg)</span></div>`;

    const rList = document.getElementById('machine-remarks-list'); 
    const rSec = document.getElementById('machine-detail-remarks');
    if(mData.remarks && mData.remarks.length > 0) { 
        rSec.classList.remove('hidden'); 
        rList.innerHTML = `<ul class="list-disc pl-5 space-y-1">${mData.remarks.map(r => `<li>${r}</li>`).join('')}</ul>`; 
    } else { 
        rSec.classList.add('hidden'); 
    }

    // --- ส่วนที่ดึงข้อมูลแจ้งซ่อม (Maintenance) มาแสดงผล ---
    const maintListContainer = document.getElementById('machine-maintenance-list');
    const downtimeText = document.getElementById('md-total-downtime');
    
    let totalDowntimeMins = 0;
    let maintHtml = '';

    const extractTime = (timeVal) => {
        if (!timeVal) return '-';
        let str = String(timeVal).trim();
        
        // 1. ดักจับรูปแบบที่มี AM / PM โดยเฉพาะ (ไม่ว่าจะมีวินาทีต่อท้ายหรือไม่ เช่น "2:30 PM", "02:30:00 PM")
        const ampmRegex = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i;
        const ampmMatch = str.match(ampmRegex);
        if (ampmMatch) {
            let h = parseInt(ampmMatch[1], 10);
            let m = ampmMatch[2];
            let ampm = ampmMatch[3].toUpperCase();

            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;

            return `${h.toString().padStart(2, '0')}:${m}`;
        }

        // 2. ดักจับ ISO Date String ที่ Google Sheets ชอบสร้าง (เช่น "1899-12-30T07:30:00.000Z")
        if (str.includes('T') || str.length > 10) {
            try {
                const d = new Date(str);
                if (!isNaN(d.getTime())) {
                    let h = d.getHours().toString().padStart(2, '0');
                    let m = d.getMinutes().toString().padStart(2, '0');
                    return `${h}:${m}`;
                }
            } catch(e) { console.warn("Time parse error", e); }
        }

        // 3. ดักจับข้อความที่เป็นเวลาทั่วไป HH:MM หรือ HH:MM:SS
        const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }
        
        return str.substring(0, 5);
    };

    // --- ส่วนจัดการ กรองวันที่ (Filter) และ เรียงลำดับ (Sort) ---
    let processedLogs = [...(mData.maintenanceLogs || [])];

    // 1. กรองข้อมูลให้อยู่ในช่วงวันที่เลือกบน Dashboard
    const dashStartDate = document.getElementById('start-date')?.value;
    const dashEndDate = document.getElementById('end-date')?.value;
    
    if (dashStartDate && dashEndDate) {
        processedLogs = processedLogs.filter(log => {
            if (!log.date) return true; 
            return log.date >= dashStartDate && log.date <= dashEndDate;
        });
    }

    // 2. เรียงลำดับรายการ (รายการใหม่ล่าสุดอยู่บนสุด)
    processedLogs.sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare; 
        
        const timeA = extractTime(a.startTime) || '00:00';
        const timeB = extractTime(b.startTime) || '00:00';
        return timeB.localeCompare(timeA);
    });

    if (processedLogs.length > 0) {
        processedLogs.forEach(log => {
            let durationStr = 'ยังไม่ระบุเวลาเสร็จสิ้น';
            let mins = 0;
            
            let sTime = extractTime(log.startTime) || '-';
            let eTime = extractTime(log.endTime) || '-';
            
            if (sTime !== '-' && eTime !== '-') {
                try {
                    let s = sTime.split(':');
                    let e = eTime.split(':');
                    let sMins = parseInt(s[0]) * 60 + parseInt(s[1]);
                    let eMins = parseInt(e[0]) * 60 + parseInt(e[1]);
                    mins = eMins - sMins;
                    
                    if (mins < 0) mins += 1440;
                    totalDowntimeMins += mins;

                    let h = Math.floor(mins / 60);
                    let m = mins % 60;
                    durationStr = h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
                } catch(err) { console.log("Time calc error:", err); }
            }

            // --- ส่วนสร้าง Thumbnail โดยสกัด File ID ---
            let imgBtn = '';
            if (log.imageUrl) {
                let fileId = '';
                const matchD = log.imageUrl.match(/\/d\/(.+?)\//);
                const matchId = log.imageUrl.match(/id=([^&]+)/);
                if (matchD && matchD[1]) {
                    fileId = matchD[1];
                } else if (matchId && matchId[1]) {
                    fileId = matchId[1];
                }

                if (fileId) {
                    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                    const fallbackThumb = `https://lh3.googleusercontent.com/d/${fileId}`;
                    
                    imgBtn = `
                        <div class="mt-3 border border-gray-200 rounded overflow-hidden cursor-pointer relative group" onclick="window.viewMaintImage('${fallbackThumb}', '${log.issueType}')" title="คลิกเพื่อดูรูปใหญ่">
                            <div class="h-32 w-full bg-gray-100 flex items-center justify-center">
                                <img src="${thumbUrl}" onerror="this.onerror=null; this.src='${fallbackThumb}'; this.onerror=function(){ this.style.display='none'; this.nextElementSibling.style.display='flex'; };" class="w-full h-full object-cover" alt="Maintenance Image" loading="lazy">
                                <div class="hidden flex-col items-center justify-center text-gray-500 text-xs w-full h-full">
                                    <span class="text-2xl mb-1">📸</span>
                                    <span>คลิกเพื่อดูรูปภาพ</span>
                                </div>
                            </div>
                            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center pointer-events-none">
                                <span class="bg-black bg-opacity-70 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">🔍 ขยายรูปภาพ</span>
                            </div>
                        </div>
                    `;
                } else {
                    imgBtn = `<button onclick="window.open('${log.imageUrl}', '_blank')" class="mt-2 text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded border border-orange-200 hover:bg-orange-100 font-bold w-full text-center">📸 เปิดดูรูปภาพแนบ (แท็บใหม่)</button>`;
                }
            }

            maintHtml += `
                <div class="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-bold text-sm text-orange-700">${log.issueType}</span>
                        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">${log.date}</span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2 flex justify-between bg-orange-50 p-2 rounded">
                        <span>⏱️ ${sTime} - ${eTime} (<b class="text-gray-800">${durationStr}</b>)</span>
                        <span>👤 ${log.recorder || '-'}</span>
                    </div>
                    <p class="text-sm text-gray-700 p-2 rounded border border-gray-100 bg-gray-50">${log.remark || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                    ${imgBtn}
                </div>
            `;
        });

        let totalH = Math.floor(totalDowntimeMins / 60);
        let totalM = totalDowntimeMins % 60;
        downtimeText.innerText = totalH > 0 ? `${totalH} ชม. ${totalM} นาที` : `${totalM} นาที`;
        maintListContainer.innerHTML = maintHtml;

    } else {
        downtimeText.innerText = "0 นาที";
        maintListContainer.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm bg-gray-50 rounded border border-dashed border-gray-200">ไม่พบประวัติการแจ้งซ่อม หรือปัญหาเครื่องจักรในช่วงเวลานี้</div>';
    }

    document.getElementById('machineChartToggle').value = 'hourly';
    window.switchMachineChart();

    // เปิดหน้าต่าง Modal แล้วดัน z-index ให้สูงสุดแบบบังคับเพื่อทะลุโหมด Maximize
    if(modal) {
        modal.classList.remove('hidden');
        modal.style.setProperty('z-index', '999999', 'important');
    }

    if(machineDetailChart) machineDetailChart.destroy();
    if(machineDailyChartInst) machineDailyChartInst.destroy();

    const hNgPcs = mData.hourlyNgPcs || mData.hourlyNg || [];

    const cleanHourlyLabels = (currentDashboardData.hourlyLabels || []).map(label => {
         const parts = label.split('-');
         if (parts.length > 1) {
             const match = parts[1].match(/(\d{2}):/);
             return match ? match[1] + ":00" : label;
         }
         const fallbackMatch = label.match(/(\d{2}):/);
         return fallbackMatch ? fallbackMatch[1] + ":00" : label;
    });

    machineDetailChart = new Chart(document.getElementById('machineDetailChart').getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: cleanHourlyLabels, 
            datasets: [
                { label: 'FG (งานดี)', data: mData.hourlyFg || [], backgroundColor: '#3b82f6', borderRadius: 2 }, 
                { label: 'NG (เสียเป็นชิ้น)', data: hNgPcs, backgroundColor: '#ef4444', borderRadius: 2 }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            if (context.dataset.label === 'NG (เสียเป็นชิ้น)') {
                                const idx = context.dataIndex;
                                const breakdown = mData.hourlyNgBreakdown ? mData.hourlyNgBreakdown[idx] : null;
                                
                                if (breakdown && Object.keys(breakdown).length > 0) {
                                    const hSep = window.separateSetupData(breakdown);
                                    let lines = ['----------------------'];
                                    hSep.labels
                                        .map((l, i) => [l, hSep.total[i], hSep.setup[i]])
                                        .filter(x => x[1] > 0)
                                        .sort((a, b) => b[1] - a[1])
                                        .forEach(([k, total, setup]) => {
                                            let sn = setup > 0 ? ` (Setup: ${setup})` : '';
                                            lines.push(`  • ${k}: ${total.toLocaleString()} ชิ้น${sn}`);
                                        });
                                    if (lines.length > 1) return lines;
                                }
                            }
                            return [];
                        }
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'xy' },
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                },
                datalabels: {
                    display: true,
                    color: '#ffffff',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value) => value > 0 ? value : null
                }
            }, 
            scales: { x: { stacked: true }, y: { beginAtZero: true, stacked: true } } 
        } 
    });
const dailyData = mData.daily || {};
    const dailyKeys = Object.keys(dailyData).sort();

    const sortData = mData.sortData || {};
    // 🔴 แก้ไข data.globalSortNgRatio เป็น currentDashboardData
    const globalSortNgRatio = ((typeof currentDashboardData !== 'undefined' && currentDashboardData.globalSortNgRatio) ? currentDashboardData.globalSortNgRatio : 50) / 100;

    // 🟢 สร้างฟังก์ชันดักค่า undefined ป้องกันกราฟพังเป็น NaN
    const getFg = (d) => d ? (d.fg || 0) : 0;
    const getNg = (d) => d ? (d.ngPcs !== undefined ? d.ngPcs : (d.ng || 0)) : 0;

    const dailyYields = dailyKeys.map(k => {
        const d = dailyData[k];
        const t = getFg(d) + getNg(d);
        return t > 0 ? parseFloat(((getFg(d) / t) * 100).toFixed(1)) : 0;
    });

    // เส้นประ projection: NG Rate (inverse of yield)
    const worstYield = dailyKeys.map(k => {
        const sd = sortData[k];
        const pending = sd ? (sd.pendingPcs || 0) : 0;
        if (pending <= 0) return null;
        const d = dailyData[k];
        const total = getFg(d) + getNg(d) + pending;
        // NG 100%: pending ทั้งหมดเป็น NG → yield ลดลง
        return total > 0 ? parseFloat(((getFg(d) / total) * 100).toFixed(1)) : null;
    });

    const bestYield = dailyKeys.map(k => {
        const sd = sortData[k];
        const pending = sd ? (sd.pendingPcs || 0) : 0;
        if (pending <= 0) return null;
        const d = dailyData[k];
        const total = getFg(d) + getNg(d) + pending;
        // FG 100%: pending ทั้งหมดเป็น FG → yield เพิ่ม
        return total > 0 ? parseFloat((((getFg(d) + pending) / total) * 100).toFixed(1)) : null;
    });

   // 🌟 1. ดึง "ค่าน้ำหนัก" ที่วิเคราะห์จากประวัติงาน Sort จริงจาก Backend
    const dynamicSymptomWeights = (typeof currentDashboardData !== 'undefined' && currentDashboardData.dynamicSymptomWeights) ? currentDashboardData.dynamicSymptomWeights : {};

    const forecastYield = dailyKeys.map(k => {
        const sd = sortData[k];
        const pending = sd ? (sd.pendingPcs || 0) : 0;
        if (pending <= 0) return null;
        
        const d = dailyData[k];
        const total = getFg(d) + getNg(d) + pending;
        if (total <= 0) return null;

        let projectedFgFromSort = 0;

        // 🌟 2. คำนวณ Forecast ด้วยข้อมูลจริงแยกตามสัดส่วนอาการ (Data-driven forecasting)
        if (d.ngBreakdown && Object.keys(d.ngBreakdown).length > 0 && getNg(d) > 0) {
            let totalWeightedFgRatio = 0;
            const dailyNg = getNg(d);
            
            for (const [symptom, pcs] of Object.entries(d.ngBreakdown)) {
                // ถ้าประวัติเคยบันทึกอาการนี้ไว้ จะใช้อัตราการได้งานดี(FG) จริง แต่ถ้าไม่เคยเจออาการนี้ให้ใช้ค่าเฉลี่ยรวม
                const fgRate = dynamicSymptomWeights[symptom] !== undefined ? dynamicSymptomWeights[symptom] : (1 - globalSortNgRatio);
                
                // หาว่าอาการนี้คิดเป็นสัดส่วนกี่ % ของของเสียในวันนั้น
                const proportion = pcs / dailyNg; 
                totalWeightedFgRatio += (proportion * fgRate); 
            }
            
            projectedFgFromSort = Math.round(pending * totalWeightedFgRatio);
            
        } else {
            // กรณีไม่มีข้อมูล Breakdown ให้ใช้อัตราส่วนเฉลี่ยรวมเหมือนเดิม
            let ngRatio = globalSortNgRatio;
            if (sd && (sd.fgPcs + sd.ngPcs) > 0) {
                ngRatio = sd.ngPcs / (sd.fgPcs + sd.ngPcs);
            }
            projectedFgFromSort = Math.round(pending * (1 - ngRatio));
        }

        const projFg = getFg(d) + projectedFgFromSort;
        return parseFloat(((projFg / total) * 100).toFixed(1));
    });

    const hasPending = worstYield.some(v => v !== null);

    const dailyDatasets = [
        {
            type: 'line', label: '% Yield รายวัน', data: dailyYields,
            borderColor: '#10b981', backgroundColor: '#10b981', yAxisID: 'y1', tension: 0.3, borderWidth: 2
        }
    ];

    if (hasPending) {
        dailyDatasets.push({
            type: 'line', label: 'NG100% (Worst)', data: worstYield,
            borderColor: 'rgba(239, 68, 68, 0.4)', yAxisID: 'y1', tension: 0.3,
            borderWidth: 2, borderDash: [6, 4], pointRadius: 2, fill: false, spanGaps: false
        });
        dailyDatasets.push({
            type: 'line', label: 'FG100% (Best)', data: bestYield,
            borderColor: 'rgba(34, 197, 94, 0.4)', yAxisID: 'y1', tension: 0.3,
            borderWidth: 2, borderDash: [6, 4], pointRadius: 2, fill: false, spanGaps: false
        });
        dailyDatasets.push({
            type: 'line', label: '📊 Forecast', data: forecastYield,
            borderColor: 'rgba(139, 92, 246, 0.7)', yAxisID: 'y1', tension: 0.3,
            borderWidth: 2.5, borderDash: [8, 3], pointRadius: 3, pointStyle: 'triangle', fill: false, spanGaps: false
        });
    }

    dailyDatasets.push(
        { label: 'FG (งานดี)', data: dailyKeys.map(k => getFg(dailyData[k])), backgroundColor: '#3b82f6', yAxisID: 'y', stack: 'Stack 0' },
        { label: 'NG (เสียเป็นชิ้น)', data: dailyKeys.map(k => getNg(dailyData[k])), backgroundColor: '#ef4444', yAxisID: 'y', stack: 'Stack 0' }
    );

    machineDailyChartInst = new Chart(document.getElementById('machineDailyTrendChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: dailyKeys,
            datasets: dailyDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements, chart) => {
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const datasetIndex = element.datasetIndex;
                const index = element.index;
                
                if (chart.data.datasets[datasetIndex].label === 'NG (เสียเป็นชิ้น)') {
                    const dateStr = chart.data.labels[index];
                    window.showDailyNgBreakdown(window.currentSelectedMachine, dateStr);
                }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, position: 'left' },
                y1: { beginAtZero: true, max: 100, position: 'right', grid: { display: false } }
            },
            plugins: {
                zoom: {
                    pan: { enabled: true, mode: 'xy' },
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                },
                datalabels: {
                    display: function(context) {
                        return context.dataset.type === 'line' && context.dataset.data[context.dataIndex] > 0;
                    },
                    align: 'top',
                    color: '#065f46',
                    font: { weight: 'bold', size: 10 },
                    formatter: (v) => v + '%'
                }
            }
        }
    });
};

window.showDailyNgBreakdown = function(machine, date) {
    if (!currentDashboardData || !currentDashboardData.machineData[machine]) return;
    const dailyData = currentDashboardData.machineData[machine].daily[date];

    if (!dailyData || !dailyData.ngBreakdown) {
        alert("ไม่พบข้อมูล Breakdown สำหรับวันนี้ (อาจเป็นข้อมูลเก่าก่อนการอัปเดตระบบ)");
        return;
    }

    const breakdown = dailyData.ngBreakdown;
    const container = document.getElementById('daily-ng-content');
    document.getElementById('daily-ng-title').innerText = `🗑️ NG Breakdown: ${machine} (${date})`;

    // รวม Setup เข้ากับอาการหลัก
    const bdSep = window.separateSetupData(breakdown);

    let html = '<ul class="divide-y divide-gray-200">';
    let total = 0;

    const sortedItems = bdSep.labels
        .map((l, i) => [l, bdSep.total[i], bdSep.setup[i], bdSep.production[i]])
        .filter(x => x[1] > 0)
        .sort((a, b) => b[1] - a[1]);

    if (sortedItems.length === 0) {
        html += '<li class="py-3 text-center text-gray-500">🎉 ไม่มีของเสียในวันนี้</li>';
    } else {
        sortedItems.forEach(([type, totalPcs, setupPcs, prodPcs]) => {
            total += totalPcs;
            let setupNote = setupPcs > 0 ? `<span class="text-[10px] text-orange-600 ml-2">(Setup: ${setupPcs.toLocaleString()})</span>` : '';
            html += `
            <li class="py-3 flex justify-between items-center">
                <span class="text-sm font-medium text-gray-700">${type}${setupNote}</span>
                <span class="text-sm font-bold text-red-600">${totalPcs.toLocaleString()} ชิ้น</span>
            </li>`;
        });
        html += `
        <li class="py-3 flex justify-between items-center bg-red-50 mt-2 px-3 rounded-lg font-bold border border-red-100">
            <span class="text-red-800">รวมของเสียทั้งหมด</span>
            <span class="text-red-800 text-lg">${total.toLocaleString()} ชิ้น</span>
        </li>`;
    }

    html += '</ul>';
    container.innerHTML = html;

    const modalWindow = document.getElementById('modal-daily-ng-breakdown');
    if(modalWindow) {
        modalWindow.classList.remove('hidden');
        // ดัน z-index ให้สูงสุดแบบบังคับเพื่อทะลุโหมด Maximize
        modalWindow.style.setProperty('z-index', '999999', 'important');
    }
};

window.viewMaintImage = function(url, caption) {
    const modal = document.getElementById('modal-image-viewer');
    const img = document.getElementById('viewer-img');
    const cap = document.getElementById('viewer-caption');

    if (modal && img) {
        img.src = url;
        if (cap) cap.innerText = caption || 'ภาพแนบการแจ้งซ่อม';
        modal.classList.remove('hidden');
        // ดัน z-index ให้สูงสุดแบบบังคับเพื่อทะลุโหมด Maximize
        modal.style.setProperty('z-index', '999999', 'important');
    } else {
        window.open(url, '_blank');
    }
};
// 🌟 ฟังก์ชันสำหรับ ขยาย/ย่อ หน้าต่าง Modal ให้เต็มจอ
        window.toggleModalFullscreen = function(contentId, btn) {
            const content = document.getElementById(contentId);
            if (!content) return;

            const isMaximized = content.classList.contains('max-w-full');

            if (isMaximized) {
                // ย่อกลับขนาดเดิม
                content.classList.remove('max-w-full', 'h-full', 'w-full', 'max-h-screen', 'rounded-none');
                content.classList.add('max-w-3xl', 'max-h-[90vh]', 'rounded-xl');
                btn.innerHTML = '⛶'; 
                btn.title = "ขยายเต็มจอ";
            } else {
                // ขยายเต็มจอ
                content.classList.remove('max-w-3xl', 'max-h-[90vh]', 'rounded-xl');
                content.classList.add('max-w-full', 'h-full', 'w-full', 'max-h-screen', 'rounded-none');
                btn.innerHTML = '🗗'; 
                btn.title = "ย่อหน้าต่าง";
            }

            // บังคับให้กราฟคำนวณสเกลตัวเองใหม่เมื่อขนาดหน้าต่างเปลี่ยน
            setTimeout(() => {
                if (typeof machineDetailChart !== 'undefined' && machineDetailChart) {
                    machineDetailChart.resize();
                }
                if (typeof machineDailyChartInst !== 'undefined' && machineDailyChartInst) {
                    machineDailyChartInst.resize();
                }
            }, 350); // รอให้ CSS Transition ขยายเสร็จก่อนค่อย Resize กราฟ
        };

// ==========================================
// Audit Export: Daily NG Rate Calculation Detail
// ==========================================
window._auditData = null;

window.exportNgRateAudit = function() {
    if (!currentDashboardData) { alert('กรุณาโหลดข้อมูลก่อน'); return; }
    const data = currentDashboardData;
    const container = document.getElementById('ng-audit-content');
    if (!container) return;

    const qcSelector = document.getElementById('qcModelSelector');
    const selectedModel = qcSelector ? qcSelector.value : 'all';
    const startDate = document.getElementById('startDate')?.value || '-';
    const endDate = document.getElementById('endDate')?.value || '-';
    const shiftFilter = document.getElementById('shiftFilter')?.value || 'All';
    const shiftTypeFilter = document.getElementById('shiftTypeFilter')?.value || 'All';
    const now = new Date().toLocaleString('th-TH');

    const wppTable = { "10A": 0.00228, "16A": 0.00279, "20A": 0.00357, "25/32A": 0.005335 };
    const getWpp = (prod) => {
        if (!prod) return 0.003;
        for (const k in wppTable) { if (prod.includes(k)) return wppTable[k]; }
        return 0.003;
    };
    const getKgFromPcs = (prod, pcs) => pcs > 0 ? pcs * getWpp(prod) : 0;
    const f = (v, d) => v !== null && v !== undefined ? parseFloat(v).toFixed(d === undefined ? 4 : d) : '-';

    const trendData = data.dailyTrend || [];
    const dynamicWeights = data.dynamicSymptomWeights || {};
    const globalSortNgRatio = (data.globalSortNgRatio || 50) / 100;

    // === Build per-day audit rows ===
    let auditRows = [];
    let grandFgKg = 0, grandNgKg = 0, grandPendingKg = 0, grandProjNgKg = 0;

    trendData.forEach(originalDay => {
        const dateStr = originalDay.date;
        let dayMachines = [];
        let mFgKg = 0, mNgKg = 0, mPendingKg = 0, mFgPcs = 0, mNgPcs = 0, mPendingPcs = 0;
        let modelNgBreakdownKg = {};
        let modelSortFgPcs = 0, modelSortNgPcs = 0;

        Object.entries(data.machineData || {}).forEach(([mac, mData]) => {
            let assignedModel = '';
            if (typeof machineMapping !== 'undefined' && machineMapping[mac]) assignedModel = machineMapping[mac];
            else if (typeof globalMachineMapping !== 'undefined' && globalMachineMapping[mac]) assignedModel = globalMachineMapping[mac];
            else if (data.machineMapping && data.machineMapping[mac]) assignedModel = data.machineMapping[mac];

            if (selectedModel === 'all' || assignedModel === selectedModel || assignedModel.includes(selectedModel)) {
                if (mData.daily && mData.daily[dateStr]) {
                    const dd = mData.daily[dateStr];
                    const dailyFgPcs = dd.fg || 0;
                    const dailyNgPcs = dd.ngPcs !== undefined ? dd.ngPcs : (dd.ng || 0);
                    if (dailyFgPcs === 0 && dailyNgPcs === 0) return;

                    const wpp = getWpp(assignedModel);
                    const macFgKg = getKgFromPcs(assignedModel, dailyFgPcs);
                    const macNgKg = getKgFromPcs(assignedModel, dailyNgPcs);
                    let pendPcs = 0, pendKg = 0;
                    if (mData.sortData && mData.sortData[dateStr]) {
                        pendPcs = mData.sortData[dateStr].pendingPcs || 0;
                        pendKg = getKgFromPcs(assignedModel, pendPcs);
                        modelSortFgPcs += mData.sortData[dateStr].fgPcs || 0;
                        modelSortNgPcs += mData.sortData[dateStr].ngPcs || 0;
                    }

                    let ngBreakdown = {};
                    if (dd.ngBreakdown) {
                        for (const [symp, pcs] of Object.entries(dd.ngBreakdown)) {
                            const sympKg = getKgFromPcs(assignedModel, pcs);
                            ngBreakdown[symp] = { pcs, kg: sympKg };
                            modelNgBreakdownKg[symp] = (modelNgBreakdownKg[symp] || 0) + sympKg;
                        }
                    }

                    mFgPcs += dailyFgPcs; mNgPcs += dailyNgPcs;
                    mFgKg += macFgKg; mNgKg += macNgKg;
                    mPendingPcs += pendPcs; mPendingKg += pendKg;

                    dayMachines.push({
                        machine: mac, model: assignedModel, wpp,
                        fgPcs: dailyFgPcs, ngPcs: dailyNgPcs, fgKg: macFgKg, ngKg: macNgKg,
                        pendingPcs: pendPcs, pendingKg: pendKg, ngBreakdown
                    });
                }
            }
        });

        const totalKg = mFgKg + mNgKg;
        const ngRate = totalKg > 0 ? (mNgKg / totalKg) * 100 : 0;
        let worstNgRate = null, bestNgRate = null, forecastNgRate = null, projectedNgKg = 0;
        let forecastDetail = [];

        if (mPendingKg > 0 && totalKg > 0) {
            const projTotalKg = totalKg + mPendingKg;
            worstNgRate = ((mNgKg + mPendingKg) / projTotalKg) * 100;
            bestNgRate = (mNgKg / projTotalKg) * 100;
            let totalWeightedNgRatio = 0;

            if (Object.keys(modelNgBreakdownKg).length > 0 && mNgKg > 0) {
                for (const [symp, sympKg] of Object.entries(modelNgBreakdownKg)) {
                    const fgRate = dynamicWeights[symp] !== undefined ? dynamicWeights[symp] : (1 - globalSortNgRatio);
                    const proportion = sympKg / mNgKg;
                    const ngRatio = 1 - fgRate;
                    totalWeightedNgRatio += (proportion * ngRatio);
                    forecastDetail.push({ symp, sympKg, proportion, fgRate, ngRatio, source: dynamicWeights[symp] !== undefined ? 'Dynamic' : 'Global' });
                }
                projectedNgKg = mPendingKg * totalWeightedNgRatio;
                forecastNgRate = ((mNgKg + projectedNgKg) / projTotalKg) * 100;
            } else {
                let avgNgRatio = globalSortNgRatio;
                if ((modelSortFgPcs + modelSortNgPcs) > 0) avgNgRatio = modelSortNgPcs / (modelSortFgPcs + modelSortNgPcs);
                projectedNgKg = mPendingKg * avgNgRatio;
                forecastNgRate = ((mNgKg + projectedNgKg) / projTotalKg) * 100;
                forecastDetail.push({ symp: '(Global Avg)', sympKg: mNgKg, proportion: 1, fgRate: 1 - avgNgRatio, ngRatio: avgNgRatio, source: 'Global Avg' });
            }
        }

        grandFgKg += mFgKg; grandNgKg += mNgKg; grandPendingKg += mPendingKg; grandProjNgKg += projectedNgKg;

        auditRows.push({
            date: dateStr, machines: dayMachines,
            fgPcs: mFgPcs, ngPcs: mNgPcs, fgKg: mFgKg, ngKg: mNgKg,
            totalKg, ngRate, pendingPcs: mPendingPcs, pendingKg: mPendingKg,
            worstNgRate, bestNgRate, forecastNgRate, projectedNgKg, forecastDetail,
            modelNgBreakdownKg
        });
    });

    window._auditData = auditRows;
    const grandTotalKg = grandFgKg + grandNgKg;
    const grandNgRate = grandTotalKg > 0 ? (grandNgKg / grandTotalKg) * 100 : 0;

    // === Render HTML ===
    let html = '';

    // Header
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h2 class="text-lg font-black text-gray-800 mb-2">Audit Report: Daily NG Rate Trend — Calculation Detail</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
            <div><b>Generated:</b> ${now}</div>
            <div><b>Period:</b> ${startDate} ~ ${endDate}</div>
            <div><b>Shift:</b> ${shiftFilter} / ${shiftTypeFilter}</div>
            <div><b>Model Filter:</b> ${selectedModel}</div>
        </div>
    </div>`;

    // Section 1: Methodology
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h3 class="font-bold text-sm text-blue-800 border-b pb-1 mb-2">Section 1: Methodology & Basis of Calculation</h3>
        <div class="text-xs text-gray-700 space-y-1">
            <p><b>1.1 NG Rate Formula:</b> <code class="bg-gray-100 px-1 rounded">NG Rate (%) = (NG Weight in Kg) / (FG Weight in Kg + NG Weight in Kg) × 100</code></p>
            <p><b>1.2 Weight Basis:</b> NG Rate is calculated on a <b>weight (Kg) basis</b>, not piece count. This ensures fair comparison across product models with different piece weights.</p>
            <p><b>1.3 Conversion:</b> <code class="bg-gray-100 px-1 rounded">Weight (Kg) = Piece Count × Weight Per Piece (WPP)</code></p>
            <p><b>1.4 Worst Case:</b> <code class="bg-gray-100 px-1 rounded">Worst NG Rate = (NG Kg + Pending Kg) / (Total Kg + Pending Kg) × 100</code> — assumes all pending sort items are NG</p>
            <p><b>1.5 Best Case:</b> <code class="bg-gray-100 px-1 rounded">Best NG Rate = NG Kg / (Total Kg + Pending Kg) × 100</code> — assumes all pending sort items are FG</p>
            <p><b>1.6 Forecast:</b> Uses <b>Dynamic Symptom Weights</b> from actual sort history to predict NG ratio of pending items per defect type.</p>
            <p class="text-[10px] text-gray-500 mt-1"><code>Forecast NG Kg = Pending Kg × Σ(Symptom Proportion × Symptom NG Ratio)</code><br>
            <code>Forecast NG Rate = (NG Kg + Forecast NG Kg) / (Total Kg + Pending Kg) × 100</code></p>
        </div>
    </div>`;

    // Section 2: WPP Reference
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h3 class="font-bold text-sm text-blue-800 border-b pb-1 mb-2">Section 2: Weight Per Piece (WPP) Reference Table</h3>
        <table class="w-full text-xs border-collapse"><thead><tr class="bg-blue-50">
            <th class="border p-1 text-left">Product Model</th><th class="border p-1 text-right">WPP (Kg/Piece)</th><th class="border p-1 text-left">Remark</th>
        </tr></thead><tbody>`;
    [["S1B29288-JR (10A)", 0.00228], ["S1B71819-JR (16A)", 0.00279], ["S1B29292-JR (20A)", 0.00357], ["51207080HC-JR (25/32A)", 0.005335]].forEach(([m, w]) => {
        html += `<tr><td class="border p-1">${m}</td><td class="border p-1 text-right font-mono">${w}</td><td class="border p-1 text-gray-500">Fixed constant</td></tr>`;
    });
    html += `<tr class="bg-yellow-50"><td class="border p-1">Other / Unknown</td><td class="border p-1 text-right font-mono">0.003</td><td class="border p-1 text-gray-500">Default fallback</td></tr>`;
    html += `</tbody></table></div>`;

    // Section 3: Dynamic Symptom Weights
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h3 class="font-bold text-sm text-blue-800 border-b pb-1 mb-2">Section 3: Dynamic Symptom Weights (from Sort History)</h3>
        <p class="text-xs text-gray-600 mb-2">These weights are derived from actual sorting results. <b>FG Rate</b> = proportion of items sorted as Good (FG) for each defect symptom. <b>NG Ratio</b> = 1 - FG Rate = expected proportion that will remain NG.</p>
        <table class="w-full text-xs border-collapse"><thead><tr class="bg-purple-50">
            <th class="border p-1 text-left">Symptom</th><th class="border p-1 text-right">FG Rate</th><th class="border p-1 text-right">NG Ratio (1 - FG Rate)</th><th class="border p-1 text-left">Source</th>
        </tr></thead><tbody>`;
    if (Object.keys(dynamicWeights).length > 0) {
        Object.entries(dynamicWeights).sort((a, b) => b[1] - a[1]).forEach(([symp, fgRate]) => {
            html += `<tr><td class="border p-1">${symp}</td><td class="border p-1 text-right font-mono">${(fgRate * 100).toFixed(2)}%</td><td class="border p-1 text-right font-mono">${((1 - fgRate) * 100).toFixed(2)}%</td><td class="border p-1 text-gray-500">Sort History</td></tr>`;
        });
    } else {
        html += `<tr><td class="border p-1 text-gray-400" colspan="4">No sort history data available</td></tr>`;
    }
    html += `<tr class="bg-yellow-50"><td class="border p-1 font-bold">Global Fallback</td><td class="border p-1 text-right font-mono">${((1 - globalSortNgRatio) * 100).toFixed(2)}%</td><td class="border p-1 text-right font-mono">${(globalSortNgRatio * 100).toFixed(2)}%</td><td class="border p-1 text-gray-500">Used when symptom has no sort data</td></tr>`;
    html += `</tbody></table></div>`;

    // Section 4: Machine-Product Assignment
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h3 class="font-bold text-sm text-blue-800 border-b pb-1 mb-2">Section 4: Machine-Product Assignment (WPP applied)</h3>
        <table class="w-full text-xs border-collapse"><thead><tr class="bg-green-50">
            <th class="border p-1">Machine</th><th class="border p-1">Assigned Product</th><th class="border p-1 text-right">WPP Used</th>
        </tr></thead><tbody>`;
    for (let i = 1; i <= 16; i++) {
        const m = 'CWM-' + String(i).padStart(2, '0');
        let prod = '';
        if (typeof machineMapping !== 'undefined' && machineMapping[m]) prod = machineMapping[m];
        else if (data.machineMapping && data.machineMapping[m]) prod = data.machineMapping[m];
        if (selectedModel !== 'all' && !prod.includes(selectedModel)) continue;
        const w = getWpp(prod);
        html += `<tr><td class="border p-1 font-bold">${m}</td><td class="border p-1">${prod || '<i class="text-gray-400">Unassigned</i>'}</td><td class="border p-1 text-right font-mono">${w}</td></tr>`;
    }
    html += `</tbody></table></div>`;

    // Section 5: Grand Summary
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h3 class="font-bold text-sm text-blue-800 border-b pb-1 mb-2">Section 5: Grand Summary</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="bg-blue-50 rounded p-2"><b>Total FG (Kg):</b><br><span class="text-lg font-bold text-blue-700">${f(grandFgKg, 4)}</span></div>
            <div class="bg-red-50 rounded p-2"><b>Total NG (Kg):</b><br><span class="text-lg font-bold text-red-700">${f(grandNgKg, 4)}</span></div>
            <div class="bg-gray-50 rounded p-2"><b>Total Production (Kg):</b><br><span class="text-lg font-bold">${f(grandTotalKg, 4)}</span></div>
            <div class="bg-orange-50 rounded p-2"><b>Avg NG Rate:</b><br><span class="text-lg font-bold text-orange-700">${f(grandNgRate, 4)}%</span></div>
        </div>
        <p class="text-[10px] text-gray-500 mt-2 font-mono">Formula: ${f(grandNgKg, 4)} / (${f(grandFgKg, 4)} + ${f(grandNgKg, 4)}) × 100 = ${f(grandNgRate, 4)}%</p>
    </div>`;

    // Section 6: Daily Detail
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h3 class="font-bold text-sm text-blue-800 border-b pb-1 mb-3">Section 6: Daily Calculation Detail</h3>`;

    auditRows.forEach((row, dayIdx) => {
        if (row.fgPcs === 0 && row.ngPcs === 0) return;
        const hasPending = row.pendingKg > 0;

        html += `<div class="border rounded-lg mb-3 overflow-hidden">
            <div class="bg-gray-100 px-3 py-2 flex justify-between items-center cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <span class="font-bold text-sm text-gray-800">${row.date}</span>
                <div class="flex gap-4 text-xs">
                    <span class="text-blue-700">FG: ${f(row.fgKg, 4)} Kg</span>
                    <span class="text-red-700">NG: ${f(row.ngKg, 4)} Kg</span>
                    <span class="font-black text-orange-700">Rate: ${f(row.ngRate, 2)}%</span>
                    ${hasPending ? `<span class="text-purple-600">Forecast: ${f(row.forecastNgRate, 2)}%</span>` : ''}
                </div>
            </div>
            <div class="hidden p-3 bg-white text-xs space-y-3">`;

        // 6a: Day Summary + Formula
        html += `<div class="bg-yellow-50 border border-yellow-200 rounded p-2">
            <p class="font-bold text-yellow-800 mb-1">Calculation:</p>
            <p class="font-mono text-[11px]">FG Kg = ${f(row.fgKg, 6)} | NG Kg = ${f(row.ngKg, 6)} | Total = ${f(row.totalKg, 6)}</p>
            <p class="font-mono text-[11px]">NG Rate = ${f(row.ngKg, 6)} / ${f(row.totalKg, 6)} × 100 = <b>${f(row.ngRate, 4)}%</b></p>`;
        if (hasPending) {
            const projTotal = row.totalKg + row.pendingKg;
            html += `<p class="font-mono text-[11px] mt-1">Pending Sort = ${row.pendingPcs} pcs = ${f(row.pendingKg, 6)} Kg</p>
                <p class="font-mono text-[11px]">Worst = (${f(row.ngKg, 4)} + ${f(row.pendingKg, 4)}) / ${f(projTotal, 4)} × 100 = <b>${f(row.worstNgRate, 4)}%</b></p>
                <p class="font-mono text-[11px]">Best = ${f(row.ngKg, 4)} / ${f(projTotal, 4)} × 100 = <b>${f(row.bestNgRate, 4)}%</b></p>
                <p class="font-mono text-[11px]">Projected NG Kg = ${f(row.pendingKg, 4)} × Weighted Ratio = ${f(row.projectedNgKg, 6)}</p>
                <p class="font-mono text-[11px]">Forecast = (${f(row.ngKg, 4)} + ${f(row.projectedNgKg, 4)}) / ${f(projTotal, 4)} × 100 = <b>${f(row.forecastNgRate, 4)}%</b></p>`;
        }
        html += `</div>`;

        // 6b: Machine Breakdown
        html += `<div><p class="font-bold text-gray-700 mb-1">Machine Breakdown:</p>
            <table class="w-full border-collapse text-[11px]"><thead><tr class="bg-blue-50">
                <th class="border p-1">Machine</th><th class="border p-1">Model</th><th class="border p-1 text-right">WPP</th>
                <th class="border p-1 text-right">FG (pcs)</th><th class="border p-1 text-right">FG (Kg)</th>
                <th class="border p-1 text-right">NG (pcs)</th><th class="border p-1 text-right">NG (Kg)</th>
                <th class="border p-1 text-right">Pending</th><th class="border p-1">NG Detail</th>
            </tr></thead><tbody>`;
        row.machines.forEach(mc => {
            const detailParts = Object.entries(mc.ngBreakdown).map(([s, v]) => `${s}: ${v.pcs}pcs (${f(v.kg, 4)}Kg)`).join(', ');
            html += `<tr>
                <td class="border p-1 font-bold">${mc.machine}</td><td class="border p-1">${mc.model}</td>
                <td class="border p-1 text-right font-mono">${mc.wpp}</td>
                <td class="border p-1 text-right">${mc.fgPcs.toLocaleString()}</td><td class="border p-1 text-right font-mono">${f(mc.fgKg, 4)}</td>
                <td class="border p-1 text-right text-red-600">${mc.ngPcs.toLocaleString()}</td><td class="border p-1 text-right font-mono text-red-600">${f(mc.ngKg, 6)}</td>
                <td class="border p-1 text-right">${mc.pendingPcs > 0 ? mc.pendingPcs + 'pcs' : '-'}</td>
                <td class="border p-1 text-[10px] text-gray-600">${detailParts || '-'}</td>
            </tr>`;
        });
        // Subtotal
        html += `<tr class="bg-gray-100 font-bold">
            <td class="border p-1" colspan="3">Subtotal</td>
            <td class="border p-1 text-right">${row.fgPcs.toLocaleString()}</td><td class="border p-1 text-right font-mono">${f(row.fgKg, 4)}</td>
            <td class="border p-1 text-right text-red-600">${row.ngPcs.toLocaleString()}</td><td class="border p-1 text-right font-mono text-red-600">${f(row.ngKg, 4)}</td>
            <td class="border p-1 text-right">${row.pendingPcs > 0 ? row.pendingPcs + 'pcs' : '-'}</td>
            <td class="border p-1"></td>
        </tr></tbody></table></div>`;

        // 6c: Forecast Weight Detail (if pending)
        if (row.forecastDetail.length > 0) {
            html += `<div><p class="font-bold text-gray-700 mb-1">Forecast Weight Calculation:</p>
                <table class="w-full border-collapse text-[11px]"><thead><tr class="bg-purple-50">
                    <th class="border p-1 text-left">Symptom</th><th class="border p-1 text-right">NG Kg</th>
                    <th class="border p-1 text-right">Proportion</th><th class="border p-1 text-right">FG Rate</th>
                    <th class="border p-1 text-right">NG Ratio</th><th class="border p-1 text-right">Weighted</th>
                    <th class="border p-1">Source</th>
                </tr></thead><tbody>`;
            let sumWeighted = 0;
            row.forecastDetail.forEach(fd => {
                const weighted = fd.proportion * fd.ngRatio;
                sumWeighted += weighted;
                html += `<tr>
                    <td class="border p-1">${fd.symp}</td>
                    <td class="border p-1 text-right font-mono">${f(fd.sympKg, 4)}</td>
                    <td class="border p-1 text-right font-mono">${(fd.proportion * 100).toFixed(2)}%</td>
                    <td class="border p-1 text-right font-mono">${(fd.fgRate * 100).toFixed(2)}%</td>
                    <td class="border p-1 text-right font-mono">${(fd.ngRatio * 100).toFixed(2)}%</td>
                    <td class="border p-1 text-right font-mono">${(weighted * 100).toFixed(4)}%</td>
                    <td class="border p-1 text-gray-500">${fd.source}</td>
                </tr>`;
            });
            html += `<tr class="bg-gray-100 font-bold"><td class="border p-1" colspan="5">Total Weighted NG Ratio</td>
                <td class="border p-1 text-right font-mono">${(sumWeighted * 100).toFixed(4)}%</td><td class="border p-1"></td></tr>`;
            html += `</tbody></table>
                <p class="text-[10px] text-gray-500 font-mono mt-1">Projected NG Kg = Pending ${f(row.pendingKg, 4)} Kg × ${(sumWeighted * 100).toFixed(4)}% = ${f(row.projectedNgKg, 6)} Kg</p>
            </div>`;
        }

        html += `</div></div>`;
    });
    html += `</div>`;

    // Section 7: Verification Checklist
    html += `<div class="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <h3 class="font-bold text-sm text-blue-800 border-b pb-1 mb-2">Section 7: Verification Checklist</h3>
        <ul class="text-xs text-gray-700 space-y-1 list-disc pl-5">
            <li>All weights derived from piece count × WPP (Section 2)</li>
            <li>NG Rate calculated on Kg basis, not piece basis</li>
            <li>Machine-Product assignment determines WPP used (Section 4)</li>
            <li>Forecast uses symptom-level FG Rate from actual sort results (Section 3)</li>
            <li>When symptom has no sort history, Global Fallback ratio is applied</li>
            <li>Each daily row can be expanded to verify individual machine contributions</li>
            <li>Grand summary matches sum of all daily data</li>
        </ul>
    </div>`;

    container.innerHTML = html;
    document.getElementById('modal-ng-audit').classList.remove('hidden');
};

// === CSV Download ===
window.downloadAuditCSV = function() {
    if (!window._auditData) return;
    let csv = 'Date,FG (pcs),FG (Kg),NG (pcs),NG (Kg),Total (Kg),NG Rate (%),Pending (pcs),Pending (Kg),Worst (%),Best (%),Forecast (%),Projected NG (Kg)\n';
    window._auditData.forEach(r => {
        csv += `${r.date},${r.fgPcs},${r.fgKg.toFixed(4)},${r.ngPcs},${r.ngKg.toFixed(6)},${r.totalKg.toFixed(4)},${r.ngRate.toFixed(4)},${r.pendingPcs},${r.pendingKg.toFixed(4)},${r.worstNgRate !== null ? r.worstNgRate.toFixed(4) : ''},${r.bestNgRate !== null ? r.bestNgRate.toFixed(4) : ''},${r.forecastNgRate !== null ? r.forecastNgRate.toFixed(4) : ''},${r.projectedNgKg.toFixed(6)}\n`;
    });

    // Machine detail sheet
    csv += '\n\nDate,Machine,Model,WPP,FG (pcs),FG (Kg),NG (pcs),NG (Kg),Pending (pcs),NG Breakdown\n';
    window._auditData.forEach(r => {
        r.machines.forEach(mc => {
            const bd = Object.entries(mc.ngBreakdown).map(([s, v]) => `${s}:${v.pcs}pcs/${v.kg.toFixed(4)}Kg`).join(' | ');
            csv += `${r.date},${mc.machine},${mc.model},${mc.wpp},${mc.fgPcs},${mc.fgKg.toFixed(4)},${mc.ngPcs},${mc.ngKg.toFixed(6)},${mc.pendingPcs},"${bd}"\n`;
        });
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NG_Rate_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// === Print ===
window.printAuditReport = function() {
    const content = document.getElementById('ng-audit-content');
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>NG Rate Audit Report</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>body{padding:20px;font-size:11px} table{page-break-inside:auto} tr{page-break-inside:avoid} .hidden{display:block!important} @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    </head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
};
