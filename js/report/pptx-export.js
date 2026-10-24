(function () {
    const PAGE = { width: 13.333, height: 7.5 };
    const COLORS = {
        navy: '10243A', blue: '2563EB', teal: '0F766E', red: 'DC4C4C',
        green: '15803D', amber: 'D97706', text: '172B4D', muted: '64748B',
        border: 'DCE3EC', pale: 'F4F7FB', white: 'FFFFFF', lightBlue: 'EAF1FF'
    };
    const TEXT = {
        th: {
            report: 'รายงานผลการผลิตและคุณภาพ', executive: 'สำหรับผู้บริหาร', customer: 'สำหรับลูกค้า',
            period: 'ช่วงข้อมูล', filters: 'ตัวกรอง', generated: 'สร้างรายงานเมื่อ',
            summary: 'ภาพรวมผลการดำเนินงาน', target: 'เป้าหมายผลิต', fg: 'ผลิตดี (FG)',
            ng: 'ของเสีย (NG)', weightedNg: 'อัตรา NG ตามน้ำหนัก', weightedYield: 'Yield ตามน้ำหนัก',
            modelSummary: 'ภาพรวมผลการดำเนินงานแยกรุ่น', modelLabel: 'รุ่นสินค้า',
            production: 'แนวโน้มการผลิต', monthlyProduction: 'แนวโน้มการผลิตรายเดือน',
            quarterlyProduction: 'แนวโน้มการผลิตรายไตรมาส', productionAxis: 'ยอดผลิต (ชิ้น)',
            ngRateLegend: '% NG ตามน้ำหนัก', quality: 'คุณภาพและอาการ NG หลัก',
            monthlySorting: 'ผลคัดแยกรายเดือน (Sorting)', quarterlySorting: 'ผลคัดแยกรายไตรมาส (Sorting)',
            sortingAxis: 'งาน Sorting รวม (ชิ้น)', sortingCapacity: 'Capacity เฉลี่ยรวมผู้คัด',
            sortingCapacityUnit: 'ชิ้น/วันที่มีผลคัด', sortingTotalLegend: 'รวม FG + NG + รอ Sort',
            modelSortingScope: 'แยกตามรุ่นสินค้า · จัดกลุ่มตามวันที่บันทึก Sorting',
            sortingScope: 'จัดกลุ่มตามวันที่บันทึก Sorting ไม่ใช้ตัวกรองกะ',
            sortingNote: 'แท่งเดียวรวม Sort FG + Sort NG + งานรอคัด; Capacity เฉลี่ยรวมผู้คัด = FG+NG ต่อวันที่มีผลคัด · รวม Completed/Wait QC และ Pending/Rejected; ผลที่อนุมัติแล้วอาจอยู่ในยอดผลิตด้วย',
            machines: 'เครื่องจักรที่มี NG สูง', jobs: 'สถานะแผนผลิตและ Job Order',
            appendix: 'ภาคผนวก: นิยามและขอบเขตข้อมูล', fgLegend: 'FG (ชิ้น)', ngLegend: 'NG (ชิ้น)',
            pieces: 'ชิ้น', kg: 'กก.', noData: 'ไม่มีข้อมูลในหัวข้อนี้สำหรับช่วงที่เลือก',
            noWeight: 'ไม่มีข้อมูลน้ำหนักเพียงพอสำหรับคำนวณอัตรา NG',
            defectCount: 'NG แยกตามอาการ (ชิ้น)', machineNg: 'NG (ชิ้น)', job: 'Job Order',
            product: 'รุ่น', jobTarget: 'เป้าหมาย', accounted: 'ยอดสะสม', progress: 'ความคืบหน้า',
            status: 'สถานะ', cumulativeNote: 'ความคืบหน้า Job Order เป็นยอดสะสม ส่วน KPI หน้า Dashboard ยึดช่วงวันที่เลือก',
            formula: 'NG Rate = NG Kg ÷ (FG Kg + NG Kg) × 100',
            yieldFormula: 'Yield = FG Kg ÷ (FG Kg + NG Kg) × 100',
            periodMethod: 'คำนวณเปอร์เซ็นต์จากยอดรวมของช่วงที่เลือก ไม่เฉลี่ยเปอร์เซ็นต์รายวัน',
            dayBoundary: 'วันผลิตนับตั้งแต่ 08:00 ถึง 07:59 ของวันถัดไป',
            missingWeight: 'หากไม่มีข้อมูลน้ำหนัก ระบบจะแสดง N/A และไม่แทนด้วยอัตราตามจำนวนชิ้น',
            customerNote: 'ชุดลูกค้าไม่ใส่ชื่อเครื่อง, Job Order, ต้นทุน หรือบันทึกภายใน',
            executiveNote: 'ข้อมูลอิงผลการค้นหาล่าสุดใน Dashboard',
            periodGrouped: 'ยอดรวมแยกตามเดือนและไตรมาส · NG Rate คำนวณจากน้ำหนักรวมของแต่ละช่วง',
            slide: 'สไลด์', pageSource: 'CWM Production System',
            totalProduced: 'ผลิตรวม FG + NG', ngWeight: 'NG ตามน้ำหนัก', fgWeight: 'FG ตามน้ำหนัก',
            filterShift: 'กะ', filterType: 'ประเภทกะ', all: 'ทั้งหมด', stale: 'ช่องกรองเปลี่ยนแล้ว รายงานนี้ยังใช้ผลการค้นหาครั้งล่าสุด'
        },
        en: {
            report: 'Production & Quality Review', executive: 'Executive', customer: 'Customer',
            period: 'Data period', filters: 'Filters', generated: 'Generated',
            summary: 'Performance overview', target: 'Production target', fg: 'Good output (FG)',
            ng: 'Defects (NG)', weightedNg: 'Weight-based NG rate', weightedYield: 'Weight-based yield',
            modelSummary: 'Performance by product model', modelLabel: 'Product model',
            production: 'Production trend', monthlyProduction: 'Monthly production trend',
            quarterlyProduction: 'Quarterly production trend', productionAxis: 'Production (pcs)',
            ngRateLegend: 'Weight-based NG rate', quality: 'Quality & top defects',
            monthlySorting: 'Monthly sorting results', quarterlySorting: 'Quarterly sorting results',
            sortingAxis: 'Total Sorting workload (pcs)', sortingCapacity: 'Avg. capacity (all sorters)',
            sortingCapacityUnit: 'pcs/active sorting day', sortingTotalLegend: 'FG + NG + pending',
            modelSortingScope: 'By product model · grouped by Sorting record date',
            sortingScope: 'Grouped by Sorting record date; shift filters do not apply',
            sortingNote: 'Each bar combines Sorted FG + Sorted NG + pending work; average capacity includes all sorters and equals FG+NG per active sorting day · Includes Completed/Wait QC and Pending/Rejected; approved output may also appear in production totals.',
            machines: 'Machines with highest NG', jobs: 'Production plan & Job Orders',
            appendix: 'Appendix: definitions & data scope', fgLegend: 'FG (pcs)', ngLegend: 'NG (pcs)',
            pieces: 'pcs', kg: 'kg', noData: 'No data for this section in the selected period',
            noWeight: 'Insufficient weight data to calculate the NG rate',
            defectCount: 'NG by defect (pcs)', machineNg: 'NG (pcs)', job: 'Job Order',
            product: 'Product', jobTarget: 'Target', accounted: 'Accounted', progress: 'Progress',
            status: 'Status', cumulativeNote: 'Job Order progress is cumulative; Dashboard KPIs use the selected date range',
            formula: 'NG Rate = NG Kg ÷ (FG Kg + NG Kg) × 100',
            yieldFormula: 'Yield = FG Kg ÷ (FG Kg + NG Kg) × 100',
            periodMethod: 'Percentages use totals for the selected period; daily percentages are not averaged',
            dayBoundary: 'Production day runs from 08:00 to 07:59 the following day',
            missingWeight: 'When weight data is unavailable, the rate is N/A and is not replaced with a piece-based rate',
            customerNote: 'Customer decks omit machine names, Job Orders, cost data, and internal notes',
            executiveNote: 'Data reflects the most recent Dashboard search',
            periodGrouped: 'Monthly and quarterly totals · NG rate is recalculated from each period’s total weight',
            slide: 'Slide', pageSource: 'CWM Production System',
            totalProduced: 'Total FG + NG', ngWeight: 'NG by weight', fgWeight: 'FG by weight',
            filterShift: 'Shift', filterType: 'Shift type', all: 'All', stale: 'Filters have changed; this deck still uses the most recent search result'
        }
    };

    let pptxLoadPromise = null;

    function number(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatNumber(value, language, digits) {
        return number(value).toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
            minimumFractionDigits: digits || 0,
            maximumFractionDigits: digits || 0
        });
    }

    function formatAxisQuantity(value, language) {
        const amount = number(value);
        if (amount >= 1000000) return `${formatNumber(amount / 1000000, language, amount >= 10000000 ? 0 : 1)}M`;
        if (amount >= 1000) return `${formatNumber(amount / 1000, language, amount >= 100000 ? 0 : 1)}k`;
        return formatNumber(amount, language);
    }

    function formatPercent(value, language) {
        return value === null || value === undefined ? 'N/A' : `${formatNumber(value, language, 2)}%`;
    }

    function getData() {
        return (typeof currentDashboardData !== 'undefined' && currentDashboardData) ? currentDashboardData : null;
    }

    function getMeta(data) {
        const meta = data.queryMeta || {};
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');
        return Object.assign({}, meta, {
            start: meta.start || (startInput ? startInput.value : ''),
            end: meta.end || (endInput ? endInput.value : ''),
            shiftLabel: meta.shiftLabel || meta.shift || '',
            shiftTypeLabel: meta.shiftTypeLabel || meta.shiftType || ''
        });
    }

    function getPeriodLabel(meta) {
        if (meta.allTime && (meta.dataStart || meta.dataEnd)) {
            return `${meta.dataStart || '—'} – ${meta.dataEnd || '—'}`;
        }
        const start = meta.dataStart || meta.start || '—';
        const end = meta.dataEnd || meta.end || start;
        return start === end ? start : `${start} – ${end}`;
    }

    function getFiltersLabel(meta, labels) {
        const shift = !meta.shift || meta.shift === 'All' ? labels.all : (meta.shiftLabel || meta.shift);
        const type = !meta.shiftType || meta.shiftType === 'All' ? labels.all : (meta.shiftTypeLabel || meta.shiftType);
        return `${labels.filterShift}: ${shift} · ${labels.filterType}: ${type}`;
    }

    function getNgPcs(data) {
        return data.totalNgPcs !== undefined ? number(data.totalNgPcs) : number(data.totalNg);
    }

    function getWeightedRates(data) {
        const hasFgKg = data.totalFgKg !== undefined && data.totalFgKg !== null && Number.isFinite(Number(data.totalFgKg));
        const hasNgKg = data.totalNgKg !== undefined && data.totalNgKg !== null && Number.isFinite(Number(data.totalNgKg));
        const fgKg = hasFgKg ? number(data.totalFgKg) : 0;
        const ngKg = hasNgKg ? number(data.totalNgKg) : 0;
        const totalKg = fgKg + ngKg;
        const hasCompleteWeightData = hasFgKg && hasNgKg && totalKg > 0;
        return {
            fgKg: fgKg,
            ngKg: ngKg,
            ngRate: hasCompleteWeightData ? (ngKg / totalKg) * 100 : null,
            yieldRate: hasCompleteWeightData ? (fgKg / totalKg) * 100 : null
        };
    }

    function isSectionSelected(name) {
        const input = document.querySelector(`[data-pptx-section="${name}"]`);
        return !!(input && input.checked && !input.disabled);
    }

    function getModelNames(data, section) {
        const names = new Set();
        const add = value => {
            const model = String(value || '').trim();
            if (model) names.add(model);
        };
        if (!section || section === 'production' || section === 'summary' || section === 'quality' || section === 'machines') {
            Object.keys(data.productData || {}).forEach(add);
            (data.dailyTrend || []).forEach(row => Object.keys(row && row.byModel || {}).forEach(add));
        }
        if (!section || section === 'sorting') {
            (data.sortingTrend || []).forEach(row => Object.keys(row && row.byModel || {}).forEach(add));
            (data.dailyTrend || []).forEach(row => {
                Object.keys(row && row.sortByModel || {}).forEach(add);
                Object.keys(row && row.pendingSortByModel || {}).forEach(add);
            });
        }
        if (!section || section === 'jobOrders') {
            (data.jobOrders || []).forEach(job => {
                if (job && job.status !== 'Cancelled') add(job.product);
            });
        }
        return [...names].sort((a, b) => a.localeCompare(b));
    }

    function getSelectedSlideCount() {
        const data = getData() || {};
        const audience = document.getElementById('pptx-audience');
        const customer = audience && audience.value === 'customer';
        const modelCount = getModelNames(data, 'summary').length;
        let count = 2 + modelCount;
        if (isSectionSelected('production')) count += 2 + getModelNames(data, 'production').length * 2;
        if (isSectionSelected('sorting')) count += 2 + getModelNames(data, 'sorting').length * 2;
        if (isSectionSelected('quality')) count += getModelNames(data, 'quality').length + 1;
        if (!customer && isSectionSelected('machines')) count += getModelNames(data, 'machines').length + 1;
        if (!customer && isSectionSelected('jobOrders')) count += getModelNames(data, 'jobOrders').length + 1;
        if (isSectionSelected('appendix')) count += 1;
        return count;
    }

    function updateSlideCount() {
        const count = document.getElementById('pptx-slide-count');
        if (count) count.textContent = `${count.dataset.label || 'จำนวนสไลด์'}: ${getSelectedSlideCount()}`;
    }

    function updateAudienceNote() {
        const audience = document.getElementById('pptx-audience');
        const language = document.getElementById('pptx-language');
        const note = document.getElementById('pptx-audience-note');
        if (!audience || !language || !note) return;
        const labels = TEXT[language.value] || TEXT.th;
        note.textContent = audience.value === 'customer' ? labels.customerNote : labels.executiveNote;
    }

    window.applyPptxPreset = function () {
        const modal = document.getElementById('modal-pptx-export');
        const audience = document.getElementById('pptx-audience');
        if (!modal || !audience) return;

        const previous = modal.dataset.lastAudience || 'executive';
        const isCustomer = audience.value === 'customer';
        modal.querySelectorAll('[data-pptx-internal-option] input[data-pptx-section]').forEach(input => {
            if (isCustomer) {
                if (previous !== 'customer') input.dataset.executiveWasChecked = input.checked ? '1' : '0';
                input.checked = false;
                input.disabled = true;
                input.closest('[data-pptx-internal-option]').classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                if (previous === 'customer') input.checked = input.dataset.executiveWasChecked !== '0';
                input.disabled = false;
                input.closest('[data-pptx-internal-option]').classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
        modal.dataset.lastAudience = audience.value;
        updateAudienceNote();
        updateSlideCount();
    };

    window.openPptxExportModal = function () {
        const data = getData();
        if (!data) {
            alert('กรุณาค้นหาข้อมูลบน Dashboard ก่อนสร้าง PowerPoint');
            return;
        }

        const modal = document.getElementById('modal-pptx-export');
        const audience = document.getElementById('pptx-audience');
        const language = document.getElementById('pptx-language');
        const meta = getMeta(data);
        const period = getPeriodLabel(meta);
        const range = document.getElementById('pptx-data-range');
        const staleNotice = document.getElementById('pptx-stale-notice');

        audience.value = 'executive';
        language.value = 'th';
        modal.dataset.lastAudience = 'executive';
        modal.querySelectorAll('[data-pptx-section]').forEach(input => {
            input.checked = input.dataset.pptxSection !== 'summary';
            input.disabled = false;
        });
        modal.querySelectorAll('[data-pptx-internal-option]').forEach(option => {
            option.classList.remove('opacity-50', 'cursor-not-allowed');
        });

        const labels = TEXT.th;
        range.textContent = `${labels.period}: ${period} · ${getFiltersLabel(meta, labels)}`;
        const isStale = typeof window.isFilterStale === 'function' && window.isFilterStale();
        staleNotice.textContent = labels.stale;
        staleNotice.classList.toggle('hidden', !isStale);
        const count = document.getElementById('pptx-slide-count');
        count.dataset.label = language.value === 'th' ? 'จำนวนสไลด์โดยประมาณ' : 'Estimated slides';
        updateAudienceNote();
        updateSlideCount();

        modal.querySelectorAll('[data-pptx-section]').forEach(input => {
            input.onchange = updateSlideCount;
        });
        language.onchange = function () {
            const currentLabels = TEXT[language.value] || TEXT.th;
            count.dataset.label = language.value === 'th' ? 'จำนวนสไลด์โดยประมาณ' : 'Estimated slides';
            range.textContent = `${currentLabels.period}: ${period} · ${getFiltersLabel(meta, currentLabels)}`;
            staleNotice.textContent = currentLabels.stale;
            updateAudienceNote();
            updateSlideCount();
        };

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    window.closePptxExportModal = function () {
        const modal = document.getElementById('modal-pptx-export');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    function loadPptxGenJs() {
        if (typeof window.PptxGenJS === 'function') return Promise.resolve(window.PptxGenJS);
        if (pptxLoadPromise) return pptxLoadPromise;

        pptxLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // Keep export independent of third-party CDN access on the user's network.
            script.src = 'js/vendor/pptxgen.bundle.js?v=3.12.0';
            script.onload = function () {
                if (typeof window.PptxGenJS === 'function') resolve(window.PptxGenJS);
                else {
                    pptxLoadPromise = null;
                    reject(new Error('PowerPoint library loaded without its browser API'));
                }
            };
            script.onerror = function () {
                pptxLoadPromise = null;
                reject(new Error('Unable to load the PowerPoint generation library'));
            };
            document.head.appendChild(script);
        });
        return pptxLoadPromise;
    }

    function addText(slide, text, options) {
        slide.addText(String(text === undefined || text === null ? '' : text), Object.assign({
            fontFace: 'Tahoma', color: COLORS.text, margin: 0, breakLine: false,
            valign: 'mid', fit: 'shrink'
        }, options || {}));
    }

    function addShape(slide, pptx, type, options) {
        slide.addShape((pptx.ShapeType && pptx.ShapeType[type]) || type, options);
    }

    function addBase(slide, pptx, title, subtitle, deck) {
        slide.background = { color: COLORS.white };
        addShape(slide, pptx, 'rect', {
            x: 0, y: 0, w: PAGE.width, h: 0.12,
            line: { color: COLORS.blue, transparency: 100 }, fill: { color: COLORS.blue }
        });
        addText(slide, title, { x: 0.72, y: 0.45, w: 11.9, h: 0.45, fontFace: 'Tahoma', fontSize: 24, bold: true });
        if (subtitle) addText(slide, subtitle, { x: 0.74, y: 0.98, w: 11.8, h: 0.28, fontSize: 10, color: COLORS.muted });
        addShape(slide, pptx, 'rect', {
            x: 0.72, y: 7.04, w: 11.9, h: 0.012,
            line: { color: COLORS.border, transparency: 100 }, fill: { color: COLORS.border }
        });
        const audienceLabel = deck.audience === 'customer' ? deck.labels.customer.toUpperCase() : deck.labels.executive.toUpperCase();
        addText(slide, `${deck.labels.pageSource} · ${deck.period} · ${audienceLabel}`, { x: 0.74, y: 7.09, w: 10.5, h: 0.2, fontSize: 8, color: COLORS.muted });
        addText(slide, String(deck.page), { x: 11.9, y: 7.08, w: 0.6, h: 0.2, align: 'right', fontSize: 8, color: COLORS.muted });
    }

    function addCover(deck) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        slide.background = { color: COLORS.navy };
        addShape(slide, deck.pptx, 'rect', {
            x: 0, y: 0, w: 0.22, h: PAGE.height,
            line: { color: COLORS.teal, transparency: 100 }, fill: { color: COLORS.teal }
        });
        addShape(slide, deck.pptx, 'rect', {
            x: 9.8, y: 0, w: 3.533, h: PAGE.height,
            line: { color: '152F4D', transparency: 100 }, fill: { color: '152F4D' }
        });
        addText(slide, 'CWM · PRODUCTION SYSTEM', { x: 0.92, y: 0.86, w: 6.5, h: 0.32, fontSize: 12, bold: true, charSpacing: 1.2, color: 'AFC8E8' });
        addText(slide, deck.labels.report, { x: 0.9, y: 2.08, w: 8.2, h: 1.05, fontFace: 'Tahoma', fontSize: 31, bold: true, color: COLORS.white, valign: 'bottom' });
        addText(slide, deck.audience === 'customer' ? deck.labels.customer : deck.labels.executive, { x: 0.94, y: 3.24, w: 6.4, h: 0.38, fontSize: 17, color: '74D4C8', bold: true });
        addText(slide, `${deck.labels.period}: ${deck.period}`, { x: 0.94, y: 4.18, w: 7.9, h: 0.45, fontSize: 16, color: COLORS.white, bold: true });
        addText(slide, deck.filters, { x: 0.94, y: 4.76, w: 7.9, h: 0.42, fontSize: 11, color: 'D8E4F2' });
        addText(slide, `${deck.labels.generated}: ${deck.generatedAt}`, { x: 0.94, y: 6.72, w: 7.8, h: 0.24, fontSize: 9, color: 'AFC8E8' });
        addShape(slide, deck.pptx, 'rect', {
            x: 10.38, y: 1.63, w: 1.9, h: 1.9,
            line: { color: '31577B', width: 1.5 }, fill: { color: '183550' }
        });
        addText(slide, 'CWM', { x: 10.47, y: 2.17, w: 1.72, h: 0.58, fontFace: 'Tahoma', fontSize: 30, bold: true, align: 'center', color: COLORS.white });
    }

    function addMetricCard(slide, pptx, x, y, w, h, label, value, detail, accent) {
        addShape(slide, pptx, 'roundRect', {
            x: x, y: y, w: w, h: h,
            line: { color: COLORS.border, width: 1 }, fill: { color: COLORS.white }
        });
        addShape(slide, pptx, 'rect', {
            x: x, y: y, w: 0.09, h: h,
            line: { color: accent, transparency: 100 }, fill: { color: accent }
        });
        addText(slide, label, { x: x + 0.25, y: y + 0.19, w: w - 0.45, h: 0.25, fontSize: 10, bold: true, color: COLORS.muted });
        addText(slide, value, { x: x + 0.25, y: y + 0.54, w: w - 0.45, h: 0.48, fontFace: 'Tahoma', fontSize: 25, bold: true, color: accent });
        if (detail) addText(slide, detail, { x: x + 0.25, y: y + h - 0.36, w: w - 0.45, h: 0.2, fontSize: 8.5, color: COLORS.muted });
    }

    function getModelProductionData(data, model) {
        const product = data.productData && data.productData[model] || {};
        const totalFg = number(product.fg);
        const totalNgPcs = number(product.ngTotalPcs);
        const hasStrictWeight = typeof window.getWppStrict === 'function'
            && typeof window.getKgFromPcs === 'function'
            && window.getWppStrict(model) !== null;
        const totalFgKg = hasStrictWeight ? window.getKgFromPcs(model, totalFg) : null;
        const backendNgKg = Number(product.ngTotalKg);
        const totalNgKg = hasStrictWeight
            ? (Number.isFinite(backendNgKg) ? backendNgKg : window.getKgFromPcs(model, totalNgPcs))
            : null;
        return {
            totalFg: totalFg,
            totalNgPcs: totalNgPcs,
            totalFgKg: totalFgKg,
            totalNgKg: totalNgKg
        };
    }

    function addSummarySlide(deck, data, model) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        const title = model ? `${deck.labels.modelSummary} · ${model}` : deck.labels.summary;
        addBase(slide, deck.pptx, title, `${deck.labels.period}: ${deck.period} · ${deck.filters}`, deck);

        const fg = number(data.totalFg);
        const ng = getNgPcs(data);
        const rates = getWeightedRates(data);
        const x = [1.12, 6.85], w = 5.35, h = 1.48;
        const y = [1.78, 3.52];
        addMetricCard(slide, deck.pptx, x[0], y[0], w, h, deck.labels.fg, `${formatNumber(fg, deck.language)} ${deck.labels.pieces}`, `${deck.labels.fgWeight}: ${formatNumber(rates.fgKg, deck.language, 2)} ${deck.labels.kg}`, COLORS.green);
        addMetricCard(slide, deck.pptx, x[1], y[0], w, h, deck.labels.ng, `${formatNumber(ng, deck.language)} ${deck.labels.pieces}`, `${deck.labels.ngWeight}: ${formatNumber(rates.ngKg, deck.language, 2)} ${deck.labels.kg}`, COLORS.red);
        addMetricCard(slide, deck.pptx, x[0], y[1], w, h, deck.labels.weightedYield, formatPercent(rates.yieldRate, deck.language), '', COLORS.green);
        addMetricCard(slide, deck.pptx, x[1], y[1], w, h, deck.labels.weightedNg, formatPercent(rates.ngRate, deck.language), '', COLORS.teal);

        addShape(slide, deck.pptx, 'roundRect', {
            x: 0.82, y: 5.44, w: 11.69, h: 0.68,
            line: { color: 'D8E7F4', width: 0.7 }, fill: { color: 'F3F8FC' }
        });
        addText(slide, rates.ngRate === null ? deck.labels.noWeight : deck.labels.formula, {
            x: 1.04, y: 5.66, w: 11.2, h: 0.24, fontSize: 10, color: COLORS.text, bold: true, align: 'center'
        });
    }

    function formatGroupedPeriodLabel(key, period, language, fallback) {
        if (period === 'month' && language === 'en') {
            const match = String(key).match(/^(\d{4})-(\d{2})$/);
            if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
        } else if (period === 'quarter' && language === 'en') {
            const match = String(key).match(/^(\d{4})-Q([1-4])$/);
            if (match) return `Q${match[2]} ${match[1]}`;
        }
        return fallback;
    }

    function getTrendBuckets(data, period, language, model) {
        const getWppStrict = window.getWppStrict;
        const getKgFromPcs = window.getKgFromPcs;
        const rows = (data.dailyTrend || []).filter(row => row && row.date).map(row => {
            let fgKg = 0;
            let ngKg = 0;
            let weightComplete = typeof getWppStrict === 'function' && typeof getKgFromPcs === 'function';
            const models = row.byModel && typeof row.byModel === 'object' ? Object.entries(row.byModel) : [];
            if ((number(row.fg) > 0 || number(row.ng) > 0) && !models.length) weightComplete = false;

            models.forEach(([modelName, values]) => {
                if (model && modelName !== model) return;
                const fgPcs = number(values && values.fg);
                const ngPcs = values && values.ng !== undefined ? number(values.ng) : number(values && values.ngPcs);
                if (fgPcs <= 0 && ngPcs <= 0) return;
                if (typeof getWppStrict !== 'function' || getWppStrict(modelName) === null) {
                    weightComplete = false;
                    return;
                }
                fgKg += getKgFromPcs(modelName, fgPcs);
                ngKg += getKgFromPcs(modelName, ngPcs);
            });

            const modelValues = model && row.byModel && row.byModel[model];
            const fg = model ? number(modelValues && modelValues.fg) : number(row.fg);
            const ng = model ? number(modelValues && (modelValues.ng !== undefined ? modelValues.ng : modelValues.ngPcs)) : number(row.ng);
            return {
                date: row.date,
                fg: fg,
                ng: ng,
                fgKg: fgKg,
                ngKg: ngKg,
                weightComplete: weightComplete
            };
        });

        if (typeof window.groupRowsByPeriod !== 'function') return [];
        return window.groupRowsByPeriod(rows, period, row => row.date,
            () => ({ fg: 0, ng: 0, fgKg: 0, ngKg: 0, weightComplete: true }),
            (bucket, row) => {
                bucket.fg += row.fg;
                bucket.ng += row.ng;
                bucket.fgKg += row.fgKg;
                bucket.ngKg += row.ngKg;
                bucket.weightComplete = bucket.weightComplete && row.weightComplete;
            }
        ).map(bucket => {
            const totalKg = bucket.fgKg + bucket.ngKg;
            return Object.assign(bucket, {
                label: formatGroupedPeriodLabel(bucket.key, period, language, bucket.label),
                ngRate: bucket.weightComplete && totalKg > 0 ? (bucket.ngKg / totalKg) * 100 : null
            });
        });
    }

    function getSortingBuckets(data, period, language, model) {
        const currentRows = Array.isArray(data.sortingTrend) && data.sortingTrend.length
            ? data.sortingTrend
            : (data.dailyTrend || []).map(row => ({
                date: row.date,
                fgPcs: row.sortYield && row.sortYield.fg,
                ngPcs: row.sortYield && row.sortYield.ng,
                pendingPcs: row.pendingSortQty,
                byModel: Object.fromEntries([...new Set([
                    ...Object.keys(row.sortByModel || {}),
                    ...Object.keys(row.pendingSortByModel || {})
                ])].map(name => [name, {
                    fgPcs: number(row.sortByModel && row.sortByModel[name] && row.sortByModel[name].fg),
                    ngPcs: number(row.sortByModel && row.sortByModel[name] && row.sortByModel[name].ng),
                    pendingPcs: number(row.pendingSortByModel && row.pendingSortByModel[name] && row.pendingSortByModel[name].qty)
                }]))
            }));
        const dailyByDate = new Map((data.dailyTrend || []).map(row => [row && row.date, row]));
        const rows = currentRows.filter(row => row && row.date).map(row => {
            if (row.byModel) return row;
            const daily = dailyByDate.get(row.date) || {};
            const modelNames = new Set([
                ...Object.keys(daily.sortByModel || {}),
                ...Object.keys(daily.pendingSortByModel || {})
            ]);
            const byModel = {};
            modelNames.forEach(name => {
                const sorted = daily.sortByModel && daily.sortByModel[name] || {};
                const pending = daily.pendingSortByModel && daily.pendingSortByModel[name] || {};
                byModel[name] = { fgPcs: sorted.fg || 0, ngPcs: sorted.ng || 0, pendingPcs: pending.qty || 0 };
            });
            return Object.assign({}, row, { byModel: byModel });
        });
        if (typeof window.groupRowsByPeriod !== 'function') return [];
        return window.groupRowsByPeriod(rows, period, row => row.date,
            () => ({ fgPcs: 0, ngPcs: 0, pendingPcs: 0, activeDays: 0 }),
            (bucket, row) => {
                const values = model && row.byModel && row.byModel[model];
                const fgPcs = model ? number(values && (values.fgPcs !== undefined ? values.fgPcs : values.fg)) : number(row.fgPcs !== undefined ? row.fgPcs : row.fg);
                const ngPcs = model ? number(values && (values.ngPcs !== undefined ? values.ngPcs : values.ng)) : number(row.ngPcs !== undefined ? row.ngPcs : row.ng);
                bucket.pendingPcs += model ? number(values && (values.pendingPcs !== undefined ? values.pendingPcs : values.pending)) : number(row.pendingPcs !== undefined ? row.pendingPcs : row.pending);
                bucket.fgPcs += fgPcs;
                bucket.ngPcs += ngPcs;
                if (fgPcs + ngPcs > 0) bucket.activeDays += 1;
            }
        ).map(bucket => Object.assign(bucket, {
            label: formatGroupedPeriodLabel(bucket.key, period, language, bucket.label)
        }));
    }

    function addLegend(slide, pptx, x, y, color, label, width) {
        addShape(slide, pptx, 'rect', {
            x: x, y: y + 0.035, w: 0.14, h: 0.14,
            line: { color: color, transparency: 100 }, fill: { color: color }
        });
        addText(slide, label, { x: x + 0.22, y, w: width || 1.25, h: 0.22, fontSize: 8.5, color: COLORS.muted });
    }

    function addProductionSlide(deck, data, period, model) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        const title = period === 'month' ? deck.labels.monthlyProduction : deck.labels.quarterlyProduction;
        addBase(slide, deck.pptx, model ? `${title} · ${model}` : title, `${deck.labels.period}: ${deck.period} · ${deck.filters}`, deck);
        const buckets = getTrendBuckets(data, period, deck.language, model);
        if (!buckets.length) {
            addText(slide, deck.labels.noData, { x: 1.1, y: 3.0, w: 11.0, h: 0.6, fontSize: 18, align: 'center', color: COLORS.muted });
            return;
        }

        addText(slide, deck.labels.productionAxis, { x: 0.78, y: 1.52, w: 2.5, h: 0.22, fontSize: 8.5, color: COLORS.muted });
        addLegend(slide, deck.pptx, 7.12, 1.52, COLORS.blue, deck.labels.fgLegend, 0.8);
        addLegend(slide, deck.pptx, 8.45, 1.52, COLORS.red, deck.labels.ngLegend, 0.8);
        addShape(slide, deck.pptx, 'line', {
            x: 9.82, y: 1.62, w: 0.28, h: 0,
            line: { color: '7C3AED', width: 2.2 }
        });
        addShape(slide, deck.pptx, 'ellipse', {
            x: 9.92, y: 1.57, w: 0.1, h: 0.1,
            line: { color: '7C3AED', width: 1 }, fill: { color: 'FFFFFF' }
        });
        addText(slide, deck.labels.ngRateLegend, { x: 10.18, y: 1.52, w: 2.2, h: 0.22, fontSize: 8.5, color: COLORS.muted });

        const chartX = 1.22, chartW = 10.78, topY = 1.96, baseY = 5.82, chartH = baseY - topY;
        const maxValue = Math.max(1, ...buckets.map(row => row.fg + row.ng));
        const rawStep = maxValue / 5;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const valueStep = Math.ceil(rawStep / magnitude) * magnitude;
        const axisMaxValue = valueStep * 5;
        const validRates = buckets.map(row => row.ngRate).filter(value => value !== null);
        const maxRate = validRates.length ? Math.max(...validRates) : 0;
        const rateMax = Math.min(100, Math.max(5, Math.ceil(maxRate / 5) * 5));
        const slotW = chartW / buckets.length;
        const barW = Math.min(1.0, slotW * 0.48);
        const axisFontSize = buckets.length > 15 ? 6.2 : (buckets.length > 10 ? 7 : 8);
        const points = [];

        for (let tick = 0; tick <= 5; tick++) {
            const ratio = tick / 5;
            const y = baseY - ratio * chartH;
            addShape(slide, deck.pptx, 'line', {
                x: chartX, y: y, w: chartW, h: 0,
                line: { color: tick === 0 ? COLORS.border : 'EDF1F6', width: tick === 0 ? 1 : 0.6 }
            });
            addText(slide, formatAxisQuantity(valueStep * tick, deck.language), {
                x: 0.54, y: y - 0.1, w: 0.58, h: 0.18, fontSize: 7.5, align: 'right', color: COLORS.muted
            });
            addText(slide, `${formatNumber(rateMax * ratio, deck.language, 0)}%`, {
                x: 12.1, y: y - 0.1, w: 0.62, h: 0.18, fontSize: 7.5, align: 'left', color: COLORS.muted
            });
        }
        addShape(slide, deck.pptx, 'line', {
            x: chartX, y: topY, w: 0, h: chartH,
            line: { color: 'B8C2D0', width: 0.8 }
        });
        addShape(slide, deck.pptx, 'line', {
            x: chartX + chartW, y: topY, w: 0, h: chartH,
            line: { color: 'B8C2D0', width: 0.8 }
        });

        buckets.forEach((row, index) => {
            const x = chartX + (index * slotW) + ((slotW - barW) / 2);
            const fgH = (row.fg / axisMaxValue) * chartH;
            const ngH = (row.ng / axisMaxValue) * chartH;
            if (fgH > 0) {
                addShape(slide, deck.pptx, 'rect', {
                    x: x, y: baseY - fgH, w: barW, h: fgH,
                    line: { color: COLORS.blue, transparency: 100 }, fill: { color: COLORS.blue }
                });
            }
            if (ngH > 0) {
                addShape(slide, deck.pptx, 'rect', {
                    x: x, y: baseY - fgH - ngH, w: barW, h: ngH,
                    line: { color: COLORS.red, transparency: 100 }, fill: { color: COLORS.red }
                });
            }
            const total = row.fg + row.ng;
            addText(slide, formatNumber(total, deck.language), {
                x: chartX + (index * slotW), y: Math.max(topY + 0.04, baseY - fgH - ngH - 0.22),
                w: slotW, h: 0.17, fontSize: axisFontSize, bold: true, align: 'center', color: COLORS.text
            });
            addText(slide, row.label, {
                x: chartX + (index * slotW), y: baseY + 0.12, w: slotW, h: 0.32,
                fontSize: axisFontSize, align: 'center', color: COLORS.muted
            });
            if (row.ngRate !== null) {
                points.push({
                    x: chartX + (index * slotW) + (slotW / 2),
                    y: baseY - (Math.min(row.ngRate, rateMax) / rateMax) * chartH,
                    rate: row.ngRate
                });
            } else {
                points.push(null);
            }
        });

        for (let index = 0; index < points.length - 1; index++) {
            const a = points[index], b = points[index + 1];
            if (!a || !b) continue;
            const top = Math.min(a.y, b.y);
            const risingToRight = b.y < a.y;
            addShape(slide, deck.pptx, risingToRight ? 'lineInv' : 'line', {
                x: a.x, y: top, w: b.x - a.x, h: Math.max(0.002, Math.abs(b.y - a.y)),
                line: { color: '7C3AED', width: 2.2 }
            });
        }
        points.forEach(point => {
            if (!point) return;
            addShape(slide, deck.pptx, 'ellipse', {
                x: point.x - 0.055, y: point.y - 0.055, w: 0.11, h: 0.11,
                line: { color: '7C3AED', width: 1.3 }, fill: { color: COLORS.white }
            });
            addText(slide, formatPercent(point.rate, deck.language), {
                x: point.x - 0.33, y: point.y <= topY + 0.25 ? point.y + 0.09 : point.y - 0.23,
                w: 0.66, h: 0.16, fontSize: 7, bold: true, align: 'center', color: '6D28D9',
                fill: { color: COLORS.white, transparency: 10 }
            });
        });

        addText(slide, validRates.length ? deck.labels.periodGrouped : deck.labels.noWeight, {
            x: 0.95, y: 6.45, w: 11.3, h: 0.22, fontSize: 8.5, color: COLORS.muted, italic: true
        });
    }

    function addSortingSlide(deck, data, period, model) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        const title = period === 'month' ? deck.labels.monthlySorting : deck.labels.quarterlySorting;
        const scope = model ? deck.labels.modelSortingScope : deck.labels.sortingScope;
        addBase(slide, deck.pptx, model ? `${title} · ${model}` : title, `${deck.labels.period}: ${deck.period} · ${scope}`, deck);
        const buckets = getSortingBuckets(data, period, deck.language, model);
        if (!buckets.length || !buckets.some(row => row.fgPcs + row.ngPcs + row.pendingPcs > 0)) {
            addText(slide, deck.labels.noData, { x: 1.1, y: 3.0, w: 11.0, h: 0.6, fontSize: 18, align: 'center', color: COLORS.muted });
            return;
        }

        const totalSorted = buckets.reduce((sum, row) => sum + row.fgPcs + row.ngPcs, 0);
        const activeDays = buckets.reduce((sum, row) => sum + row.activeDays, 0);
        const avgCapacity = activeDays > 0 ? formatNumber(totalSorted / activeDays, deck.language, 0) : 'N/A';
        addText(slide, `${deck.labels.sortingAxis} · ${deck.labels.sortingCapacity}: ${avgCapacity} ${deck.labels.sortingCapacityUnit}`, {
            x: 0.78, y: 1.52, w: 6.1, h: 0.22, fontSize: 8.5, color: COLORS.muted
        });
        addLegend(slide, deck.pptx, 10.05, 1.52, COLORS.blue, deck.labels.sortingTotalLegend, 2.25);

        const chartX = 1.22, chartW = 10.78, topY = 1.96, baseY = 5.82, chartH = baseY - topY;
        const maxValue = Math.max(1, ...buckets.map(row => row.fgPcs + row.ngPcs + row.pendingPcs));
        const rawStep = maxValue / 5;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const valueStep = Math.ceil(rawStep / magnitude) * magnitude;
        const axisMaxValue = valueStep * 5;
        const slotW = chartW / buckets.length;
        const barW = Math.min(1.0, slotW * 0.48);
        const axisFontSize = buckets.length > 15 ? 6.2 : (buckets.length > 10 ? 7 : 8);
        for (let tick = 0; tick <= 5; tick++) {
            const y = baseY - (tick / 5) * chartH;
            addShape(slide, deck.pptx, 'line', {
                x: chartX, y: y, w: chartW, h: 0,
                line: { color: tick === 0 ? COLORS.border : 'EDF1F6', width: tick === 0 ? 1 : 0.6 }
            });
            addText(slide, formatAxisQuantity(valueStep * tick, deck.language), {
                x: 0.54, y: y - 0.1, w: 0.58, h: 0.18, fontSize: 7.5, align: 'right', color: COLORS.muted
            });
        }

        buckets.forEach((row, index) => {
            const slotX = chartX + (index * slotW);
            const x = slotX + ((slotW - barW) / 2);
            const totalWorkload = row.fgPcs + row.ngPcs + row.pendingPcs;
            const barH = (totalWorkload / axisMaxValue) * chartH;
            if (barH > 0) {
                addShape(slide, deck.pptx, 'rect', {
                    x: x, y: baseY - barH, w: barW, h: barH,
                    line: { color: COLORS.blue, transparency: 100 }, fill: { color: COLORS.blue }
                });
            }
            if (totalWorkload > 0) {
                addText(slide, formatNumber(totalWorkload, deck.language), {
                    x: slotX, y: Math.max(topY + 0.04, baseY - barH - 0.22),
                    w: slotW, h: 0.17, fontSize: axisFontSize, bold: true, align: 'center', color: COLORS.text
                });
            }
            addText(slide, row.label, {
                x: slotX, y: baseY + 0.12, w: slotW, h: 0.32,
                fontSize: axisFontSize, align: 'center', color: COLORS.muted
            });
        });

        addText(slide, deck.labels.sortingNote, {
            x: 0.95, y: 6.4, w: 11.3, h: 0.3, fontSize: 7.7, color: COLORS.muted, italic: true
        });
    }

    function addQualitySlide(deck, data, model) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, model ? `${deck.labels.quality} · ${model}` : deck.labels.quality, deck.labels.defectCount, deck);

        const rates = getWeightedRates(model ? getModelProductionData(data, model) : data);
        addText(slide, deck.labels.weightedNg, { x: 0.9, y: 1.48, w: 3.3, h: 0.27, fontSize: 10, bold: true, color: COLORS.muted });
        addText(slide, formatPercent(rates.ngRate, deck.language), { x: 0.9, y: 1.82, w: 3.3, h: 0.66, fontFace: 'Tahoma', fontSize: 34, bold: true, color: COLORS.red });
        addText(slide, `${deck.labels.ngWeight}: ${formatNumber(rates.ngKg, deck.language, 2)} ${deck.labels.kg} · ${deck.labels.fgWeight}: ${formatNumber(rates.fgKg, deck.language, 2)} ${deck.labels.kg}`, { x: 0.92, y: 2.5, w: 11.3, h: 0.22, fontSize: 8.5, color: COLORS.muted });

        const modelDefects = model && data.productData && data.productData[model] && data.productData[model].ngBreakdownPcs;
        const labels = model ? Object.keys(modelDefects || {}) : (data.ngLabels || []);
        const values = model ? labels.map(label => modelDefects[label]) : (data.ngValuesPcs || data.ngValues || []);
        const rows = labels.map((label, index) => ({ label: String(label), value: number(values[index]) }))
            .filter(row => row.value > 0)
            .sort((a, b) => b.value - a.value);
        const top = rows.slice(0, 7);
        if (rows.length > 7) top.push({ label: deck.language === 'th' ? 'อาการอื่น ๆ' : 'Other defects', value: rows.slice(7).reduce((sum, row) => sum + row.value, 0) });
        if (!top.length) {
            addText(slide, deck.labels.noData, { x: 1.1, y: 4.05, w: 11.0, h: 0.5, fontSize: 16, align: 'center', color: COLORS.muted });
            if (rates.ngRate === null) addText(slide, deck.labels.noWeight, { x: 1.0, y: 5.0, w: 11.2, h: 0.3, fontSize: 10, align: 'center', color: COLORS.muted });
            return;
        }

        const chartTop = 3.05, rowH = 0.45, labelX = 0.95, labelW = 3.15, barX = 4.28, barW = 6.95;
        const maxValue = Math.max(1, ...top.map(row => row.value));
        top.forEach((row, index) => {
            const y = chartTop + index * rowH;
            addText(slide, row.label, { x: labelX, y, w: labelW, h: 0.36, fontSize: 8, color: COLORS.text, valign: 'mid', fit: 'shrink' });
            addShape(slide, deck.pptx, 'roundRect', {
                x: barX, y: y + 0.055, w: barW, h: 0.2,
                line: { color: 'EDF1F6', transparency: 100 }, fill: { color: 'EDF1F6' }
            });
            const valueW = Math.max(0.035, (row.value / maxValue) * barW);
            addShape(slide, deck.pptx, 'roundRect', {
                x: barX, y: y + 0.055, w: valueW, h: 0.2,
                line: { color: COLORS.red, transparency: 100 }, fill: { color: COLORS.red }
            });
            addText(slide, formatNumber(row.value, deck.language), { x: 11.38, y: y + 0.02, w: 1.05, h: 0.26, fontSize: 8.5, bold: true, align: 'right', color: COLORS.text });
        });
    }

    function addMachineSlide(deck, data, model) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, model ? `${deck.labels.machines} · ${model}` : deck.labels.machines, deck.labels.machineNg, deck);
        const rows = Object.entries(data.machineData || {}).map(([name, item]) => ({
            name: name,
            ng: model ? number(item.byModel && item.byModel[model] && item.byModel[model].ngPcs)
                : (item.ngTotalPcs !== undefined ? number(item.ngTotalPcs) : number(item.ngTotal)),
            ngKg: model ? number(item.byModel && item.byModel[model] && item.byModel[model].ngKg) : number(item.ngTotalKg)
        })).filter(row => row.ng > 0).sort((a, b) => b.ng - a.ng).slice(0, 8);
        if (!rows.length) {
            addText(slide, deck.labels.noData, { x: 1.1, y: 3.0, w: 11.0, h: 0.6, fontSize: 18, align: 'center', color: COLORS.muted });
            return;
        }

        const maxValue = Math.max(1, ...rows.map(row => row.ng));
        rows.forEach((row, index) => {
            const y = 1.62 + index * 0.57;
            addText(slide, row.name, { x: 0.95, y, w: 1.45, h: 0.28, fontSize: 10, bold: true });
            addShape(slide, deck.pptx, 'roundRect', {
                x: 2.55, y: y + 0.04, w: 7.7, h: 0.22,
                line: { color: 'EDF1F6', transparency: 100 }, fill: { color: 'EDF1F6' }
            });
            addShape(slide, deck.pptx, 'roundRect', {
                x: 2.55, y: y + 0.04, w: Math.max(0.04, (row.ng / maxValue) * 7.7), h: 0.22,
                line: { color: COLORS.amber, transparency: 100 }, fill: { color: COLORS.amber }
            });
            addText(slide, `${formatNumber(row.ng, deck.language)} ${deck.labels.pieces}`, { x: 10.43, y, w: 1.25, h: 0.25, fontSize: 9, bold: true, align: 'right' });
            addText(slide, `${formatNumber(row.ngKg, deck.language, 2)} ${deck.labels.kg}`, { x: 11.78, y, w: 0.62, h: 0.25, fontSize: 8, align: 'right', color: COLORS.muted });
        });
    }

    function addJobOrderSlide(deck, data, model) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, model ? `${deck.labels.jobs} · ${model}` : deck.labels.jobs, deck.labels.cumulativeNote, deck);
        const jobs = (data.jobOrders || []).filter(job => job && job.status !== 'Cancelled' && (!model || String(job.product || '').trim() === model)).slice();
        if (!jobs.length) {
            addText(slide, deck.labels.noData, { x: 1.1, y: 3.0, w: 11.0, h: 0.6, fontSize: 18, align: 'center', color: COLORS.muted });
            return;
        }

        const rows = jobs.map(job => {
            const qty = typeof window.getJobOrderQty === 'function'
                ? window.getJobOrderQty(job)
                : { accounted: number(job.accountedPcs), complete: !!job.qtyComplete };
            const target = number(job.targetQty);
            const accounted = number(qty.accounted);
            return {
                job: String(job.jobOrder || '—'),
                product: String(job.product || '—'),
                target: target,
                accounted: accounted,
                progress: target > 0 ? Math.min(100, (accounted / target) * 100) : 0,
                status: String(job.status || '—')
            };
        }).sort((a, b) => a.progress - b.progress).slice(0, 7);

        const headers = [
            { label: deck.labels.job, x: 0.95, w: 2.0, align: 'left' },
            { label: deck.labels.product, x: 3.05, w: 3.1, align: 'left' },
            { label: deck.labels.jobTarget, x: 6.25, w: 1.35, align: 'right' },
            { label: deck.labels.accounted, x: 7.72, w: 1.45, align: 'right' },
            { label: deck.labels.progress, x: 9.3, w: 1.35, align: 'right' },
            { label: deck.labels.status, x: 10.83, w: 1.48, align: 'right' }
        ];
        addShape(slide, deck.pptx, 'rect', { x: 0.87, y: 1.55, w: 11.62, h: 0.45, line: { color: COLORS.navy, transparency: 100 }, fill: { color: COLORS.navy } });
        headers.forEach(header => addText(slide, header.label, { x: header.x, y: 1.67, w: header.w, h: 0.18, fontSize: 8, bold: true, color: COLORS.white, align: header.align }));

        rows.forEach((row, index) => {
            const y = 2.05 + index * 0.54;
            if (index % 2 === 0) addShape(slide, deck.pptx, 'rect', { x: 0.87, y: y - 0.04, w: 11.62, h: 0.48, line: { color: 'F7F9FC', transparency: 100 }, fill: { color: 'F7F9FC' } });
            addText(slide, row.job, { x: headers[0].x, y, w: headers[0].w, h: 0.22, fontSize: 8.5, bold: true });
            addText(slide, row.product, { x: headers[1].x, y, w: headers[1].w, h: 0.22, fontSize: 8 });
            addText(slide, formatNumber(row.target, deck.language), { x: headers[2].x, y, w: headers[2].w, h: 0.22, fontSize: 8.5, align: 'right' });
            addText(slide, formatNumber(row.accounted, deck.language), { x: headers[3].x, y, w: headers[3].w, h: 0.22, fontSize: 8.5, align: 'right' });
            addText(slide, formatPercent(row.progress, deck.language), { x: headers[4].x, y, w: headers[4].w, h: 0.22, fontSize: 8.5, bold: true, align: 'right', color: row.progress >= 100 ? COLORS.green : COLORS.blue });
            addText(slide, row.status, { x: headers[5].x, y, w: headers[5].w, h: 0.22, fontSize: 8, align: 'right', color: COLORS.muted });
        });
    }

    function addAppendixSlide(deck, data) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, deck.labels.appendix, `${deck.labels.period}: ${deck.period} · ${deck.filters}`, deck);
        const rates = getWeightedRates(data);
        const items = [
            deck.labels.formula,
            deck.labels.yieldFormula,
            deck.labels.periodMethod,
            deck.labels.dayBoundary,
            deck.labels.missingWeight
        ];
        items.forEach((item, index) => {
            const y = 1.62 + index * 0.76;
            addShape(slide, deck.pptx, 'roundRect', {
                x: 0.92, y, w: 11.5, h: 0.56,
                line: { color: COLORS.border, width: 0.7 }, fill: { color: index % 2 === 0 ? 'F7F9FC' : COLORS.white }
            });
            addShape(slide, deck.pptx, 'rect', { x: 0.92, y, w: 0.07, h: 0.56, line: { color: COLORS.teal, transparency: 100 }, fill: { color: COLORS.teal } });
            addText(slide, item, { x: 1.18, y: y + 0.1, w: 10.9, h: 0.32, fontSize: 10, color: COLORS.text });
        });
        addText(slide, `${deck.labels.weightedNg}: ${formatPercent(rates.ngRate, deck.language)}`, { x: 0.95, y: 5.72, w: 11.2, h: 0.26, fontSize: 10, bold: true, color: rates.ngRate === null ? COLORS.muted : COLORS.red });
    }

    window.generatePptxPresentation = async function () {
        const data = getData();
        if (!data) {
            alert('กรุณาค้นหาข้อมูลบน Dashboard ก่อนสร้าง PowerPoint');
            return;
        }

        const button = document.getElementById('btn-generate-pptx');
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'กำลังสร้างไฟล์...';
        try {
            const PptxGenJS = await loadPptxGenJs();
            const language = document.getElementById('pptx-language').value === 'en' ? 'en' : 'th';
            const labels = TEXT[language];
            const audience = document.getElementById('pptx-audience').value === 'customer' ? 'customer' : 'executive';
            const meta = getMeta(data);
            const pptx = new PptxGenJS();
            pptx.layout = 'LAYOUT_WIDE';
            pptx.author = 'CWM Production System';
            pptx.company = 'CWM';
            pptx.subject = `${labels.report} · ${getPeriodLabel(meta)}`;
            pptx.title = `${labels.report} - ${audience}`;
            pptx.lang = language === 'th' ? 'th-TH' : 'en-US';
            pptx.theme = {
                headFontFace: 'Tahoma', bodyFontFace: 'Tahoma', lang: pptx.lang
            };

            const now = new Date();
            const deck = {
                pptx: pptx,
                language: language,
                labels: labels,
                audience: audience,
                period: getPeriodLabel(meta),
                filters: getFiltersLabel(meta, labels),
                generatedAt: now.toLocaleString(language === 'th' ? 'th-TH' : 'en-GB'),
                page: 0
            };

            addCover(deck);
            addSummarySlide(deck, data);
            getModelNames(data, 'summary').forEach(model => {
                addSummarySlide(deck, getModelProductionData(data, model), model);
            });
            if (isSectionSelected('production')) {
                addProductionSlide(deck, data, 'month');
                addProductionSlide(deck, data, 'quarter');
                getModelNames(data, 'production').forEach(model => {
                    addProductionSlide(deck, data, 'month', model);
                    addProductionSlide(deck, data, 'quarter', model);
                });
            }
            if (isSectionSelected('sorting')) {
                addSortingSlide(deck, data, 'month');
                addSortingSlide(deck, data, 'quarter');
                getModelNames(data, 'sorting').forEach(model => {
                    addSortingSlide(deck, data, 'month', model);
                    addSortingSlide(deck, data, 'quarter', model);
                });
            }
            if (isSectionSelected('quality')) {
                addQualitySlide(deck, data);
                getModelNames(data, 'quality').forEach(model => addQualitySlide(deck, data, model));
            }
            if (audience === 'executive' && isSectionSelected('machines')) {
                addMachineSlide(deck, data);
                getModelNames(data, 'machines').forEach(model => addMachineSlide(deck, data, model));
            }
            if (audience === 'executive' && isSectionSelected('jobOrders')) {
                addJobOrderSlide(deck, data);
                getModelNames(data, 'jobOrders').forEach(model => addJobOrderSlide(deck, data, model));
            }
            if (isSectionSelected('appendix')) addAppendixSlide(deck, data);

            const filePeriod = `${meta.dataStart || meta.start || 'report'}_${meta.dataEnd || meta.end || ''}`.replace(/[^0-9A-Za-z_-]+/g, '_').replace(/^_+|_+$/g, '');
            const fileName = `CWM_${audience === 'customer' ? 'Customer' : 'Executive'}_${filePeriod || now.toISOString().slice(0, 10)}.pptx`;
            await pptx.writeFile({ fileName: fileName });
            window.closePptxExportModal();
            alert(language === 'th' ? `สร้างไฟล์ ${fileName} เรียบร้อยแล้ว` : `Created ${fileName}`);
        } catch (error) {
            console.error('PowerPoint export failed:', error);
            const detail = error && error.message ? error.message : String(error || 'Unknown error');
            alert(`สร้าง PowerPoint ไม่สำเร็จ: ${detail.slice(0, 180)}`);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    };
})();
