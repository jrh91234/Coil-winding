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

// ==========================================
// Helper: WPP (Weight Per Piece) — shared, strict (no fallback)
// ==========================================
const WPP_TABLE = { "10A": 0.00228, "16A": 0.00279, "20A": 0.00357, "25/32A": 0.005335 };

window.getWppStrict = function(prod) {
    if (!prod) return null;
    for (const k in WPP_TABLE) { if (prod.includes(k)) return WPP_TABLE[k]; }
    return null;
};

window.getKgFromPcs = function(prod, pcs) {
    if (!pcs || pcs <= 0) return 0;
    const w = window.getWppStrict(prod);
    if (w === null) return 0;
    return pcs * w;
};

// Kg → PCS (ปัดเป็นจำนวนเต็ม) — คืน null ถ้ารุ่นไม่มีค่า WPP
window.getPcsFromKg = function(prod, kg) {
    const w = window.getWppStrict(prod);
    if (w === null) return null;
    if (!kg || kg <= 0) return 0;
    return Math.round(kg / w);
};


// ==========================================
// Helper: จัดกลุ่มข้อมูลตามช่วงเวลา (รายวัน / สัปดาห์ / เดือน / ไตรมาส / ปี) — แบบกราฟหุ้น
// ใช้ร่วมกันทุกกราฟที่มีแกนเวลา: เลือกช่วงแล้วกราฟรวมข้อมูลเป็นช่วงนั้นทันที
// ==========================================
window.CHART_PERIODS = [
    { value: 'day',     short: 'วัน',     title: 'รายวัน' },
    { value: 'week',    short: 'สัปดาห์', title: 'รายสัปดาห์ (จันทร์–อาทิตย์)' },
    { value: 'month',   short: 'เดือน',   title: 'รายเดือน' },
    { value: 'quarter', short: 'ไตรมาส',  title: 'รายไตรมาส (Quarter)' },
    { value: 'year',    short: 'ปี',      title: 'รายปี' }
];
const PERIOD_STORE_KEY = 'chartPeriods';
const _PERIOD_THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// อ่านวันที่จากสตริง (yyyy-MM-dd หรือ yyyy-MM) → Date (เวลาท้องถิ่น) หรือ null
const _parsePeriodDate = function(dateStr) {
    const s = String(dateStr || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
    if (m) return new Date(+m[1], +m[2] - 1, m[3] ? +m[3] : 1);
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
};
const _periodPad2 = (n) => String(n).padStart(2, '0');

// คืน key ของช่วงเวลาที่วันที่นั้นอยู่ (เรียงตามตัวอักษรได้ถูกลำดับเวลา)
//   day → 2026-10-13 · week → 2026-10-12 (วันจันทร์) · month → 2026-10 · quarter → 2026-Q4 · year → 2026
window.getPeriodKey = function(dateStr, period) {
    if (!period || period === 'day') return dateStr;
    const dt = _parsePeriodDate(dateStr);
    if (!dt) return dateStr;
    const y = dt.getFullYear();
    if (period === 'week') {
        const day = dt.getDay();
        dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
        return `${dt.getFullYear()}-${_periodPad2(dt.getMonth() + 1)}-${_periodPad2(dt.getDate())}`;
    }
    if (period === 'month') return `${y}-${_periodPad2(dt.getMonth() + 1)}`;
    if (period === 'quarter') return `${y}-Q${Math.floor(dt.getMonth() / 3) + 1}`;
    if (period === 'year') return String(y);
    return dateStr;
};

// ข้อความสั้นบนแกน X
window.formatPeriodLabel = function(key, period) {
    if (!period || period === 'day') return key;
    if (period === 'week') {
        const dt = _parsePeriodDate(key);
        return dt ? `W ${_periodPad2(dt.getDate())}/${_periodPad2(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(2)}` : key;
    }
    if (period === 'month') {
        const dt = _parsePeriodDate(key);
        return dt ? `${_PERIOD_THAI_MONTHS[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}` : key;
    }
    if (period === 'quarter') {
        const m = String(key).match(/^(\d{4})-Q(\d)$/);
        return m ? `Q${m[2]}/${m[1]}` : key;
    }
    return String(key);
};

// ข้อความเต็มสำหรับ tooltip / หัว popup เช่น "สัปดาห์ 12/10/2026 – 18/10/2026"
window.formatPeriodTitle = function(key, period) {
    if (!period || period === 'day') return key;
    const fmt = (d) => `${_periodPad2(d.getDate())}/${_periodPad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    if (period === 'week') {
        const s = _parsePeriodDate(key);
        if (!s) return key;
        const e = new Date(s); e.setDate(e.getDate() + 6);
        return `สัปดาห์ ${fmt(s)} – ${fmt(e)}`;
    }
    if (period === 'month') {
        const dt = _parsePeriodDate(key);
        return dt ? `เดือน ${_PERIOD_THAI_MONTHS[dt.getMonth()]} ${dt.getFullYear()}` : key;
    }
    if (period === 'quarter') return 'ไตรมาส ' + window.formatPeriodLabel(key, period);
    if (period === 'year') return 'ปี ' + key;
    return String(key);
};

// จัดกลุ่มแถวข้อมูลตามช่วงเวลา
//   rows: array, getDate(row) → 'yyyy-MM-dd', init(key) → ก้อนว่าง, add(acc, row) → บวกค่าเข้า
//   คืน [{ key, label, title, dates: [...], ...acc }] เรียงตามเวลา
window.groupRowsByPeriod = function(rows, period, getDate, init, add) {
    const map = {};
    const keys = [];
    (rows || []).forEach(row => {
        const date = getDate(row);
        const key = window.getPeriodKey(date, period);
        if (!(key in map)) {
            map[key] = Object.assign({ key, dates: [] }, init(key));
            keys.push(key);
        }
        map[key].dates.push(date);
        add(map[key], row);
    });
    keys.sort();
    return keys.map(k => Object.assign(map[k], {
        label: window.formatPeriodLabel(k, period),
        title: window.formatPeriodTitle(k, period)
    }));
};

// วันแรกของช่วง (Date) จาก key ของ getPeriodKey
window.periodStartDate = function(key, period) {
    if (period === 'quarter') {
        const m = String(key).match(/^(\d{4})-Q(\d)$/);
        return m ? new Date(+m[1], (+m[2] - 1) * 3, 1) : null;
    }
    if (period === 'year') return new Date(+key, 0, 1);
    return _parsePeriodDate(key);
};

// วันแรกของช่วงถัดไป n ช่วง (Date)
const _shiftPeriodStart = function(key, period, n) {
    const s = window.periodStartDate(key, period);
    if (!s) return null;
    if (!period || period === 'day') s.setDate(s.getDate() + n);
    else if (period === 'week') s.setDate(s.getDate() + 7 * n);
    else if (period === 'month') s.setMonth(s.getMonth() + n);
    else if (period === 'quarter') s.setMonth(s.getMonth() + 3 * n);
    else if (period === 'year') s.setFullYear(s.getFullYear() + n);
    return s;
};

// key ของช่วงถัดไป n ช่วง เช่น addPeriods('2026-10', 'month', 2) → '2026-12'
window.addPeriods = function(key, period, n) {
    const s = _shiftPeriodStart(key, period, n);
    if (!s) return key;
    return window.getPeriodKey(`${s.getFullYear()}-${_periodPad2(s.getMonth() + 1)}-${_periodPad2(s.getDate())}`, period);
};

// จำนวนวันในช่วง และจำนวนวันที่ผ่านไปแล้วถึง lastDateStr (นับรวมวันนั้น)
window.periodDayProgress = function(key, period, lastDateStr) {
    const s = window.periodStartDate(key, period);
    const e = _shiftPeriodStart(key, period, 1);
    const last = _parsePeriodDate(lastDateStr);
    if (!s || !e || !last) return { total: 1, elapsed: 1 };
    const DAY = 86400000;
    const total = Math.round((e - s) / DAY);
    const elapsed = Math.min(total, Math.max(0, Math.round((last - s) / DAY) + 1));
    return { total, elapsed };
};

// 📈 Holt's Linear Exponential Smoothing แบบ Damped Trend (กันแนวโน้มพุ่งเกินจริง)
//   series: ตัวเลขเรียงตามเวลา (อย่างน้อย 4 จุด) · horizon: จำนวนช่วงที่ทำนาย
//   เลือก alpha/beta อัตโนมัติจาก error ทำนายล่วงหน้า 1 ช่วงที่น้อยที่สุด
//   คืน { forecast: [h1..hN], sd: [SD ของค่าทำนายแต่ละช่วง], mape (% คลาดเคลื่อนเฉลี่ยย้อนหลัง) } หรือ null
window.holtForecast = function(series, horizon) {
    const y = (series || []).filter(v => Number.isFinite(v));
    if (y.length < 4 || horizon < 1) return null;
    const PHI = 0.9;
    const run = (alpha, beta) => {
        let level = y[0], trend = y[1] - y[0], sse = 0, ape = 0, apeN = 0;
        const errs = [];
        for (let t = 1; t < y.length; t++) {
            const pred = level + PHI * trend;
            const err = y[t] - pred;
            errs.push(err);
            sse += err * err;
            if (y[t] !== 0) { ape += Math.abs(err / y[t]); apeN++; }
            const prevLevel = level;
            level = alpha * y[t] + (1 - alpha) * (level + PHI * trend);
            trend = beta * (level - prevLevel) + (1 - beta) * PHI * trend;
        }
        return { alpha, beta, level, trend, sse, errs, mape: apeN ? (ape / apeN) * 100 : null };
    };
    let best = null;
    for (let a = 0.1; a <= 0.91; a += 0.1) {
        for (let b = 0.05; b <= 0.51; b += 0.05) {
            const r = run(a, b);
            if (!best || r.sse < best.sse) best = r;
        }
    }
    const forecast = [];
    let damp = 0;
    for (let h = 1; h <= horizon; h++) {
        damp += Math.pow(PHI, h);
        forecast.push(Math.max(0, best.level + damp * best.trend));
    }
    // ไม่นับ error ช่วงแรก ๆ ที่โมเดลยังไม่นิ่ง
    const errs = best.errs.length > 3 ? best.errs.slice(2) : best.errs;
    const sigma = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / Math.max(1, errs.length - 1));
    // ความแปรปรวนค่าทำนาย h ช่วงของ Holt damped: σ²·(1 + Σ_{j<h} (α + αβ·Σ_{i≤j} φ^i)²)
    const sd = [];
    let acc = 0, phiSum = 0;
    for (let h = 1; h <= horizon; h++) {
        sd.push(sigma * Math.sqrt(1 + acc));
        phiSum += Math.pow(PHI, h);
        acc += Math.pow(best.alpha + best.alpha * best.beta * phiSum, 2);
    }
    return { forecast, sd, mape: best.mape };
};

// 📈 ทำนายยอดรวม (เช่น ยอดผลิตชิ้น) ของช่วงถัดไป — ใช้กับกราฟ Daily Output
//   daily: [{date:'yyyy-MM-dd', value}] ยอดรายวัน · period: day/week/month/quarter/year
//   ทำนาย "ยอดต่อวันทำงาน" (ไม่ผันผวนตามจำนวนวันในเดือน) แล้วคูณจำนวนวันทำงานที่คาดในแต่ละช่วง
//   วันทำงาน = วันในสัปดาห์ที่ 4 สัปดาห์ล่าสุดมีการผลิต · ไตรมาส/ปี ทำนายรายเดือนแล้วรวมขึ้น
//   ช่วงที่ยังไม่จบ = ยอดจริง + วันทำงานที่เหลือ × ค่าทำนาย
//   คืน { order: [key], points: {key: {value, lo, hi, actual, isPartial, progress}}, mape } หรือ null
window.projectPeriodTotals = function(daily, period) {
    period = period || 'day';
    const HORIZON = { day: 7, week: 4, month: 3, quarter: 2, year: 1 };
    const baseUnit = (period === 'quarter' || period === 'year') ? 'month' : period;
    const toDisplayKey = k => baseUnit === period ? k : window.getPeriodKey(k, period);
    const weekday = d => window.periodStartDate(d, 'day').getDay();
    const rows = (daily || []).filter(r => r && r.date);

    const base = window.groupRowsByPeriod(rows, baseUnit, r => r.date, () => ({ value: 0, days: 0, lastDate: '' }), (acc, r) => {
        acc.value += r.value || 0;
        if (r.value > 0) { acc.days++; if (r.date > acc.lastDate) acc.lastDate = r.date; }
    }).filter(b => b.value > 0);
    if (base.length < 2) return null;
    const lastBase = base[base.length - 1];
    const lastDate = lastBase.lastDate;

    // วันในสัปดาห์ที่มีการผลิตใน 4 สัปดาห์ล่าสุด
    const since = window.addPeriods(lastDate, 'day', -27);
    const workDays = Array(7).fill(false);
    rows.forEach(r => { if (r.value > 0 && r.date >= since && r.date <= lastDate) workDays[weekday(r.date)] = true; });
    // จำนวนวันทำงานที่คาดในช่วง key (นับเฉพาะวันหลัง afterDate ถ้าระบุ)
    const expectedDays = (key, afterDate) => {
        if (baseUnit === 'day') return 1;
        const end = window.addPeriods(key, baseUnit, 1);
        let n = 0;
        const s0 = window.periodStartDate(key, baseUnit);
        for (let d = `${s0.getFullYear()}-${_periodPad2(s0.getMonth() + 1)}-${_periodPad2(s0.getDate())}`; ; d = window.addPeriods(d, 'day', 1)) {
            if (window.getPeriodKey(d, baseUnit) === end) break;
            if ((!afterDate || d > afterDate) && workDays[weekday(d)]) n++;
            if (n > 400) break;
        }
        return n;
    };

    let partial = null;
    if (baseUnit !== 'day') {
        const prog = window.periodDayProgress(lastBase.key, baseUnit, lastDate);
        if (prog.elapsed > 0 && prog.elapsed < prog.total) partial = Object.assign({ prog }, lastBase);
    }
    const done = partial ? base.slice(0, -1) : base;
    if (!done.length) return null;
    const lastDoneKey = done[done.length - 1].key;

    let steps = HORIZON[period] + (partial ? 1 : 0);
    if (baseUnit !== period) {
        const targetKey = window.addPeriods(toDisplayKey(partial ? partial.key : lastDoneKey), period, HORIZON[period]);
        steps = 0;
        while (toDisplayKey(window.addPeriods(lastDoneKey, baseUnit, steps + 1)) <= targetKey && steps < 36) steps++;
    }
    const futureKeys = [];
    for (let k = lastDoneKey, guard = 0; futureKeys.length < steps && guard < 60; guard++) {
        k = window.addPeriods(k, baseUnit, 1);
        if (baseUnit === 'day' && !workDays[weekday(k)]) continue;
        futureKeys.push(k);
    }

    const fit = window.holtForecast(done.map(b => b.value / b.days), futureKeys.length);
    if (!fit) return null;

    const points = {};
    const order = [];
    const add = (key, value, actual, sd, progress) => {
        const dk = toDisplayKey(key);
        if (!points[dk]) { points[dk] = { value: 0, actual: 0, sd: 0, progress: '' }; order.push(dk); }
        const p = points[dk];
        p.value += value; p.actual += actual; p.sd += sd;
        if (progress) p.progress = progress;
    };
    futureKeys.forEach((key, i) => {
        if (i === 0 && partial) {
            const remDays = expectedDays(key, lastDate);
            add(key, partial.value + fit.forecast[0] * remDays, partial.value, fit.sd[0] * remDays,
                `${partial.prog.elapsed}/${partial.prog.total} วัน`);
        } else {
            const nDays = expectedDays(key);
            add(key, fit.forecast[i] * nDays, 0, fit.sd[i] * nDays);
        }
    });
    if (baseUnit !== period) {
        done.forEach(b => { const p = points[toDisplayKey(b.key)]; if (p) { p.value += b.value; p.actual += b.value; } });
        const lastKey = toDisplayKey(partial ? partial.key : lastDoneKey);
        if (points[lastKey] && points[lastKey].actual > 0) {
            const e = window.periodDayProgress(lastKey, period, lastDate);
            points[lastKey].progress = `${e.elapsed}/${e.total} วัน`;
        }
    }
    order.forEach(k => {
        const p = points[k];
        Object.assign(p, { lo: Math.max(0, p.value - 1.96 * p.sd), hi: p.value + 1.96 * p.sd, isPartial: p.actual > 0 });
    });
    return { order, points, mape: fit.mape };
};

// รวม object ตัวเลข { key: n } เข้าด้วยกัน (เช่น ngBreakdown)
window.mergeNumberMap = function(target, src) {
    Object.entries(src || {}).forEach(([k, v]) => { target[k] = (target[k] || 0) + (Number(v) || 0); });
    return target;
};

// ---------- สถานะช่วงเวลาของแต่ละกราฟ + ปุ่มสลับ ----------
// renderer ของแต่ละกราฟลงทะเบียนไว้ที่นี่ เพื่อให้กดปุ่มแล้ววาดใหม่ทันที
window.chartPeriodRenderers = window.chartPeriodRenderers || {};
window.registerChartPeriod = function(chartKey, renderFn) {
    window.chartPeriodRenderers[chartKey] = renderFn;
};

const _loadChartPeriods = function() {
    try { return JSON.parse(localStorage.getItem(PERIOD_STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
};
window.chartPeriodState = window.chartPeriodState || _loadChartPeriods();

window.getChartPeriod = function(chartKey, allowed) {
    const p = window.chartPeriodState[chartKey] || 'day';
    if (allowed && allowed.indexOf(p) === -1) return allowed[0];
    return p;
};

// วาดปุ่มสลับลงใน <div class="chart-period-switch" data-period-chart="..." data-periods="day,week,...">
window.renderPeriodSwitches = function(root) {
    (root || document).querySelectorAll('.chart-period-switch').forEach(el => {
        const chartKey = el.getAttribute('data-period-chart');
        const allowed = (el.getAttribute('data-periods') || 'day,week,month,quarter,year').split(',');
        const cur = chartKey === '__all' ? (window.chartPeriodState.__all || '') : window.getChartPeriod(chartKey, allowed);
        el.innerHTML = window.CHART_PERIODS.filter(p => allowed.indexOf(p.value) !== -1).map(p => {
            const active = p.value === cur;
            const cls = active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-indigo-50';
            return `<button type="button" title="${p.title}" onclick="window.setChartPeriod('${chartKey}','${p.value}')" class="px-1.5 py-0.5 text-[10px] font-bold border ${cls} first:rounded-l last:rounded-r -ml-px first:ml-0">${p.short}</button>`;
        }).join('');
        el.classList.add('inline-flex', 'items-center');
    });
};

// เลือกช่วงเวลาให้กราฟเดียว หรือ '__all' = ทุกกราฟพร้อมกัน แล้ววาดใหม่ทันที
window.setChartPeriod = function(chartKey, period) {
    const st = window.chartPeriodState;
    let toRender;
    if (chartKey === '__all') {
        st.__all = period;
        Object.keys(window.chartPeriodRenderers).forEach(k => { st[k] = period; });
        document.querySelectorAll('.chart-period-switch').forEach(el => {
            const k = el.getAttribute('data-period-chart');
            if (k && k !== '__all') st[k] = period;
        });
        toRender = Object.keys(window.chartPeriodRenderers);
    } else {
        st[chartKey] = period;
        delete st.__all; // ปรับรายกราฟแล้ว ปุ่ม "ทุกกราฟ" ไม่ไฮไลต์
        toRender = [chartKey];
    }
    try { localStorage.setItem(PERIOD_STORE_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
    window.renderPeriodSwitches();
    const done = new Set();
    toRender.forEach(k => {
        const fn = window.chartPeriodRenderers[k];
        if (typeof fn !== 'function' || done.has(fn)) return;
        done.add(fn);
        try { fn(); } catch (e) { console.error('period render ' + k, e); }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.renderPeriodSwitches());
} else {
    window.renderPeriodSwitches();
}
