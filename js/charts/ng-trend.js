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

