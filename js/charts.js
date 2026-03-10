try { Chart.register(ChartDataLabels); } catch(e) { console.warn("ChartDataLabels not loaded"); }

window.renderFgByModel = function(data, isPartialView = false) {
    const container = document.getElementById('fgModelList');
    if(!container) return;
    const models = [
        "S1B29292-JR (20A)",
        "S1B71819-JR (16A)",
        "S1B29288-JR (10A)",
        "51207080HC-JR (25/32A)"
    ];
    let html = '<ul class="divide-y divide-gray-100">';
    models.forEach(m => {
        const fg = (data.productData && data.productData[m]) ? data.productData[m].fg : 0;
        const plan = (data.productionPlanByModel && data.productionPlanByModel[m]) ? data.productionPlanByModel[m] : 0;
        const ach = plan > 0 ? ((fg / plan) * 100).toFixed(1) : (fg > 0 ? '100.0' : '0.0');
        
        const achColor = ach >= 100 ? 'text-green-600' : (ach >= 80 ? 'text-orange-500' : 'text-red-500');
        const barColor = ach >= 100 ? 'bg-green-500' : (ach >= 80 ? 'bg-orange-500' : 'bg-red-500');

        let planLabel = plan.toLocaleString();
        if (isPartialView && plan > 0) {
            planLabel += ` <span class="text-gray-400 font-normal text-[10px]">/day</span>`;
        }

        html += `
        <li class="py-3 flex flex-col gap-1">
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-800 font-bold">${m}</span>
                <span class="font-bold ${achColor} text-lg">${ach}%</span>
            </div>
            <div class="flex justify-between items-center text-xs">
                <span class="text-gray-500">FG: <span class="font-bold text-blue-600">${fg.toLocaleString()}</span> ชิ้น</span>
                <span class="text-gray-500">Plan: <span class="font-bold text-indigo-600">${planLabel}</span> ชิ้น</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div class="${barColor} h-1.5 rounded-full" style="width: ${Math.min(ach, 100)}%"></div>
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
    } else if (type === 'ng_pcs') {
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
    if (type === 'yield') dlFormatter = (value) => value > 0 ? value + '%' : null;
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
                                const sortedNg = Object.entries(prData.ngBreakdownPcs)
                                    .filter(([k, v]) => v > 0)
                                    .sort((a, b) => b[1] - a[1]);
                                
                                if(sortedNg.length > 0) {
                                    lines.push(`-- รายละเอียด NG --`);
                                    sortedNg.forEach(([k, v]) => {
                                        lines.push(`   • ${k}: ${v.toLocaleString()} ชิ้น`);
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
    
    let ngTypeTotals = {};
    trendData.forEach(d => {
        if(d.ngBreakdown) {
            Object.keys(d.ngBreakdown).forEach(k => {
                ngTypeTotals[k] = (ngTypeTotals[k] || 0) + d.ngBreakdown[k];
            });
        }
    });
    const uniqueNgTypes = Object.keys(ngTypeTotals).sort((a, b) => ngTypeTotals[b] - ngTypeTotals[a]);
    
    const lineColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
    
    let trendDatasets = uniqueNgTypes.map((type, idx) => {
        return {
            label: type,
            data: trendData.map(d => {
                const rawPcs = (d.ngBreakdown && d.ngBreakdown[type]) ? d.ngBreakdown[type] : 0;
                if (mode === 'percent') {
                    const total = (d.fg || 0) + (d.ng || 0);
                    return total > 0 ? parseFloat(((rawPcs / total) * 100).toFixed(2)) : 0;
                }
                return rawPcs;
            }),
            borderColor: lineColors[idx % lineColors.length],
            backgroundColor: lineColors[idx % lineColors.length],
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: false
        };
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
                        
                        // วนลูปหาข้อมูลของเสียอาการนี้ ในวันที่เลือก จากทุกเครื่องจักร
                        for (const [mac, mData] of Object.entries(currentDashboardData.machineData)) {
                            if (mData.daily && mData.daily[dateStr] && mData.daily[dateStr].ngBreakdown) {
                                const mPcs = mData.daily[dateStr].ngBreakdown[symptom];
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
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: mode === 'percent' ? '% เทียบยอดผลิต' : 'จำนวน (ชิ้น)' }
                } 
            },
            layout: { padding: { top: 20, right: 20 } },
            plugins: {
                ...commonOpts.plugins,
                legend: { 
                    display: true, 
                    position: 'bottom', 
                    labels: { boxWidth: 12, font: {size: 10} } 
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
                        const c = ctx.chart.canvas.closest('.widget-card'); 
                        const isMax = c ? c.classList.contains('maximized-card') : false;
                        return isMax && ctx.dataset.data[ctx.dataIndex] > 0; 
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

         const ngItems = labels.map((l, i) => ({ label: l, pcs: valsPcs[i] || 0, kg: valsKg[i] || 0 })).sort((a,b)=>b.pcs-a.pcs);
         const totalNG = ngItems.reduce((a,b)=>a+b.pcs,0);
         let acc = 0; 
         const cumulative = ngItems.map(i=>{ acc+=i.pcs; return totalNG>0?((acc/totalNG)*100).toFixed(1):0; });

         const ctxP = document.getElementById('paretoChart');
         if(ctxP) {
             if(charts.pareto) charts.pareto.destroy();
             charts.pareto = new Chart(ctxP, { 
                 type: 'bar', plugins: activePlugins,
                 data: { 
                     labels: ngItems.map(i=>i.label), 
                     datasets: [
                         { label: '% สะสม', data: cumulative, type: 'line', borderColor: '#8b5cf6', yAxisID: 'y1', datalabels: { display: false } },
                         { label: 'NG (ชิ้น)', data: ngItems.map(i=>i.pcs), backgroundColor: '#ef4444', yAxisID: 'y', datalabels: {
                            display: function(ctx) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; },
                            align: 'end', anchor: 'end', formatter: (v) => v > 0 ? v + ' ชิ้น' : null
                         } }
                     ]
                 },
                 options: { ...commonOpts, layout: { padding: { top: 20 } }, scales: { y: { beginAtZero: true, grace: '10%' }, y1: { beginAtZero: true, max: 105, position: 'right', grid: { display: false } } } }
             });
         }
         
         const ctxNgMac = document.getElementById('ngByMachineChart');
         if(ctxNgMac) {
             if(charts.ngMachine) charts.ngMachine.destroy();
             
             const sortedNgLabels = ngItems.filter(i => i.pcs > 0).map(i => i.label);
             
             const macColors = [
                 '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', 
                 '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
             ];
             let macDatasets = [];
             let colorIdx = 0;
             
             const allMacs = Object.keys(data.machineData || {}).sort();
             
             allMacs.forEach(m => {
                 const mData = data.machineData[m];
                 let hasNg = false;
                 const ngDataForMac = sortedNgLabels.map(ngLabel => {
                     const val = mData.ngBreakdownPcs ? (mData.ngBreakdownPcs[ngLabel] || 0) : 0;
                     if(val > 0) hasNg = true;
                     return val;
                 });
                 
                 if (hasNg) {
                     macDatasets.push({
                         label: m,
                         data: ngDataForMac,
                         backgroundColor: macColors[colorIdx % macColors.length],
                         stack: 'Stack 0'
                     });
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
                             labels: { boxWidth: 12, font: { size: 10 } }
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
                                 title: function(context) {
                                     return `อาการ: ${context[0].label}`;
                                 }
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
                             formatter: (value, ctx) => {
                                 return `${ctx.dataset.label}: ${value}`;
                             }
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
                                        const sortedNg = Object.entries(mData.ngBreakdownPcs)
                                            .filter(([k, v]) => v > 0)
                                            .sort((a, b) => b[1] - a[1]);
                                        
                                        if(sortedNg.length > 0) {
                                            lines.push(`-- รายละเอียด NG --`);
                                            sortedNg.forEach(([k, v]) => {
                                                lines.push(`   • ${k}: ${v.toLocaleString()} ชิ้น`);
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
             const trendData = data.dailyTrend || [];
             charts.qcTrend = new Chart(ctxQC, { 
                 type: 'line', 
                 data: { 
                     labels: trendData.map(d=>d.date), 
                     datasets: [{label:'% NG Rate', data:trendData.map(d=>d.ngRate), borderColor:'#f97316'}] 
                 }, 
                 options: { 
                     ...commonOpts, 
                     scales: { x: { offset: true } },
                     layout: { padding: { top: 20 } },
                     plugins: {
                         ...commonOpts.plugins,
                         datalabels: {
                             display: function(ctx) { const c = ctx.chart.canvas.closest('.widget-card'); return c ? c.classList.contains('maximized-card') : true; },
                             color: '#c2410c',
                             align: 'top',
                             anchor: 'end',
                             font: { weight: 'bold' },
                             formatter: (value) => value > 0 ? value + '%' : null
                         }
                     }
                 } 
             });
         }

         window.renderNgTrendChart();

         const ctxNG = document.getElementById('ngChart');
         if(ctxNG) {
            if(charts.ng) charts.ng.destroy();
            
            const sortedLabels = ngItems.filter(item => item.pcs > 0).map(item => item.label);
            const sortedData = ngItems.filter(item => item.pcs > 0).map(item => item.pcs);
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
    let dynamicColumns = normalizeSymptomList(ngSymptoms);
    if (data.machineData) {
        for (let m in data.machineData) {
            const d = data.machineData[m];
            if (d.ngBreakdownPcs) {
                Object.keys(d.ngBreakdownPcs).forEach(k => {
                    const stdK = capitalizeFirst(k);
                    if (!dynamicColumns.some(s => s.toLowerCase() === stdK.toLowerCase())) {
                        dynamicColumns.push(stdK);
                    }
                });
            }
        }
    }

    dynamicColumns = [...new Set(dynamicColumns.map(s => capitalizeFirst(s)))];

    const h = document.getElementById('table-header'); 
    const b = document.getElementById('table-body');
    h.innerHTML = '<th>Machine</th><th>FG</th><th>NG (ชิ้น/Kg)</th><th>% Yield</th>' + dynamicColumns.map(s=>`<th>${s}</th>`).join('');
    b.innerHTML = '';

    for(let i=1; i<=16; i++) {
        const m = `CWM-${String(i).padStart(2,'0')}`; 
        const d = (data.machineData && data.machineData[m]) ? data.machineData[m] : {fg:0, ngTotal:0, ngTotalKg:0, ngTotalPcs:0, ngBreakdownKg:{}, ngBreakdownPcs:{}};
        
        const ngPcs = d.ngTotalPcs !== undefined ? d.ngTotalPcs : (d.ngTotal || 0);
        const ngKg = d.ngTotalKg || 0;
        
        const t = d.fg + ngPcs; 
        const y = t > 0 ? ((d.fg/t)*100).toFixed(1) : "0.0";
        
        const productAssigned = machineMapping[m] || 'ไม่ได้ระบุรุ่น';
        
        let html = `<td class="p-4 border-b font-bold cursor-pointer text-blue-600 hover:underline" onclick="window.showMachineDetail('${m}')">
                <div class="flex flex-col">
                    <span>👉 ${m}</span>
                    <span class="text-[10px] text-gray-500 font-normal mt-0.5">📦 ${productAssigned}</span>
                </div>
            </td>
            <td class="p-4 border-b">${d.fg}</td>
            <td class="p-4 border-b text-red-600 font-bold">${ngPcs} <br><span class="text-[10px] text-gray-500 font-normal">(${ngKg.toFixed(2)} Kg)</span></td>
            <td class="p-4 border-b">${y}%</td>`;
            
        dynamicColumns.forEach(s => { 
            const keyPcs = Object.keys(d.ngBreakdownPcs || {}).find(k => k.toLowerCase() === s.toLowerCase());
            const keyKg = Object.keys(d.ngBreakdownKg || {}).find(k => k.toLowerCase() === s.toLowerCase());
            
            const cPcs = keyPcs ? d.ngBreakdownPcs[keyPcs] : 0; 
            const cKg = keyKg ? d.ngBreakdownKg[keyKg] : 0; 
            html += `<td class="${cPcs>0?'bg-red-50 text-red-700 font-bold':''}">${cPcs>0 ? cPcs + '<br><span class="text-[10px] text-gray-500 font-normal">(' + cKg.toFixed(2) + ' Kg)</span>' : '-'}</td>`; 
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
    } else {
        document.getElementById('machine-hourly-wrapper').classList.add('hidden');
        document.getElementById('machine-daily-wrapper').classList.remove('hidden');
        if(hint) hint.classList.remove('hidden');
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
                                    let lines = ['----------------------'];
                                    Object.entries(breakdown)
                                        .filter(([k, v]) => v > 0)
                                        .sort((a, b) => b[1] - a[1])
                                        .forEach(([k, v]) => {
                                            lines.push(`  • ${k}: ${v.toLocaleString()} ชิ้น`);
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

    const dailyYields = dailyKeys.map(k => {
        const t = dailyData[k].fg + dailyData[k].ngPcs;
        return t > 0 ? parseFloat(((dailyData[k].fg / t) * 100).toFixed(1)) : 0;
    });

    machineDailyChartInst = new Chart(document.getElementById('machineDailyTrendChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: dailyKeys,
            datasets: [
                {
                    type: 'line',
                    label: '% Yield รายวัน',
                    data: dailyYields,
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    yAxisID: 'y1',
                    tension: 0.3,
                    borderWidth: 2
                },
                { label: 'FG (งานดี)', data: dailyKeys.map(k => dailyData[k].fg), backgroundColor: '#3b82f6', yAxisID: 'y', stack: 'Stack 0' },
                { label: 'NG (เสียเป็นชิ้น)', data: dailyKeys.map(k => dailyData[k].ngPcs), backgroundColor: '#ef4444', yAxisID: 'y', stack: 'Stack 0' }
            ]
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

    let html = '<ul class="divide-y divide-gray-200">';
    let total = 0;

    const sortedItems = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

    if (sortedItems.length === 0) {
        html += '<li class="py-3 text-center text-gray-500">🎉 ไม่มีของเสียในวันนี้</li>';
    } else {
        sortedItems.forEach(([type, pcs]) => {
            total += pcs;
            html += `
            <li class="py-3 flex justify-between items-center">
                <span class="text-sm font-medium text-gray-700">${type}</span>
                <span class="text-sm font-bold text-red-600">${pcs.toLocaleString()} ชิ้น</span>
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
