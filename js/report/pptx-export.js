(function () {
    const PAGE = { width: 13.333, height: 7.5 };
    // ชุดสีเดียวกับ PowerPoint ของระบบ H1 Lug&Screw
    const COLORS = {
        ink: '0F172A', muted: '64748B', faint: '94A3B8', line: 'E2E8F0', soft: 'F8FAFC', head: '1E293B',
        primary: '1A73E8', good: '1E8E3E', bad: 'D93025', warn: 'E37400', white: 'FFFFFF'
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
            filterShift: 'กะ', filterType: 'ประเภทกะ', all: 'ทั้งหมด', stale: 'ช่องกรองเปลี่ยนแล้ว รายงานนี้ยังใช้ผลการค้นหาครั้งล่าสุด',
            thanks: 'ขอบคุณ', thanksSub: 'ตัวเลขทุกหน้ามาจากระบบ CWM Production System ชุดเดียวกับหน้า Dashboard',
            axisNote: 'แกนซ้าย = จำนวนชิ้น · แกนขวา = % NG ตามน้ำหนัก', periodCol: 'ช่วง', ngRateShort: '% NG (น้ำหนัก)',
            defect: 'อาการ', share: '% ของ NG', machine: 'เครื่องจักร', definition: 'นิยาม'
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
            filterShift: 'Shift', filterType: 'Shift type', all: 'All', stale: 'Filters have changed; this deck still uses the most recent search result',
            thanks: 'Thank you', thanksSub: 'All figures come from the CWM Production System — the same data as the Dashboard',
            axisNote: 'Left axis = pieces · Right axis = weight-based NG %', periodCol: 'Period', ngRateShort: 'NG % (weight)',
            defect: 'Defect', share: '% of NG', machine: 'Machine', definition: 'Definition'
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
        return count + 1; // สไลด์ปิด
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


    // ==========================================
    // เทมเพลตสไลด์ (แบบเดียวกับระบบ H1 Lug&Screw)
    // แถบน้ำเงินบนสุด · หัวข้อ/คำอธิบาย · ท้ายหน้า + เลขหน้า · ปก/ปิดพื้นเข้ม
    // กราฟเป็นกราฟจริงของ PowerPoint (แก้ข้อมูล/สีต่อได้) · ตารางหัวเข้ม แถวสลับสี
    // ==========================================
    const FONT = 'Tahoma';
    const MASTER = 'CWM_BODY';

    function addText(slide, text, options) {
        slide.addText(String(text === undefined || text === null ? '' : text), Object.assign({
            fontFace: FONT, color: COLORS.ink, margin: 0, valign: 'mid'
        }, options || {}));
    }

    function defineMaster(pptx, footer) {
        pptx.defineSlideMaster({
            title: MASTER,
            background: { color: COLORS.white },
            objects: [
                { rect: { x: 0, y: 0, w: PAGE.width, h: 0.12, fill: { color: COLORS.primary } } },
                { text: { text: footer, options: { x: 0.5, y: 7.05, w: 10, h: 0.3, fontFace: FONT, fontSize: 9, color: COLORS.faint } } }
            ],
            slideNumber: { x: 12.2, y: 7.05, w: 0.7, h: 0.3, fontFace: FONT, fontSize: 9, color: COLORS.faint, align: 'right' }
        });
    }

    function bodySlide(deck, title, subtitle) {
        const slide = deck.pptx.addSlide({ masterName: MASTER });
        deck.page += 1;
        addText(slide, title, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 24, bold: true, fit: 'shrink' });
        if (subtitle) addText(slide, subtitle, { x: 0.5, y: 0.88, w: 12.3, h: 0.4, fontSize: 13, color: COLORS.muted, fit: 'shrink' });
        return slide;
    }

    function emptyNote(slide, text, y) {
        addText(slide, text, { x: 0.5, y: y || 3.2, w: 12.3, h: 0.6, fontSize: 16, color: COLORS.muted, align: 'center' });
    }

    function footNote(slide, text) {
        addText(slide, text, { x: 0.5, y: 6.62, w: 12.3, h: 0.32, fontSize: 9, italic: true, color: COLORS.muted, fit: 'shrink' });
    }

    // การ์ด KPI: เลขใหญ่ (สีตามความหมาย) + ป้าย + คำอธิบายบรรทัดเล็ก
    function addCards(slide, pptx, cards, y, perRow) {
        perRow = perRow || 4;
        const gap = 0.2, w = (12.3 - gap * (perRow - 1)) / perRow, h = 1.35;
        cards.forEach((card, i) => {
            const x = 0.5 + (i % perRow) * (w + gap);
            const yy = y + Math.floor(i / perRow) * (h + gap);
            slide.addShape(pptx.ShapeType.roundRect, { x: x, y: yy, w: w, h: h, fill: { color: COLORS.soft }, line: { color: COLORS.line }, rectRadius: 0.08 });
            addText(slide, card.value, { x: x + 0.15, y: yy + 0.12, w: w - 0.3, h: 0.65, fontSize: String(card.value).length > 12 ? 20 : 28, bold: true, color: card.color || COLORS.ink, fit: 'shrink' });
            addText(slide, card.label, { x: x + 0.15, y: yy + 0.78, w: w - 0.3, h: 0.3, fontSize: 12, color: COLORS.muted, fit: 'shrink' });
            if (card.sub) addText(slide, card.sub, { x: x + 0.15, y: yy + 1.04, w: w - 0.3, h: 0.25, fontSize: 10, color: COLORS.muted, fit: 'shrink' });
        });
        return y + Math.ceil(cards.length / perRow) * (h + gap);
    }

    // ตาราง: หัวเข้ม ตัวขาว · แถวสลับสี · คอลัมน์ตัวเลขชิดขวา
    function addTable(slide, table, x, y, w, opt) {
        opt = opt || {};
        if (table.caption) {
            addText(slide, table.caption, { x: x, y: y, w: w, h: 0.35, fontSize: 13, bold: true });
            y += 0.4;
        }
        if (!table.rows.length) {
            addText(slide, table.empty || '-', { x: x, y: y, w: w, h: 0.4, fontSize: 12, color: COLORS.muted });
            return;
        }
        const rows = [table.headers.map((h, i) => ({
            text: h, options: { bold: true, color: COLORS.white, fill: { color: COLORS.head }, align: table.numeric[i] ? 'right' : 'left' }
        }))];
        table.rows.forEach((row, ri) => {
            rows.push(row.map((v, i) => ({
                text: String(v), options: Object.assign({ align: table.numeric[i] ? 'right' : 'left', fill: { color: ri % 2 ? COLORS.soft : COLORS.white } }, (table.cellOpts && table.cellOpts(ri, i)) || {})
            })));
        });
        slide.addTable(rows, {
            x: x, y: y, w: w, colW: opt.colW, fontFace: FONT, fontSize: opt.fontSize || 11, color: COLORS.ink,
            border: { type: 'solid', pt: 0.5, color: COLORS.line }, rowH: opt.rowH || 0.32, valign: 'middle', autoPage: false
        });
    }

    function barChart(slide, pptx, chart, box, opt) {
        opt = opt || {};
        slide.addChart(pptx.charts.BAR, chart.series.map(s => ({ name: s.name, labels: chart.labels, values: s.values })), Object.assign({
            x: box.x, y: box.y, w: box.w, h: box.h,
            barDir: opt.horizontal ? 'bar' : 'col',
            chartColors: opt.colors || [COLORS.primary],
            catAxisLabelFontFace: FONT, catAxisLabelFontSize: chart.labels.length > 20 ? 8 : 10,
            valAxisLabelFontFace: FONT, valAxisLabelFontSize: 10, valAxisLabelFormatCode: '#,##0',
            valGridLine: { color: 'EEEEEE', size: 0.5 },
            showLegend: chart.series.length > 1, legendPos: 't', legendFontFace: FONT, legendFontSize: 10,
            showValue: !!opt.showValue, dataLabelFormatCode: '#,##0', dataLabelFontFace: FONT, dataLabelFontSize: 9, dataLabelPosition: 'outEnd'
        }, opt.extra || {}));
    }

    function addCover(deck) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        slide.background = { color: COLORS.ink };
        slide.addShape(deck.pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: PAGE.height, fill: { color: COLORS.primary }, line: { color: COLORS.primary } });
        addText(slide, `${deck.labels.report} · ${deck.audience === 'customer' ? deck.labels.customer : deck.labels.executive}`, {
            x: 0.9, y: 2.2, w: 11.5, h: 1.2, fontSize: 36, bold: true, color: COLORS.white, fit: 'shrink'
        });
        addText(slide, [
            `${deck.labels.period}: ${deck.period}`,
            `${deck.labels.filters}: ${deck.filters}`,
            `${deck.labels.generated}: ${deck.generatedAt}`
        ].join('\n'), { x: 0.9, y: 3.6, w: 11.5, h: 1.6, fontSize: 16, color: 'CBD5E1', valign: 'top', paraSpaceAfter: 6 });
        addText(slide, 'CWM Production System', { x: 0.9, y: 6.6, w: 11.5, h: 0.4, fontSize: 12, color: '94A3B8' });
    }

    function addClosing(deck) {
        const slide = deck.pptx.addSlide();
        deck.page += 1;
        slide.background = { color: COLORS.ink };
        addText(slide, deck.labels.thanks, { x: 0.5, y: 2.6, w: 12.3, h: 1, fontSize: 40, bold: true, color: COLORS.white, align: 'center' });
        addText(slide, deck.labels.thanksSub, { x: 0.5, y: 3.7, w: 12.3, h: 0.6, fontSize: 14, color: 'CBD5E1', align: 'center' });
    }

    function addSummarySlide(deck, data, model) {
        const title = model ? `${deck.labels.modelSummary} · ${model}` : deck.labels.summary;
        const slide = bodySlide(deck, title, `${deck.labels.period}: ${deck.period} · ${deck.filters}`);
        const fg = number(data.totalFg);
        const ng = getNgPcs(data);
        const rates = getWeightedRates(data);
        addCards(slide, deck.pptx, [
            { label: deck.labels.fg, value: `${formatNumber(fg, deck.language)} ${deck.labels.pieces}`, color: COLORS.good, sub: `${deck.labels.fgWeight}: ${formatNumber(rates.fgKg, deck.language, 2)} ${deck.labels.kg}` },
            { label: deck.labels.ng, value: `${formatNumber(ng, deck.language)} ${deck.labels.pieces}`, color: COLORS.bad, sub: `${deck.labels.ngWeight}: ${formatNumber(rates.ngKg, deck.language, 2)} ${deck.labels.kg}` },
            { label: deck.labels.weightedYield, value: formatPercent(rates.yieldRate, deck.language), color: COLORS.good },
            { label: deck.labels.weightedNg, value: formatPercent(rates.ngRate, deck.language), color: COLORS.bad },
            { label: deck.labels.totalProduced, value: `${formatNumber(fg + ng, deck.language)} ${deck.labels.pieces}`, color: COLORS.primary }
        ], 1.6, 4);
        footNote(slide, rates.ngRate === null ? deck.labels.noWeight : `${deck.labels.formula} · ${deck.labels.yieldFormula}`);
    }

    // FG + NG ซ้อนเป็นแท่งเดียว (แกนซ้าย = ชิ้น) + เส้น % NG ตามน้ำหนัก (แกนขวา) + ตารางสรุปใต้กราฟ
    function addProductionSlide(deck, data, period, model) {
        const title = period === 'month' ? deck.labels.monthlyProduction : deck.labels.quarterlyProduction;
        const slide = bodySlide(deck, model ? `${title} · ${model}` : title,
            `${deck.labels.period}: ${deck.period} · ${deck.labels.axisNote}`);
        const buckets = getTrendBuckets(data, period, deck.language, model);
        if (!buckets.length || !buckets.some(row => row.fg + row.ng > 0)) { emptyNote(slide, deck.labels.noData); return; }

        const labels = buckets.map(row => row.label);
        const hasRate = buckets.some(row => row.ngRate !== null);
        const withTable = buckets.length <= 12;
        const chartH = withTable ? 3.95 : 5.2;
        const charts = [{
            type: deck.pptx.charts.BAR,
            data: [
                { name: deck.labels.fgLegend, labels: labels, values: buckets.map(row => row.fg) },
                { name: deck.labels.ngLegend, labels: labels, values: buckets.map(row => row.ng) }
            ],
            options: { chartColors: [COLORS.good, COLORS.bad], barGrouping: 'stacked', barGapWidthPct: 50 }
        }];
        if (hasRate) {
            charts.push({
                type: deck.pptx.charts.LINE,
                // ช่วงที่น้ำหนักไม่ครบ = ไม่มีค่า (ไม่แทนด้วย % ตามชิ้น)
                data: [{ name: deck.labels.ngRateLegend, labels: labels, values: buckets.map(row => row.ngRate === null ? null : Math.round(row.ngRate * 100) / 100) }],
                options: {
                    chartColors: [COLORS.warn], lineSize: 2.5, lineDataSymbol: 'circle', lineDataSymbolSize: 7,
                    secondaryValAxis: true, secondaryCatAxis: true,
                    showValue: buckets.length <= 12, dataLabelFormatCode: '0.00"%"', dataLabelPosition: 't',
                    dataLabelFontFace: FONT, dataLabelFontSize: 9, dataLabelColor: COLORS.warn
                }
            });
        }
        const axisBase = { valAxisTitleFontFace: FONT, valAxisTitleFontSize: 10, valAxisLabelFontFace: FONT, valAxisLabelFontSize: 10 };
        slide.addChart(charts, {
            x: 0.5, y: 1.4, w: 12.3, h: chartH,
            catAxisLabelFontFace: FONT, catAxisLabelFontSize: labels.length > 20 ? 8 : 10,
            valAxes: hasRate ? [
                Object.assign({ showValAxisTitle: true, valAxisTitle: deck.labels.pieces, valAxisLabelFormatCode: '#,##0', valGridLine: { color: 'EEEEEE', size: 0.5 } }, axisBase),
                Object.assign({ showValAxisTitle: true, valAxisTitle: deck.labels.ngRateLegend, valAxisLabelFormatCode: '0.0"%"', valAxisMinVal: 0, valGridLine: { style: 'none' } }, axisBase)
            ] : [Object.assign({ showValAxisTitle: true, valAxisTitle: deck.labels.pieces, valAxisLabelFormatCode: '#,##0', valGridLine: { color: 'EEEEEE', size: 0.5 } }, axisBase)],
            catAxes: hasRate ? [{ catAxisTitle: '' }, { catAxisHidden: true }] : undefined,
            showLegend: true, legendPos: 't', legendFontFace: FONT, legendFontSize: 11
        });
        if (withTable) {
            addTable(slide, {
                headers: [deck.labels.periodCol].concat(labels),
                rows: [
                    ['FG'].concat(buckets.map(row => formatNumber(row.fg, deck.language))),
                    ['NG'].concat(buckets.map(row => formatNumber(row.ng, deck.language))),
                    [deck.labels.ngRateShort].concat(buckets.map(row => formatPercent(row.ngRate, deck.language)))
                ],
                numeric: [false].concat(labels.map(() => true))
            }, 0.5, 1.5 + chartH, 12.3, { fontSize: 10, rowH: 0.28 });
        }
        if (!hasRate) footNote(slide, deck.labels.noWeight);
    }

    // งาน Sorting: แท่งเดียวรวม FG + NG + รอคัด พร้อมตัวเลขบนหัวแท่ง
    function addSortingSlide(deck, data, period, model) {
        const title = period === 'month' ? deck.labels.monthlySorting : deck.labels.quarterlySorting;
        const scope = model ? deck.labels.modelSortingScope : deck.labels.sortingScope;
        const buckets = getSortingBuckets(data, period, deck.language, model);
        const totalSorted = buckets.reduce((sum, row) => sum + row.fgPcs + row.ngPcs, 0);
        const activeDays = buckets.reduce((sum, row) => sum + row.activeDays, 0);
        const avgCapacity = activeDays > 0 ? formatNumber(totalSorted / activeDays, deck.language, 0) : 'N/A';
        const slide = bodySlide(deck, model ? `${title} · ${model}` : title,
            `${deck.labels.period}: ${deck.period} · ${scope} · ${deck.labels.sortingCapacity}: ${avgCapacity} ${deck.labels.sortingCapacityUnit}`);
        if (!buckets.length || !buckets.some(row => row.fgPcs + row.ngPcs + row.pendingPcs > 0)) { emptyNote(slide, deck.labels.noData); return; }
        barChart(slide, deck.pptx, {
            labels: buckets.map(row => row.label),
            series: [{ name: deck.labels.sortingTotalLegend, values: buckets.map(row => row.fgPcs + row.ngPcs + row.pendingPcs) }]
        }, { x: 0.5, y: 1.4, w: 12.3, h: 5.15 }, { colors: [COLORS.primary], showValue: buckets.length <= 31 });
        footNote(slide, deck.labels.sortingNote);
    }

    // คุณภาพ: การ์ด % NG ตามน้ำหนัก + กราฟแท่งแนวนอนอาการ NG + ตารางสัดส่วน
    function addQualitySlide(deck, data, model) {
        const slide = bodySlide(deck, model ? `${deck.labels.quality} · ${model}` : deck.labels.quality,
            `${deck.labels.period}: ${deck.period} · ${deck.labels.defectCount}`);
        const rates = getWeightedRates(model ? getModelProductionData(data, model) : data);
        const modelDefects = model && data.productData && data.productData[model] && data.productData[model].ngBreakdownPcs;
        const names = model ? Object.keys(modelDefects || {}) : (data.ngLabels || []);
        const values = model ? names.map(name => modelDefects[name]) : (data.ngValuesPcs || data.ngValues || []);
        const rows = names.map((name, i) => ({ label: String(name), value: number(values[i]) }))
            .filter(row => row.value > 0)
            .sort((a, b) => b.value - a.value);
        const top = rows.slice(0, 9);
        if (rows.length > 9) top.push({ label: deck.language === 'th' ? 'อาการอื่น ๆ' : 'Other defects', value: rows.slice(9).reduce((sum, row) => sum + row.value, 0) });
        const sum = top.reduce((a, row) => a + row.value, 0);

        addCards(slide, deck.pptx, [
            { label: deck.labels.weightedNg, value: formatPercent(rates.ngRate, deck.language), color: COLORS.bad, sub: `${deck.labels.ngWeight}: ${formatNumber(rates.ngKg, deck.language, 2)} ${deck.labels.kg}` },
            { label: deck.labels.ng, value: `${formatNumber(sum, deck.language)} ${deck.labels.pieces}`, color: COLORS.bad }
        ], 1.45, 4);
        if (!top.length) { emptyNote(slide, deck.labels.noData, 3.9); return; }
        barChart(slide, deck.pptx, {
            labels: top.map(row => row.label),
            series: [{ name: deck.labels.defectCount, values: top.map(row => row.value) }]
        }, { x: 0.5, y: 3.05, w: 6.6, h: 3.85 }, { horizontal: true, showValue: true, colors: [COLORS.bad], extra: { catAxisOrientation: 'maxMin', catAxisLabelFontSize: 9 } });
        addTable(slide, {
            headers: [deck.labels.defect, deck.labels.pieces, deck.labels.share],
            rows: top.map(row => [row.label, formatNumber(row.value, deck.language), formatPercent(sum > 0 ? row.value / sum * 100 : 0, deck.language)]),
            numeric: [false, true, true]
        }, 7.3, 3.1, 5.5, { fontSize: 9.5, rowH: 0.3, colW: [3.1, 1.2, 1.2] });
    }

    // เครื่องจักร NG สูง: กราฟแท่ง + ตาราง (ชิ้น / กก.)
    function addMachineSlide(deck, data, model) {
        const slide = bodySlide(deck, model ? `${deck.labels.machines} · ${model}` : deck.labels.machines,
            `${deck.labels.period}: ${deck.period} · ${deck.labels.machineNg}`);
        const rows = Object.entries(data.machineData || {}).map(([name, item]) => ({
            name: name,
            ng: model ? number(item.byModel && item.byModel[model] && item.byModel[model].ngPcs)
                : (item.ngTotalPcs !== undefined ? number(item.ngTotalPcs) : number(item.ngTotal)),
            ngKg: model ? number(item.byModel && item.byModel[model] && item.byModel[model].ngKg) : number(item.ngTotalKg)
        })).filter(row => row.ng > 0).sort((a, b) => b.ng - a.ng).slice(0, 10);
        if (!rows.length) { emptyNote(slide, deck.labels.noData); return; }
        barChart(slide, deck.pptx, {
            labels: rows.map(row => row.name),
            series: [{ name: deck.labels.machineNg, values: rows.map(row => row.ng) }]
        }, { x: 0.5, y: 1.4, w: 6.6, h: 5.45 }, { horizontal: true, showValue: true, colors: [COLORS.warn], extra: { catAxisOrientation: 'maxMin' } });
        addTable(slide, {
            headers: [deck.labels.machine, `NG (${deck.labels.pieces})`, `NG (${deck.labels.kg})`],
            rows: rows.map(row => [row.name, formatNumber(row.ng, deck.language), formatNumber(row.ngKg, deck.language, 2)]),
            numeric: [false, true, true]
        }, 7.3, 1.5, 5.5, { fontSize: 10.5, rowH: 0.32 });
    }

    function addJobOrderSlide(deck, data, model) {
        const slide = bodySlide(deck, model ? `${deck.labels.jobs} · ${model}` : deck.labels.jobs, deck.labels.cumulativeNote);
        const jobs = (data.jobOrders || []).filter(job => job && job.status !== 'Cancelled' && (!model || String(job.product || '').trim() === model)).slice();
        if (!jobs.length) { emptyNote(slide, deck.labels.noData); return; }
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
        }).sort((a, b) => a.progress - b.progress).slice(0, 14);
        addTable(slide, {
            headers: [deck.labels.job, deck.labels.product, deck.labels.jobTarget, deck.labels.accounted, deck.labels.progress, deck.labels.status],
            rows: rows.map(row => [row.job, row.product, formatNumber(row.target, deck.language), formatNumber(row.accounted, deck.language), formatPercent(row.progress, deck.language), row.status]),
            numeric: [false, false, true, true, true, false],
            cellOpts: (ri, ci) => ci === 4 ? { bold: true, color: rows[ri].progress >= 100 ? COLORS.good : COLORS.primary } : null
        }, 0.5, 1.5, 12.3, { fontSize: 11, rowH: 0.34, colW: [2.2, 3.6, 1.6, 1.7, 1.5, 1.7] });
    }

    function addAppendixSlide(deck, data) {
        const slide = bodySlide(deck, deck.labels.appendix, `${deck.labels.period}: ${deck.period} · ${deck.filters}`);
        const rates = getWeightedRates(data);
        addTable(slide, {
            headers: ['#', deck.labels.definition],
            rows: [deck.labels.formula, deck.labels.yieldFormula, deck.labels.periodMethod, deck.labels.dayBoundary, deck.labels.missingWeight]
                .map((item, i) => [i + 1, item]),
            numeric: [true, false]
        }, 0.5, 1.5, 12.3, { fontSize: 12, rowH: 0.5, colW: [0.6, 11.7] });
        addCards(slide, deck.pptx, [
            { label: deck.labels.weightedNg, value: formatPercent(rates.ngRate, deck.language), color: rates.ngRate === null ? COLORS.muted : COLORS.bad },
            { label: deck.labels.weightedYield, value: formatPercent(rates.yieldRate, deck.language), color: COLORS.good }
        ], 4.75, 4);
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
            defineMaster(pptx, `${labels.pageSource} · ${deck.period} · ${(audience === 'customer' ? labels.customer : labels.executive).toUpperCase()}`);

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
            addClosing(deck);

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
