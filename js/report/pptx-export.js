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
            ng: 'ของเสีย (NG)', achievement: 'เทียบเป้าหมาย', weightedNg: 'อัตรา NG ตามน้ำหนัก', weightedYield: 'Yield ตามน้ำหนัก',
            production: 'แนวโน้มการผลิต', quality: 'คุณภาพและอาการ NG หลัก',
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
            periodGrouped: 'ช่วงวันที่ยาวจะแบ่งเป็นช่วงย่อยโดยรวมยอด FG และ NG',
            slide: 'สไลด์', pageSource: 'CWM Production System',
            totalProduced: 'ผลิตรวม FG + NG', ngWeight: 'NG ตามน้ำหนัก', fgWeight: 'FG ตามน้ำหนัก',
            filterShift: 'กะ', filterType: 'ประเภทกะ', all: 'ทั้งหมด', stale: 'ช่องกรองเปลี่ยนแล้ว รายงานนี้ยังใช้ผลการค้นหาครั้งล่าสุด'
        },
        en: {
            report: 'Production & Quality Review', executive: 'Executive', customer: 'Customer',
            period: 'Data period', filters: 'Filters', generated: 'Generated',
            summary: 'Performance overview', target: 'Production target', fg: 'Good output (FG)',
            ng: 'Defects (NG)', achievement: 'Target achievement', weightedNg: 'Weight-based NG rate', weightedYield: 'Weight-based yield',
            production: 'Production trend', quality: 'Quality & top defects',
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
            periodGrouped: 'Long periods are grouped into intervals by summing FG and NG totals',
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

    function getSelectedSlideCount() {
        return 2 + ['production', 'quality', 'machines', 'jobOrders', 'appendix'].filter(isSectionSelected).length;
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
        if (typeof window.pptxgen === 'function') return Promise.resolve(window.pptxgen);
        if (pptxLoadPromise) return pptxLoadPromise;

        pptxLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
            script.onload = function () {
                if (typeof window.pptxgen === 'function') resolve(window.pptxgen);
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

    function addSummarySlide(deck, data) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, deck.labels.summary, `${deck.labels.period}: ${deck.period} · ${deck.filters}`, deck);

        const fg = number(data.totalFg);
        const ng = getNgPcs(data);
        const target = number(data.productionTarget);
        const rates = getWeightedRates(data);
        const achievement = target > 0 ? (fg / target) * 100 : null;
        const x = [0.82, 4.82, 8.82], w = 3.68, h = 1.48;
        const y = [1.72, 3.42];
        addMetricCard(slide, deck.pptx, x[0], y[0], w, h, deck.labels.target, target > 0 ? `${formatNumber(target, deck.language)} ${deck.labels.pieces}` : 'N/A', '', COLORS.blue);
        addMetricCard(slide, deck.pptx, x[1], y[0], w, h, deck.labels.fg, `${formatNumber(fg, deck.language)} ${deck.labels.pieces}`, `${deck.labels.fgWeight}: ${formatNumber(rates.fgKg, deck.language, 2)} ${deck.labels.kg}`, COLORS.green);
        addMetricCard(slide, deck.pptx, x[2], y[0], w, h, deck.labels.ng, `${formatNumber(ng, deck.language)} ${deck.labels.pieces}`, `${deck.labels.ngWeight}: ${formatNumber(rates.ngKg, deck.language, 2)} ${deck.labels.kg}`, COLORS.red);
        addMetricCard(slide, deck.pptx, x[0], y[1], w, h, deck.labels.achievement, formatPercent(achievement, deck.language), '', COLORS.blue);
        addMetricCard(slide, deck.pptx, x[1], y[1], w, h, deck.labels.weightedYield, formatPercent(rates.yieldRate, deck.language), '', COLORS.green);
        addMetricCard(slide, deck.pptx, x[2], y[1], w, h, deck.labels.weightedNg, formatPercent(rates.ngRate, deck.language), '', COLORS.teal);

        addShape(slide, deck.pptx, 'roundRect', {
            x: 0.82, y: 5.24, w: 11.69, h: 0.68,
            line: { color: 'D8E7F4', width: 0.7 }, fill: { color: 'F3F8FC' }
        });
        addText(slide, rates.ngRate === null ? deck.labels.noWeight : deck.labels.formula, {
            x: 1.04, y: 5.46, w: 11.2, h: 0.24, fontSize: 10, color: COLORS.text, bold: true, align: 'center'
        });
    }

    function getTrendBuckets(data) {
        const rows = (data.dailyTrend || []).filter(row => row && row.date).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
        if (!rows.length) return [];
        const step = Math.max(1, Math.ceil(rows.length / 10));
        const buckets = [];
        for (let i = 0; i < rows.length; i += step) {
            const batch = rows.slice(i, i + step);
            const first = String(batch[0].date);
            const last = String(batch[batch.length - 1].date);
            const short = value => {
                const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
                return match ? `${match[3]}/${match[2]}` : value.slice(0, 10);
            };
            buckets.push({
                label: first === last ? short(first) : `${short(first)}–${short(last)}`,
                fg: batch.reduce((sum, row) => sum + number(row.fg), 0),
                ng: batch.reduce((sum, row) => sum + number(row.ng), 0)
            });
        }
        return buckets;
    }

    function addLegend(slide, pptx, x, y, color, label) {
        addShape(slide, pptx, 'rect', {
            x: x, y: y + 0.035, w: 0.14, h: 0.14,
            line: { color: color, transparency: 100 }, fill: { color: color }
        });
        addText(slide, label, { x: x + 0.22, y, w: 1.0, h: 0.22, fontSize: 9, color: COLORS.muted });
    }

    function addProductionSlide(deck, data) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, deck.labels.production, deck.labels.totalProduced, deck);
        const buckets = getTrendBuckets(data);
        if (!buckets.length) {
            addText(slide, deck.labels.noData, { x: 1.1, y: 3.0, w: 11.0, h: 0.6, fontSize: 18, align: 'center', color: COLORS.muted });
            return;
        }

        addLegend(slide, deck.pptx, 9.35, 1.55, COLORS.blue, deck.labels.fgLegend);
        addLegend(slide, deck.pptx, 10.85, 1.55, COLORS.red, deck.labels.ngLegend);

        const chartX = 0.95, chartW = 11.43, baseY = 5.92, maxH = 3.48;
        const maxValue = Math.max(1, ...buckets.map(row => row.fg + row.ng));
        const slotW = chartW / buckets.length;
        const barW = Math.min(0.68, slotW * 0.56);
        addShape(slide, deck.pptx, 'rect', {
            x: chartX, y: baseY, w: chartW, h: 0.012,
            line: { color: COLORS.border, transparency: 100 }, fill: { color: COLORS.border }
        });

        buckets.forEach((row, index) => {
            const x = chartX + (index * slotW) + ((slotW - barW) / 2);
            const fgH = (row.fg / maxValue) * maxH;
            const ngH = (row.ng / maxValue) * maxH;
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
            addText(slide, formatNumber(total, deck.language), { x: x - 0.22, y: Math.max(2.06, baseY - fgH - ngH - 0.26), w: barW + 0.44, h: 0.18, fontSize: 8, bold: true, align: 'center', color: COLORS.text });
            addText(slide, row.label, { x: chartX + (index * slotW), y: baseY + 0.12, w: slotW, h: 0.4, fontSize: 7.5, align: 'center', color: COLORS.muted });
        });

        addText(slide, deck.labels.periodGrouped, { x: 0.95, y: 6.55, w: 11.3, h: 0.2, fontSize: 8.5, color: COLORS.muted, italic: true });
    }

    function addQualitySlide(deck, data) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, deck.labels.quality, deck.labels.defectCount, deck);

        const rates = getWeightedRates(data);
        addText(slide, deck.labels.weightedNg, { x: 0.9, y: 1.48, w: 3.3, h: 0.27, fontSize: 10, bold: true, color: COLORS.muted });
        addText(slide, formatPercent(rates.ngRate, deck.language), { x: 0.9, y: 1.82, w: 3.3, h: 0.66, fontFace: 'Tahoma', fontSize: 34, bold: true, color: COLORS.red });
        addText(slide, `${deck.labels.ngWeight}: ${formatNumber(rates.ngKg, deck.language, 2)} ${deck.labels.kg} · ${deck.labels.fgWeight}: ${formatNumber(rates.fgKg, deck.language, 2)} ${deck.labels.kg}`, { x: 0.92, y: 2.5, w: 11.3, h: 0.22, fontSize: 8.5, color: COLORS.muted });

        const labels = data.ngLabels || [];
        const values = data.ngValuesPcs || data.ngValues || [];
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
            const clippedLabel = row.label.length > 34 ? `${row.label.slice(0, 32)}…` : row.label;
            addText(slide, clippedLabel, { x: labelX, y, w: labelW, h: 0.28, fontSize: 8.5, color: COLORS.text });
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

    function addMachineSlide(deck, data) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, deck.labels.machines, deck.labels.machineNg, deck);
        const rows = Object.entries(data.machineData || {}).map(([name, item]) => ({
            name: name,
            ng: item.ngTotalPcs !== undefined ? number(item.ngTotalPcs) : number(item.ngTotal),
            ngKg: number(item.ngTotalKg)
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

    function addJobOrderSlide(deck, data) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        addBase(slide, deck.pptx, deck.labels.jobs, deck.labels.cumulativeNote, deck);
        const jobs = (data.jobOrders || []).filter(job => job && job.status !== 'Cancelled').slice();
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
            if (isSectionSelected('production')) addProductionSlide(deck, data);
            if (isSectionSelected('quality')) addQualitySlide(deck, data);
            if (audience === 'executive' && isSectionSelected('machines')) addMachineSlide(deck, data);
            if (audience === 'executive' && isSectionSelected('jobOrders')) addJobOrderSlide(deck, data);
            if (isSectionSelected('appendix')) addAppendixSlide(deck, data);

            const filePeriod = `${meta.dataStart || meta.start || 'report'}_${meta.dataEnd || meta.end || ''}`.replace(/[^0-9A-Za-z_-]+/g, '_').replace(/^_+|_+$/g, '');
            const fileName = `CWM_${audience === 'customer' ? 'Customer' : 'Executive'}_${filePeriod || now.toISOString().slice(0, 10)}.pptx`;
            await pptx.writeFile({ fileName: fileName });
            window.closePptxExportModal();
            alert(language === 'th' ? `สร้างไฟล์ ${fileName} เรียบร้อยแล้ว` : `Created ${fileName}`);
        } catch (error) {
            console.error('PowerPoint export failed:', error);
            alert('สร้าง PowerPoint ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    };
})();
