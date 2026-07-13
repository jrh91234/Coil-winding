// ============================================
// 🖊️ Chart Draw Tool — ตีเส้นบนกราฟแบบ TradingView
// ใช้กับกราฟ Chart.js ใดก็ได้: window.initChartDrawTool(chart, key)
// - ✏️ เส้นแนวโน้ม (ลากจากจุดหนึ่งไปอีกจุด)
// - ━ เส้นแนวนอน (คลิกครั้งเดียว, แสดงค่า % ที่ขอบขวา)
// - ✋ โหมดขยับ/แก้ไข (คลิกเลือกเส้น ลากทั้งเส้นหรือลากจุดปลาย, กด Delete ลบเส้นที่เลือก)
// - 🧽 โหมดลบ (คลิกใกล้เส้นเพื่อลบทีละเส้น)
// - ↩️ ลบเส้นล่าสุด / 🗑️ ลบทั้งหมด
// เส้นถูกเก็บเป็นพิกัดข้อมูล (วันที่ + ค่า) จึงอยู่ถูกตำแหน่งเมื่อ zoom/pan
// และบันทึกลง localStorage เพื่อให้อยู่ครบตอนเปิดใหม่/re-render
// ============================================

window.chartDrawings = window.chartDrawings || {};

(function() {
    const STORAGE_PREFIX = 'chartDrawings_';
    const COLORS = ['#ef4444', '#3b82f6', '#16a34a', '#8b5cf6', '#111827'];
    const HIT_TOLERANCE = 8; // px ระยะคลิกโดนเส้นในโหมดลบ

    function loadDrawings(key) {
        if (!window.chartDrawings[key]) {
            try {
                window.chartDrawings[key] = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)) || [];
            } catch (e) { window.chartDrawings[key] = []; }
        }
        return window.chartDrawings[key];
    }

    function saveDrawings(key) {
        try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(window.chartDrawings[key] || [])); } catch (e) {}
    }

    // ---- แปลงพิกัด pixel <-> ข้อมูล (x เก็บเป็น label วันที่ + เศษ index กันช่วงวันที่เปลี่ยน) ----
    function pxToData(chart, px, py) {
        const xs = chart.scales.x, ys = chart.scales.y;
        const labels = chart.data.labels || [];
        const xVal = xs.getValueForPixel(px);
        let i = Math.round(xVal);
        i = Math.max(0, Math.min(labels.length - 1, i));
        return { label: labels[i], off: xVal - i, y: ys.getValueForPixel(py) };
    }

    function dataToPx(chart, pt) {
        const labels = chart.data.labels || [];
        const idx = labels.indexOf(pt.label);
        if (idx < 0) return null; // วันที่นี้ไม่อยู่ในช่วงข้อมูลปัจจุบัน
        return { x: chart.scales.x.getPixelForValue(idx + (pt.off || 0)), y: chart.scales.y.getPixelForValue(pt.y) };
    }

    function distToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    // ตำแหน่ง pixel ของเส้น (null = อยู่นอกช่วงข้อมูลปัจจุบัน)
    function linePixels(chart, d) {
        const area = chart.chartArea;
        if (d.type === 'h') {
            // เส้นแนวนอนขึ้นกับค่า y อย่างเดียว ไม่ผูกกับช่วงวันที่
            const y = chart.scales.y.getPixelForValue(d.p1.y);
            return { x1: area.left, y1: y, x2: area.right, y2: y };
        }
        const p1 = dataToPx(chart, d.p1), p2 = dataToPx(chart, d.p2);
        if (!p1 || !p2) return null;
        return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }

    // ---- วาดเส้นทั้งหมดของกราฟ (เรียกจาก plugin) ----
    function drawLine(chart, ctx, d, preview) {
        const area = chart.chartArea;
        const px = linePixels(chart, d);
        if (!px) return;
        const { x1, y1, x2, y2 } = px;
        const selected = chart.$drawSelected === d;
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
        ctx.clip();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = selected ? 3 : 2;
        if (preview) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // จุดปลาย (เส้นที่ถูกเลือกแสดง handle ใหญ่ขึ้นสำหรับลากแก้ไข)
        if (d.type !== 'h') {
            ctx.setLineDash([]);
            [[x1, y1], [x2, y2]].forEach(([x, y]) => {
                ctx.beginPath(); ctx.arc(x, y, selected ? 5 : 3, 0, Math.PI * 2);
                ctx.fillStyle = selected ? '#ffffff' : d.color;
                ctx.fill();
                if (selected) { ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.stroke(); }
            });
        }
        // ป้ายค่าของเส้นแนวนอน (หน่วยตามกราฟ เช่น %)
        if (d.type === 'h') {
            const txt = (typeof d.p1.y === 'number' ? d.p1.y.toFixed(2) : d.p1.y) + (chart.$drawSuffix || '');
            ctx.font = 'bold 11px sans-serif';
            const w = ctx.measureText(txt).width + 8;
            ctx.fillStyle = d.color;
            ctx.fillRect(area.right - w, y1 - 9, w, 18);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(txt, area.right - w / 2, y1);
        }
        ctx.restore();
    }

    let pluginRegistered = false;
    function ensurePlugin() {
        if (pluginRegistered || typeof Chart === 'undefined') return;
        pluginRegistered = true;
        Chart.register({
            id: 'userDrawTool',
            afterDatasetsDraw(chart) {
                const key = chart.$drawKey;
                if (!key) return;
                const ctx = chart.ctx;
                (window.chartDrawings[key] || []).forEach(d => drawLine(chart, ctx, d));
                if (chart.$drawTemp) drawLine(chart, ctx, chart.$drawTemp, true);
            }
        });
    }

    // ---- Toolbar ----
    function buildToolbar(chart, key, state) {
        const parent = chart.canvas.parentElement;
        if (!parent) return;
        const old = parent.querySelector('.chart-draw-toolbar');
        if (old) old.remove();
        if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

        const bar = document.createElement('div');
        bar.className = 'chart-draw-toolbar';
        bar.style.cssText = 'position:absolute;top:4px;left:4px;z-index:20;display:flex;gap:2px;background:rgba(255,255,255,0.9);border:1px solid #e5e7eb;border-radius:8px;padding:2px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';

        const btnStyle = 'border:none;background:transparent;border-radius:6px;width:26px;height:26px;font-size:13px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;';

        function mkBtn(icon, title, onClick) {
            const b = document.createElement('button');
            b.type = 'button';
            b.style.cssText = btnStyle;
            b.title = title;
            b.innerHTML = icon;
            b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
            bar.appendChild(b);
            return b;
        }

        function refreshActive() {
            [state.btnTrend, state.btnH, state.btnEdit, state.btnErase].forEach(b => { if (b) b.style.background = 'transparent'; });
            const map = { trend: state.btnTrend, h: state.btnH, edit: state.btnEdit, erase: state.btnErase };
            if (state.mode && map[state.mode]) map[state.mode].style.background = '#fde68a';
            chart.canvas.style.cursor = state.mode === 'edit' ? 'grab' : (state.mode ? 'crosshair' : '');
        }

        state.setMode = function(mode) {
            state.mode = (state.mode === mode) ? null : mode;
            state.pending = null;
            state.drag = null;
            chart.$drawTemp = null;
            chart.$drawSelected = null;
            chart.$drawMode = state.mode; // ให้ onClick ของกราฟหลักเช็คได้
            // ปิด pan ของ zoom plugin ระหว่างวาด กันลากกราฟชนกับลากเส้น
            const zoomOpts = chart.options.plugins && chart.options.plugins.zoom;
            if (zoomOpts && zoomOpts.pan) {
                if (state.savedPan === undefined) state.savedPan = zoomOpts.pan.enabled;
                zoomOpts.pan.enabled = state.mode ? false : state.savedPan;
                chart.update('none');
            } else {
                chart.draw();
            }
            refreshActive();
        };

        state.btnTrend = mkBtn('✏️', 'วาดเส้นแนวโน้ม (คลิกจุดเริ่ม แล้วคลิกจุดปลาย)', () => state.setMode('trend'));
        state.btnH = mkBtn('━', 'วาดเส้นแนวนอน (คลิก 1 ครั้งที่ระดับที่ต้องการ)', () => state.setMode('h'));
        state.btnEdit = mkBtn('✋', 'ขยับ/แก้ไขเส้น (คลิกเลือกเส้น ลากทั้งเส้นหรือลากจุดปลาย, กด Delete ลบ)', () => state.setMode('edit'));

        const colorBtn = mkBtn('', 'เปลี่ยนสีเส้น', (b) => {
            state.colorIdx = (state.colorIdx + 1) % COLORS.length;
            b.querySelector('span').style.background = COLORS[state.colorIdx];
        });
        colorBtn.innerHTML = '<span style="display:block;width:14px;height:14px;border-radius:50%;background:' + COLORS[state.colorIdx] + ';"></span>';

        state.btnErase = mkBtn('🧽', 'โหมดลบ (คลิกใกล้เส้นเพื่อลบ)', () => state.setMode('erase'));
        mkBtn('↩️', 'ลบเส้นล่าสุด', () => {
            const list = loadDrawings(key);
            list.pop();
            saveDrawings(key);
            chart.draw();
        });
        mkBtn('🗑️', 'ลบเส้นทั้งหมด', () => {
            window.chartDrawings[key] = [];
            saveDrawings(key);
            chart.draw();
        });

        parent.appendChild(bar);
        refreshActive();
    }

    // ---- Event handlers บน canvas ----
    function bindEvents(chart, key, state) {
        const canvas = chart.canvas;
        // ถอด handler เก่า (กรณี re-render สร้าง chart ใหม่บน canvas เดิม)
        if (canvas.$drawHandlers) {
            Object.entries(canvas.$drawHandlers).forEach(([ev, fn]) => canvas.removeEventListener(ev, fn));
        }

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function inArea(p) {
            const a = chart.chartArea;
            return p.x >= a.left && p.x <= a.right && p.y >= a.top && p.y <= a.bottom;
        }

        // หาเส้นที่อยู่ใกล้จุดคลิกที่สุด (ใช้ทั้งโหมดลบและโหมดขยับ)
        function hitTestLine(p) {
            const list = loadDrawings(key);
            let bestIdx = -1, bestDist = HIT_TOLERANCE;
            list.forEach((d, i) => {
                const px = linePixels(chart, d);
                if (!px) return;
                const dist = distToSegment(p.x, p.y, px.x1, px.y1, px.x2, px.y2);
                if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            });
            return bestIdx;
        }

        const onDown = function(e) {
            if (!state.mode) return;
            const p = getPos(e);
            if (!inArea(p)) return;
            e.preventDefault(); e.stopPropagation();

            if (state.mode === 'h') {
                const pt = pxToData(chart, p.x, p.y);
                loadDrawings(key).push({ type: 'h', p1: pt, color: COLORS[state.colorIdx] });
                saveDrawings(key);
                chart.draw();
                return;
            }
            if (state.mode === 'erase') {
                const idx = hitTestLine(p);
                if (idx >= 0) {
                    loadDrawings(key).splice(idx, 1);
                    saveDrawings(key);
                    chart.draw();
                }
                return;
            }
            if (state.mode === 'edit') {
                // คลิกเลือกเส้น: โดนจุดปลาย = ลากปรับจุดนั้น, โดนตัวเส้น = ลากทั้งเส้น
                const list = loadDrawings(key);
                let hit = null;
                for (const d of list) {
                    const px = linePixels(chart, d);
                    if (!px) continue;
                    if (d.type !== 'h') {
                        if (Math.hypot(p.x - px.x1, p.y - px.y1) <= HIT_TOLERANCE) { hit = { d, kind: 'p1', px }; break; }
                        if (Math.hypot(p.x - px.x2, p.y - px.y2) <= HIT_TOLERANCE) { hit = { d, kind: 'p2', px }; break; }
                    }
                    if (distToSegment(p.x, p.y, px.x1, px.y1, px.x2, px.y2) <= HIT_TOLERANCE) { hit = { d, kind: 'body', px }; break; }
                }
                chart.$drawSelected = hit ? hit.d : null;
                state.drag = hit ? { d: hit.d, kind: hit.kind, startX: p.x, startY: p.y, orig: hit.px } : null;
                chart.canvas.style.cursor = hit ? 'grabbing' : 'grab';
                chart.draw();
                return;
            }
            // โหมดเส้นแนวโน้ม: คลิกแรก = จุดเริ่ม, คลิกสอง = จุดจบ
            if (!state.pending) {
                state.pending = pxToData(chart, p.x, p.y);
            } else {
                const p2 = pxToData(chart, p.x, p.y);
                loadDrawings(key).push({ type: 'trend', p1: state.pending, p2: p2, color: COLORS[state.colorIdx] });
                saveDrawings(key);
                state.pending = null;
                chart.$drawTemp = null;
                chart.draw();
            }
        };

        const onMove = function(e) {
            // ลากขยับ/แก้ไขเส้นที่เลือกในโหมด edit
            if (state.mode === 'edit' && state.drag) {
                e.preventDefault();
                const p = getPos(e);
                const dx = p.x - state.drag.startX, dy = p.y - state.drag.startY;
                const d = state.drag.d, o = state.drag.orig;
                if (d.type === 'h') {
                    d.p1.y = chart.scales.y.getValueForPixel(o.y1 + dy);
                } else if (state.drag.kind === 'p1') {
                    d.p1 = pxToData(chart, o.x1 + dx, o.y1 + dy);
                } else if (state.drag.kind === 'p2') {
                    d.p2 = pxToData(chart, o.x2 + dx, o.y2 + dy);
                } else {
                    d.p1 = pxToData(chart, o.x1 + dx, o.y1 + dy);
                    d.p2 = pxToData(chart, o.x2 + dx, o.y2 + dy);
                }
                chart.draw();
                return;
            }
            if (state.mode !== 'trend' || !state.pending) return;
            const p = getPos(e);
            chart.$drawTemp = { type: 'trend', p1: state.pending, p2: pxToData(chart, p.x, p.y), color: COLORS[state.colorIdx] };
            chart.draw();
        };

        const onUp = function() {
            if (state.drag) {
                state.drag = null;
                saveDrawings(key);
                if (state.mode === 'edit') chart.canvas.style.cursor = 'grab';
            }
        };

        const onKey = function(e) {
            if (e.key === 'Escape' && state.mode) state.setMode(state.mode); // toggle ปิด
            // Delete/Backspace ลบเส้นที่เลือกอยู่ในโหมดขยับ
            if ((e.key === 'Delete' || e.key === 'Backspace') && chart.$drawSelected) {
                const list = loadDrawings(key);
                const i = list.indexOf(chart.$drawSelected);
                if (i >= 0) list.splice(i, 1);
                chart.$drawSelected = null;
                state.drag = null;
                saveDrawings(key);
                chart.draw();
            }
        };

        canvas.$drawHandlers = { pointerdown: onDown, pointermove: onMove };
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        // pointerup ผูกกับ document เพื่อจับการปล่อยเมาส์นอก canvas ด้วย
        if (canvas.$drawUpHandler) document.removeEventListener('pointerup', canvas.$drawUpHandler);
        canvas.$drawUpHandler = onUp;
        document.addEventListener('pointerup', onUp);
        // Escape ผูกกับ document ครั้งเดียวต่อ canvas
        if (canvas.$drawKeyHandler) document.removeEventListener('keydown', canvas.$drawKeyHandler);
        canvas.$drawKeyHandler = onKey;
        document.addEventListener('keydown', onKey);
    }

    window.initChartDrawTool = function(chart, key, opts) {
        if (!chart || !chart.canvas) return;
        ensurePlugin();
        loadDrawings(key);
        chart.$drawKey = key;
        chart.$drawSuffix = (opts && opts.suffix !== undefined) ? opts.suffix : '%';
        const state = { mode: null, pending: null, colorIdx: 0 };
        buildToolbar(chart, key, state);
        bindEvents(chart, key, state);
        // วาดเส้นที่บันทึกไว้ทันที (กันเฟรมแรกที่ render ก่อน init เสร็จ)
        if ((window.chartDrawings[key] || []).length) requestAnimationFrame(() => { if (chart.ctx) chart.draw(); });
    };
})();
