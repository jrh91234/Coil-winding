window.renderFgByModel = function(data) {
    const container = document.getElementById('fgModelList');
    if(!container) return;
    const models = [
        "S1B29288-JR (10A)",
        "S1B71819-JR (16A)",
        "S1B29292-JR (20A)",
        "51207080HC-JR (25/32A)"
    ];

    // uses shared getKgFromPcs from helpers.js (strict, no fallback)

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
                    <span class="text-gray-500 ml-2">(${window.formatKg ? window.formatKg(fgKg, 3) : fgKg.toFixed(3)} Kg)</span>
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

    // uses shared getKgFromPcs from helpers.js (strict, no fallback)

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
