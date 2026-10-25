// ==========================================
// แถบแท็บแบบ browser (บนสุดใต้ Navbar)
// - แท็บ = หน้า (section) ที่เปิดค้างไว้ จำใน localStorage ข้ามการรีเฟรช
// - สลับแท็บ = เรียก window.switchTab เดิม (เช็คสิทธิ์ / โหลดข้อมูลแบบเดิมทั้งหมด)
// - เลือกเมนูปกติ = เปลี่ยนหน้าในแท็บที่เปิดอยู่ เหมือน browser
// - + = แท็บใหม่เป็นหน้าเปล่า ให้เลือกเมนูไหนก็ได้
// - Ctrl/⌘+คลิก หรือคลิกกลางที่เมนู = เปิดหน้านั้นเป็นแท็บใหม่ (ยังอยู่หน้าเดิม)
// ==========================================
(function () {
    const STORE_KEY = 'cwm_browser_tabs';
    const MAX_TABS = 12;
    const NEW_TAB = 'newtab';
    const SECTIONS = ['inbox', 'form', 'planning', 'dashboard', 'admin', 'rtv', 'scrap', 'dailycheck', 'packing', 'parts', 'cost'];

    const origSwitch = window.switchTab;
    if (typeof origSwitch !== 'function') return;

    let restored = false;

    function load() {
        try {
            const st = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
            if (st && Array.isArray(st.tabs)) return st;
        } catch (e) { /* storage เสีย/ปิด → เริ่มใหม่ */ }
        return { tabs: [], active: '' };
    }
    function save(st) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) { /* ใช้ได้แค่รอบนี้ */ }
    }
    function uid() {
        return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    // ปุ่มเมนูที่ผู้ใช้คนนี้เห็น (applyPermissions ซ่อนด้วย display:none !important)
    function isVisible(el) {
        return !!el && el.style.display !== 'none' && !el.classList.contains('hidden');
    }
    function menuLabel(btn) {
        const clone = btn.cloneNode(true);
        clone.querySelectorAll('span').forEach(s => s.remove()); // ตัด badge จำนวน Inbox
        return clone.textContent.replace('↗️', '').replace(/\s+/g, ' ').trim();
    }
    function sectionLabel(id) {
        if (id === NEW_TAB) return '➕ แท็บใหม่';
        const btn = document.getElementById('tab-' + id);
        return btn ? menuLabel(btn) : id;
    }
    function isShown(id) {
        const el = document.getElementById('section-' + id);
        return !!el && !el.classList.contains('hidden');
    }

    // ── หน้าแท็บใหม่ ──
    function ensureNewTabSection() {
        let sec = document.getElementById('section-' + NEW_TAB);
        if (sec) return sec;
        sec = document.createElement('main');
        sec.id = 'section-' + NEW_TAB;
        sec.className = 'max-w-6xl mx-auto p-4 hidden print-hide';
        sec.innerHTML = '<div class="bg-white rounded-xl shadow p-5">' +
            '<h2 class="font-bold text-lg text-gray-800 mb-4">เลือกเมนูที่จะเปิดในแท็บนี้</h2>' +
            '<div class="cwm-newtab-grid" id="cwmNewTabGrid"></div></div>';
        const firstMain = document.querySelector('main[id^="section-"]');
        if (firstMain) firstMain.parentNode.insertBefore(sec, firstMain);
        else document.body.appendChild(sec);
        sec.addEventListener('click', e => {
            const tile = e.target.closest('[data-menu-id]');
            if (!tile) return;
            const btn = document.getElementById(tile.getAttribute('data-menu-id'));
            if (!btn) return;
            btn.click(); // ทำงานเหมือนกดเมนูจริง (หน้า, modal, ลิงก์ภายนอก)
            const dd = document.getElementById('dropdown-menu');
            if (dd) dd.classList.add('hidden'); // ปุ่มเมนูสั่ง toggleMenu ด้วย — ปิด dropdown คืน
        });
        return sec;
    }
    function showNewTab() {
        const sec = ensureNewTabSection();
        document.querySelectorAll('main[id^="section-"]').forEach(m => m.classList.toggle('hidden', m !== sec));
        const items = Array.from(document.querySelectorAll('#dropdown-menu > button[id^="tab-"]')).filter(isVisible);
        document.getElementById('cwmNewTabGrid').innerHTML = items.map(btn =>
            '<button type="button" class="cwm-newtab-item" data-menu-id="' + btn.id + '">' + menuLabel(btn) + '</button>'
        ).join('') || '<p class="text-gray-500">ไม่มีเมนูที่เข้าถึงได้</p>';
    }

    // เปิดหน้า id จริง (ไม่บันทึกสถานะแท็บ) — คืน true ถ้าเปิดได้ (ผ่านสิทธิ์)
    function open(id) {
        if (id === NEW_TAB) { showNewTab(); return true; }
        const nt = document.getElementById('section-' + NEW_TAB);
        if (nt) nt.classList.add('hidden');
        origSwitch(id);
        return isShown(id);
    }

    // ── แถบแท็บ ──
    function render() {
        const st = load();
        let bar = document.getElementById('cwmBrowserTabs');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'cwmBrowserTabs';
            bar.className = 'cwm-tabs print-hide';
            const nav = document.querySelector('nav');
            const dd = document.getElementById('dropdown-menu');
            if (nav && dd) nav.insertBefore(bar, dd);
            else document.body.insertBefore(bar, document.body.firstChild);
            bar.addEventListener('click', onBarClick);
            bar.addEventListener('auxclick', e => {
                const t = e.target.closest('[data-tab-uid]');
                if (t && e.button === 1) { e.preventDefault(); closeTab(t.getAttribute('data-tab-uid')); }
            });
        }
        const many = st.tabs.length > 1;
        bar.innerHTML = '<div class="cwm-tabs-list" role="tablist">' + st.tabs.map(t =>
            '<div class="cwm-tab' + (t.uid === st.active ? ' active' : '') + '" role="tab" data-tab-uid="' + t.uid + '" title="' + sectionLabel(t.id) + '">' +
            '<span>' + sectionLabel(t.id) + '</span>' +
            (many ? '<button type="button" class="cwm-tab-close" data-tab-close="' + t.uid + '" aria-label="ปิดแท็บ">&times;</button>' : '') +
            '</div>'
        ).join('') + '</div>' +
            '<button type="button" class="cwm-tab-add" id="cwmTabAdd" title="เปิดแท็บใหม่" aria-label="เปิดแท็บใหม่">+</button>';
        const act = bar.querySelector('.cwm-tab.active');
        if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function onBarClick(e) {
        const close = e.target.closest('[data-tab-close]');
        if (close) { e.stopPropagation(); closeTab(close.getAttribute('data-tab-close')); return; }
        if (e.target.closest('#cwmTabAdd')) { openNew(NEW_TAB, true); return; }
        const tab = e.target.closest('[data-tab-uid]');
        if (tab) activate(tab.getAttribute('data-tab-uid'));
    }

    function activate(tabUid) {
        const st = load();
        const t = st.tabs.find(x => x.uid === tabUid);
        if (!t) return;
        st.active = tabUid;
        save(st);
        if (!open(t.id)) { t.id = NEW_TAB; save(st); showNewTab(); }
        render();
        window.scrollTo(0, 0);
    }

    function closeTab(tabUid) {
        const st = load();
        const idx = st.tabs.findIndex(x => x.uid === tabUid);
        if (idx < 0 || st.tabs.length <= 1) return;
        const wasActive = st.active === tabUid;
        st.tabs.splice(idx, 1);
        save(st);
        if (wasActive) activate(st.tabs[Math.min(idx, st.tabs.length - 1)].uid);
        else render();
    }

    function openNew(id, focus) {
        const st = load();
        const t = { uid: uid(), id: id };
        st.tabs.push(t);
        st.tabs = st.tabs.slice(-MAX_TABS);
        save(st);
        if (focus) activate(t.uid);
        else render();
    }

    // ── ห่อ switchTab: เมนูปกติ = เปลี่ยนหน้าในแท็บที่เปิดอยู่ ──
    window.switchTab = function (tab) {
        if (!window.currentUser) return origSwitch.apply(this, arguments);
        if (!restored) {
            // เข้าระบบครั้งแรก (applyPermissions เรียกด้วยหน้าเริ่มต้น) → กลับไปแท็บที่เปิดค้างไว้ก่อนรีเฟรช
            restored = true;
            const st = load();
            const t = st.tabs.find(x => x.uid === st.active);
            if (t && open(t.id)) { render(); return; }
        }
        if (tab === NEW_TAB) { showNewTab(); } else {
            const nt = document.getElementById('section-' + NEW_TAB);
            if (nt) nt.classList.add('hidden');
            origSwitch.apply(this, arguments);
            if (!isShown(tab)) return; // ไม่มีสิทธิ์ → หน้าเดิมยังอยู่
        }
        const st = load();
        let cur = st.tabs.find(x => x.uid === st.active);
        if (!cur) { cur = { uid: uid(), id: tab }; st.tabs.push(cur); st.active = cur.uid; }
        cur.id = tab;
        st.tabs = st.tabs.slice(-MAX_TABS);
        save(st);
        render();
    };

    // Ctrl/⌘+คลิก หรือคลิกกลางที่เมนูที่เป็นหน้า = เปิดเป็นแท็บใหม่ ไม่เปลี่ยนหน้าปัจจุบัน
    function menuSection(target) {
        const btn = target.closest && target.closest('#dropdown-menu > button[id^="tab-"]');
        if (!btn) return '';
        const id = btn.id.slice(4);
        return SECTIONS.indexOf(id) >= 0 && document.getElementById('section-' + id) ? id : '';
    }
    document.addEventListener('click', e => {
        if (!(e.ctrlKey || e.metaKey) || !window.currentUser) return;
        const id = menuSection(e.target);
        if (!id) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
        openNew(id, false);
    }, true);
    document.addEventListener('auxclick', e => {
        if (e.button !== 1 || !window.currentUser) return;
        const id = menuSection(e.target);
        if (!id) return;
        e.preventDefault();
        openNew(id, false);
    }, true);
})();
