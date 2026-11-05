// 🛠️ Daily Check Machine (AM) — ตรวจเช็คเครื่องจักรประจำวัน ทุกเครื่อง (CWM-01..16)
// หัวข้อ/ตัวเลือกคัดลอกตาม Google Form เดิม (B-CWMxx) — เก็บลงชีต Machine_Check (SAVE_MACHINE_CHECK / GET_MACHINE_CHECKS / DELETE_MACHINE_CHECK)
(function(){
  const MACHINES = Array.from({length: 16}, (_, i) => 'CWM-' + String(i + 1).padStart(2, '0'));
  const LINE = 'S/A.. CoilWinding';
  const AIR_MIN = 5, AIR_MAX = 7; // bar

  // ข้อความตามแบบฟอร์มเดิม (ok = คำตอบที่ถูกต้อง, ng = คำตอบเมื่อผิดปกติ)
  const ITEMS = [
    { key: 'AM1', type: 'choice', title: '1. ตรวจเช็คปุ่มกดหยุดฉุกเฉิน(Emergency Stop) (AM1)',
      ok: 'อยู่ในสภาพสมบรูณ์ พร้อมใช้งาน ไม่แตกชำรุดและต้องคลายออก',
      ng: 'ชำรุด ไม่สามารถคลายออกได้' },
    { key: 'AM2', type: 'number', title: '2. ตรวจเช็คระบบลม สเปค 5-7 bar/ 0.5-0.7 Mpa (AM2)' },
    { key: 'AM3', type: 'choice', title: '3.ตรวจเช็คสัญญาณไฟโชว์ (Power on) และจอแสดงผล (AM3)',
      ok: 'อยู่ในสภาพสมบรูณ์ หลอดไฟต้องติดสว่างและหน้าแสดงตัวอักษรปกติ พร้อมใช้งาน',
      ng: 'ชำรุด หลอดไฟไม่ติด หรือหน้าจอแสดงผลผิดปกติ' },
    { key: 'AM4', type: 'choice', title: '4.หล่อลื่นตามคู่มือกำหนด และชุดปอก wire(AM4)',
      ok: 'อยู่ในสภาพสมบรูณ์ หยอดตามจุดที่กำหนด ดูที่แผ่นแมนนวล',
      ng: 'ผิดปกติ ไม่ได้หยอดตามจุดที่กำหนด หรือชุดปอก wire ชำรุด' }
  ];
  const T_ABN = '5.สิ่งผิดปกติที่ตรวจพบเพิ่มเติม';
  const T_RESULT = '6. ผลการตรวจ';
  const T_SESA = '7. SESA ผู้ตรวจ กรอกแต่ตัวเลข';
  const SHIFT_LABEL = { Day: 'กะเช้า', Night: 'กะดึก' };

  let dayRecords = [];
  let histRecords = [];
  let monthRecords = [];
  let state = {};          // { AM1: text, AM2: '6', AM3: text, AM4: text }
  let resultOverride = ''; // '' = อัตโนมัติ, 'PASS' / 'FAIL'
  let images = [];         // รูปแนบประกอบหัวข้อ (Admin แนบ) — { Image_ID, Item, Machine, Url, Caption }
  let imagesLoaded = false;
  let initialized = false;
  let backfill = null;     // โหมดบันทึกย้อนหลัง: { date, machine, shift } — ผู้ตรวจจริงกรอกตามใบตรวจ/หลักฐาน
  const IMG_MAX = 1600, IMG_QUALITY = 0.85;

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(id){ return document.getElementById(id); }
  function userName(){ return window.currentUser?.name || window.currentUser?.username || '-'; }
  // SESA ของผู้ที่ login: username เป็นตัวเลข หรือเลขนำหน้าชื่อ (เช่น "65003 พีรพล") — '' = หาไม่ได้ ให้กรอกเอง
  function loginSesa(){
    const u = window.currentUser || {};
    const un = String(u.username || '').trim();
    if (/^\d+$/.test(un)) return un;
    const m = String(u.name || '').trim().match(/^(\d{3,})\b/);
    return m ? m[1] : '';
  }
  function applyLoginSesa(){
    const inp = $('mk-sesa'), note = $('mk-sesa-note');
    const sesa = loginSesa();
    inp.value = sesa;
    inp.readOnly = !!sesa;
    inp.classList.toggle('bg-gray-100', !!sesa);
    note.textContent = sesa ? `อ้างอิงจากผู้ใช้ที่ login: ${userName()}` : 'ไม่พบ SESA ในบัญชีผู้ใช้ — กรุณากรอกเอง';
  }
  function post(payload){
    return fetch(`${SCRIPT_URL}?_t=${Date.now()}`, { method: 'POST', cache: 'no-store', body: JSON.stringify(payload) }).then(r => r.json());
  }
  function currentShift(){ const h = new Date().getHours(); return (h >= 8 && h < 20) ? 'Day' : 'Night'; }
  function nowTime(){ const d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':'); }
  function addDays(dateStr, n){
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lsGet(k){ try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }

  // ข้อนี้ผ่านไหม: true / false / null (ยังไม่ตอบ)
  function itemOk(it, v){
    if (v === undefined || v === null || v === '') return null;
    if (it.type === 'number') {
      const n = parseFloat(v);
      if (isNaN(n)) return null;
      return n >= AIR_MIN && n <= AIR_MAX;
    }
    return v === it.ok;
  }
  function autoResult(st){
    const oks = ITEMS.map(it => itemOk(it, st[it.key]));
    if (oks.some(o => o === false)) return 'FAIL';
    if (oks.every(o => o === true)) return 'PASS';
    return '';
  }
  function finalResult(){ return resultOverride || autoResult(state); }
  function recordFailed(r){ return String(r.Result || '').toUpperCase() !== 'PASS'; }
  function isBackfill(r){ return String(r.Entry_Type || '') === 'Backfill'; }
  const BF_BADGE = '<span class="ml-1 px-1 rounded bg-purple-100 text-purple-700 text-[10px] font-bold" title="บันทึกย้อนหลัง">ย้อนหลัง</span>';

  // ===== สถานะเครื่องประจำวัน =====
  async function loadDay(){
    const date = $('mk-date').value;
    const grid = $('mk-machine-grid');
    grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-3">กำลังโหลด...</div>';
    try {
      const res = await post({ action: 'GET_MACHINE_CHECKS', dateFrom: date, dateTo: date });
      dayRecords = res && res.status === 'success' ? res.data : [];
    } catch (e) {
      dayRecords = [];
      grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-3">โหลดข้อมูลไม่สำเร็จ</div>';
      return;
    }
    renderGrid();
  }

  function renderGrid(){
    const grid = $('mk-machine-grid');
    let pass = 0, fail = 0;
    grid.innerHTML = MACHINES.map(mc => {
      const recs = dayRecords.filter(r => r.Machine === mc);
      const last = recs[0];
      let cls = 'bg-gray-50 border-gray-300 text-gray-500', status = 'ยังไม่ตรวจ';
      if (last) {
        if (recordFailed(last)) { cls = 'bg-red-50 border-red-400 text-red-700'; status = 'FAIL'; fail++; }
        else { cls = 'bg-green-50 border-green-400 text-green-700'; status = 'PASS'; pass++; }
      }
      const sub = last ? `${esc(last.Check_Time)} · ${esc(last.AM2)} bar` : '&nbsp;';
      return `<button type="button" data-mc="${mc}" class="mk-mc-btn border-2 rounded-lg p-2 text-center hover:shadow ${cls}">
        <div class="font-bold text-sm">${mc}</div>
        <div class="text-xs font-bold">${status}</div>
        <div class="text-[10px] truncate">${sub}</div>
      </button>`;
    }).join('');
    grid.querySelectorAll('.mk-mc-btn').forEach(btn => btn.addEventListener('click', () => openForm(btn.dataset.mc)));
    const missing = MACHINES.length - pass - fail;
    $('mk-summary').innerHTML = `<span class="font-bold">${esc($('mk-date').value)}</span> — ` +
      `ตรวจแล้ว <b class="text-green-700">${pass + fail}/${MACHINES.length}</b> เครื่อง` +
      (fail ? ` · <b class="text-red-600">FAIL ${fail}</b>` : '') +
      (missing ? ` · <b class="text-gray-600">ยังไม่ตรวจ ${missing}</b>` : ' · <b class="text-green-700">ครบทุกเครื่อง ✔</b>');
  }

  // ===== รูปแนบประกอบหัวข้อ (Admin แนบได้ / ทุกคนเห็น) =====
  function isAdmin(){ return window.currentUser?.role === 'Admin'; }
  function driveId(url){ const m = String(url || '').match(/\/d\/([^/?#]+)/) || String(url || '').match(/id=([^&]+)/); return m ? m[1] : ''; }
  function thumbUrl(url, w){ const id = driveId(url); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${w || 400}` : url; }

  async function loadImages(force){
    if (imagesLoaded && !force) return;
    try {
      const res = await post({ action: 'GET_MACHINE_CHECK_IMAGES' });
      images = res && res.status === 'success' ? res.data : [];
      imagesLoaded = true;
    } catch (e) { images = []; }
  }

  // รูปของหัวข้อนี้: รูปที่ใช้กับทุกเครื่อง + รูปเฉพาะเครื่องที่เลือก
  function imgBlock(item){
    const mc = $('mk-machine').value;
    const list = images.filter(im => im.Item === item && (!im.Machine || im.Machine === mc));
    const admin = isAdmin();
    if (!list.length && !admin) return '';
    const thumbs = list.map(im => `<div class="relative group w-28">
        <img src="${esc(thumbUrl(im.Url))}" data-url="${esc(im.Url)}" data-cap="${esc(im.Caption)}" alt="${esc(im.Caption || 'รูปประกอบ')}" loading="lazy"
          class="mk-img w-28 h-24 object-cover rounded-lg border cursor-zoom-in bg-gray-100">
        <div class="text-[10px] text-gray-500 truncate" title="${esc(im.Caption)}">${esc(im.Caption || '')}${im.Machine ? ` <span class="text-blue-600">(${esc(im.Machine)})</span>` : ''}</div>
        ${admin ? `<button type="button" data-id="${esc(im.Image_ID)}" class="mk-img-del absolute top-1 right-1 bg-white/90 hover:bg-red-600 hover:text-white text-red-600 rounded-full w-6 h-6 text-xs font-bold shadow" title="ลบรูป">✕</button>` : ''}
      </div>`).join('');
    const up = admin ? `<div class="flex flex-col gap-1 justify-center">
        <button type="button" data-item="${item}" class="mk-img-add border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-2 text-xs font-bold">📷 แนบรูป</button>
        <select data-item="${item}" class="mk-img-scope border rounded p-1 text-[11px] bg-white">
          <option value="">ใช้กับทุกเครื่อง</option>
          <option value="${esc(mc)}">เฉพาะ ${esc(mc)}</option>
        </select>
      </div>` : '';
    return `<div class="flex flex-wrap gap-2 mb-2">${thumbs}${up}</div>`;
  }

  function bindImgEvents(root){
    root.querySelectorAll('.mk-img').forEach(img => {
      img.addEventListener('click', () => {
        if (typeof window.openPmPhoto === 'function') window.openPmPhoto(img.dataset.url, img.dataset.cap);
        else window.open(img.dataset.url, '_blank');
      });
      img.addEventListener('error', () => { img.onerror = null; img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="112" height="96"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" font-size="11" text-anchor="middle" fill="#9ca3af">โหลดรูปไม่ได้</text></svg>'); }, { once: true });
    });
    root.querySelectorAll('.mk-img-add').forEach(b => b.addEventListener('click', () => {
      const scope = root.querySelector(`.mk-img-scope[data-item="${b.dataset.item}"]`);
      pickAndUpload(b.dataset.item, scope ? scope.value : '', b);
    }));
    root.querySelectorAll('.mk-img-del').forEach(b => b.addEventListener('click', () => deleteImage(b)));
  }

  function resizeImage(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพ'));
        img.onload = () => {
          const scale = Math.min(1, IMG_MAX / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', IMG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function pickAndUpload(item, machine, btn){
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const caption = prompt('คำอธิบายรูป (ไม่บังคับ)', '') ;
      if (caption === null) return;
      const label = btn.textContent;
      btn.disabled = true;
      let ok = 0; const errs = [];
      for (let i = 0; i < files.length; i++) {
        btn.textContent = `กำลังอัปโหลด ${i + 1}/${files.length}...`;
        try {
          const dataUrl = await resizeImage(files[i]);
          const res = await post({ action: 'SAVE_MACHINE_CHECK_IMAGE', item, machine, caption: caption.trim(), image: dataUrl,
            username: window.currentUser?.username || '', role: window.currentUser?.role || '' });
          if (res && res.status === 'success') { images.push(res.image); ok++; }
          else errs.push(files[i].name + ': ' + (res?.message || 'error'));
        } catch (e) { errs.push(files[i].name + ': ' + e.message); }
      }
      btn.disabled = false; btn.textContent = label;
      if (errs.length) alert(`แนบสำเร็จ ${ok} รูป, ไม่สำเร็จ ${errs.length} รูป\n` + errs.join('\n'));
      renderFormImages(); renderItems();
    });
    input.click();
  }

  async function deleteImage(btn){
    if (!confirm('ลบรูปนี้? (รูปจะถูกลบออกจาก Google Drive ด้วย)')) return;
    btn.disabled = true;
    try {
      const res = await post({ action: 'DELETE_MACHINE_CHECK_IMAGE', imageId: btn.dataset.id, username: window.currentUser?.username || '', role: window.currentUser?.role || '' });
      if (res && res.status === 'success') {
        images = images.filter(im => im.Image_ID !== btn.dataset.id);
        renderFormImages(); renderItems();
      } else { alert('ลบไม่สำเร็จ: ' + (res?.message || '')); btn.disabled = false; }
    } catch (e) { alert('ลบไม่สำเร็จ: ' + e.message); btn.disabled = false; }
  }

  // รูปประกอบทั้งฟอร์ม (เช่น รูปเครื่อง / แผ่นแมนนวล) แสดงบนสุดของฟอร์ม
  function renderFormImages(){
    const box = $('mk-form-images');
    const html = imgBlock('FORM');
    box.innerHTML = html ? `<div class="text-xs font-bold text-gray-600 mb-1">🖼️ รูปประกอบ / คู่มือ${isAdmin() ? ' <span class="font-normal text-gray-400">(Admin: แนบรูปที่ทุกคนต้องดูก่อนตรวจ)</span>' : ''}</div>${html}` : '';
    box.classList.toggle('hidden', !html);
    bindImgEvents(box);
  }

  // ===== ฟอร์ม (เหมือน Google Form) =====
  function qCard(title, required, inner, bad, item){
    return `<div class="border rounded-lg p-3 ${bad ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}">
      <div class="text-sm font-bold text-gray-800 mb-2">${esc(title)}${required ? ' <span class="text-red-600">*</span>' : ''}</div>
      ${item ? imgBlock(item) : ''}
      ${inner}
    </div>`;
  }
  function radio(name, value, checked, tone){
    const ring = tone === 'ng' ? 'peer-checked:border-red-500 peer-checked:bg-red-50' : 'peer-checked:border-green-500 peer-checked:bg-green-50';
    return `<label class="block cursor-pointer">
      <input type="radio" name="${name}" value="${esc(value)}" class="peer sr-only mk-radio" data-key="${name.replace('mk-q-', '')}" ${checked ? 'checked' : ''}>
      <div class="flex items-start gap-2 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm ${ring}">
        <span class="mt-0.5 inline-block w-4 h-4 rounded-full border-2 ${checked ? (tone === 'ng' ? 'border-red-500 bg-red-500' : 'border-green-500 bg-green-500') : 'border-gray-400'} shrink-0"></span>
        <span>${esc(value)}</span>
      </div>
    </label>`;
  }

  function renderItems(){
    const html = ITEMS.map(it => {
      const v = state[it.key];
      const ok = itemOk(it, v);
      if (it.type === 'number') {
        const chips = [5, 6, 7].map(n => `<button type="button" data-air="${n}" class="mk-air px-4 py-1.5 rounded-lg border-2 text-sm font-bold ${String(v) === String(n) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300'}">${n}</button>`).join('');
        const note = ok === false ? `<div class="text-xs text-red-600 font-bold mt-1">⚠ ไม่อยู่ในสเปค ${AIR_MIN}-${AIR_MAX} bar</div>` : '';
        return qCard(it.title, true, `<div class="flex flex-wrap items-center gap-2">
            ${chips}
            <input id="mk-air-input" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(v || '')}" placeholder="ค่าอื่น" class="w-24 border rounded-lg p-1.5 text-sm">
            <span class="text-xs text-gray-500">bar</span>
          </div>${note}`, ok === false, it.key);
      }
      return qCard(it.title, true, `<div class="space-y-1.5">${radio('mk-q-' + it.key, it.ok, v === it.ok, 'ok')}${radio('mk-q-' + it.key, it.ng, v === it.ng, 'ng')}</div>`, ok === false, it.key);
    }).join('');
    $('mk-items').innerHTML = html;
    bindImgEvents($('mk-items'));
    $('mk-items').querySelectorAll('.mk-radio').forEach(r => r.addEventListener('change', () => {
      state[r.dataset.key] = r.value; resultOverride = ''; renderItems();
    }));
    $('mk-items').querySelectorAll('.mk-air').forEach(b => b.addEventListener('click', () => {
      state.AM2 = b.dataset.air; resultOverride = ''; renderItems();
    }));
    const air = $('mk-air-input');
    air.addEventListener('change', () => { state.AM2 = air.value.trim(); resultOverride = ''; renderItems(); });
    renderResult();
  }

  function renderResult(){
    const auto = autoResult(state);
    const res = finalResult();
    ['PASS', 'FAIL'].forEach(v => {
      const b = $('mk-res-' + v);
      const on = res === v;
      b.className = 'px-6 py-2 rounded-lg border-2 font-bold text-sm ' + (on
        ? (v === 'PASS' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600')
        : (v === 'PASS' ? 'bg-white text-green-700 border-green-300' : 'bg-white text-red-600 border-red-300'));
    });
    $('mk-res-hint').textContent = auto ? (resultOverride && resultOverride !== auto ? `(ระบบคำนวณได้ ${auto})` : '(คำนวณอัตโนมัติจากข้อ 1-4)') : 'ตอบข้อ 1-4 ให้ครบ';
    $('mk-abn-req').classList.toggle('hidden', res !== 'FAIL');
  }

  function openForm(machine){
    $('mk-form-card').classList.remove('hidden');
    $('mk-machine').value = machine;
    $('mk-form-title').textContent = `${machine} · ${$('mk-date').value}`;
    const bf = backfill && backfill.machine === machine && backfill.date === $('mk-date').value ? backfill : null;
    if (!bf) backfill = null;
    $('mk-backfill-box').classList.toggle('hidden', !bf);
    $('mk-backfill-ref').value = '';
    $('mk-time').value = bf ? '' : nowTime();           // ย้อนหลัง: ต้องกรอกเวลาตรวจจริงจากใบตรวจ
    $('mk-shift').value = bf ? bf.shift : currentShift();
    if (bf) $('mk-form-title').textContent += ' · ' + (SHIFT_LABEL[bf.shift] || bf.shift) + ' (ย้อนหลัง)';
    $('mk-abn').value = '';
    applyLoginSesa();
    state = {}; resultOverride = '';
    const done = dayRecords.filter(r => r.Machine === machine);
    $('mk-already').classList.toggle('hidden', !done.length);
    if (done.length) $('mk-already').textContent = `เครื่องนี้ตรวจแล้ววันนี้ ${done.length} ครั้ง (ล่าสุด ${done[0].Check_Time} · ${done[0].Result}) — บันทึกซ้ำได้ถ้าตรวจใหม่`;
    renderFormImages();
    renderItems();
    $('mk-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!imagesLoaded) loadImages().then(() => { if ($('mk-machine').value === machine) { renderFormImages(); renderItems(); } });
  }

  async function saveForm(){
    const machine = $('mk-machine').value;
    if (!machine) return alert('กรุณาเลือกเครื่อง (Select Machine)');
    const miss = ITEMS.filter(it => itemOk(it, state[it.key]) === null);
    if (miss.length) return alert('กรุณาตอบให้ครบ: ' + miss.map(m => m.title).join('\n'));
    const result = finalResult();
    if (!result) return alert('กรุณาเลือก "6. ผลการตรวจ"');
    const abn = $('mk-abn').value.trim();
    if (result === 'FAIL' && !abn) return alert('ผลการตรวจ FAIL — กรุณากรอก "5.สิ่งผิดปกติที่ตรวจพบเพิ่มเติม"');
    const sesa = $('mk-sesa').value.trim();
    if (!/^\d+$/.test(sesa)) return alert('กรุณากรอก "7. SESA ผู้ตรวจ" เป็นตัวเลขเท่านั้น');
    const bfRef = backfill ? $('mk-backfill-ref').value.trim() : '';
    if (backfill) {
      if (!$('mk-time').value) return alert('บันทึกย้อนหลัง — กรุณากรอก "เวลา" ที่ตรวจจริงตามใบตรวจ');
      if (!bfRef) return alert('บันทึกย้อนหลัง — กรุณาระบุแหล่งที่มา/หลักฐาน (เช่น ใบตรวจกระดาษ)');
      if (!confirm('ยืนยันว่าข้อมูลนี้ตรงกับผลตรวจจริงตามหลักฐาน และ SESA ' + sesa + ' คือผู้ที่ตรวจจริง?')) return;
    }

    const btn = $('btn-mk-save');
    btn.disabled = true; btn.textContent = 'กำลังส่ง...';
    try {
      const res = await post({
        action: 'SAVE_MACHINE_CHECK',
        shiftDate: $('mk-date').value,
        shift: $('mk-shift').value,
        checkTime: $('mk-time').value,
        line: LINE,
        machine: machine,
        AM1: state.AM1, AM2: state.AM2, AM3: state.AM3, AM4: state.AM4,
        abnormal: abn,
        result: result,
        sesa: sesa,
        backfill: !!backfill,
        backfillRef: bfRef,
        inspector: userName(),
        username: window.currentUser?.username || '',
        role: window.currentUser?.role || ''
      });
      if (res && res.status === 'success') {
        $('mk-form-card').classList.add('hidden');
        const wasBackfill = !!backfill;
        backfill = null;
        if (wasBackfill && !$('mk-gap-card').classList.contains('hidden')) loadGaps();
        if (result === 'FAIL') alert('บันทึกแล้ว (ผล FAIL) — แจ้งหัวหน้างาน/ช่างซ่อมบำรุงเพื่อแก้ไขก่อนเดินเครื่อง');
        await loadDay();
        loadHistory();
        if (!$('mk-month-card').classList.contains('hidden')) loadMonth();
      } else {
        alert('บันทึกไม่สำเร็จ: ' + (res?.message || 'unknown error'));
      }
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = '📨 ส่ง (Submit)';
    }
  }

  // ===== ประวัติ =====
  function shortAns(it, v){
    const ok = itemOk(it, v);
    if (it.type === 'number') return `<span class="${ok === false ? 'text-red-600 font-bold' : 'text-green-700'}">${esc(v || '-')}</span>`;
    if (ok === true) return '<span class="text-green-700">✓</span>';
    if (ok === false) return `<span class="text-red-600 font-bold" title="${esc(v)}">✗</span>`;
    return '<span class="text-gray-400">-</span>';
  }

  async function loadHistory(){
    const body = $('mk-hist-body');
    body.innerHTML = '<tr><td colspan="13" class="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>';
    try {
      const res = await post({ action: 'GET_MACHINE_CHECKS', dateFrom: $('mk-hist-from').value, dateTo: $('mk-hist-to').value, machine: $('mk-hist-machine').value });
      histRecords = res && res.status === 'success' ? res.data : [];
    } catch (e) {
      histRecords = [];
      body.innerHTML = '<tr><td colspan="13" class="p-4 text-center text-red-500">โหลดข้อมูลไม่สำเร็จ</td></tr>';
      return;
    }
    if (!histRecords.length) { body.innerHTML = '<tr><td colspan="13" class="p-4 text-center text-gray-400">ไม่พบข้อมูล</td></tr>'; return; }
    const isAdmin = window.currentUser?.role === 'Admin';
    body.innerHTML = histRecords.map(r => {
      const fail = recordFailed(r);
      const del = isAdmin ? `<button type="button" data-id="${esc(r.Check_ID)}" class="mk-del text-red-500 hover:text-red-700" title="ลบ">🗑️</button>` : '';
      return `<tr class="border-t ${fail ? 'bg-red-50/50' : ''}">
        <td class="p-1.5 whitespace-nowrap">${esc(r.Shift_Date)}${isBackfill(r) ? BF_BADGE : ''}</td>
        <td class="p-1.5 text-center">${esc(SHIFT_LABEL[r.Shift] || r.Shift)}</td>
        <td class="p-1.5 text-center" title="${isBackfill(r) ? esc('บันทึกเมื่อ ' + r.Timestamp + ' · หลักฐาน: ' + (r.Backfill_Ref || '-')) : ''}">${esc(r.Check_Time)}</td>
        <td class="p-1.5 text-center font-bold">${esc(r.Machine)}</td>
        ${ITEMS.map(it => `<td class="p-1.5 text-center">${shortAns(it, r[it.key])}</td>`).join('')}
        <td class="p-1.5">${esc(r.Abnormal)}</td>
        <td class="p-1.5 text-center font-bold ${fail ? 'text-red-600' : 'text-green-700'}">${esc(r.Result)}</td>
        <td class="p-1.5 text-center">${esc(r.SESA)}</td>
        <td class="p-1.5 whitespace-nowrap">${esc(r.Inspector)}</td>
        <td class="p-1.5 text-center">${del}</td>
      </tr>`;
    }).join('');
    body.querySelectorAll('.mk-del').forEach(b => b.addEventListener('click', () => deleteCheck(b)));
  }

  async function deleteCheck(btn){
    if (!confirm('ลบรายการตรวจนี้?')) return;
    btn.disabled = true;
    try {
      const res = await post({ action: 'DELETE_MACHINE_CHECK', checkId: btn.dataset.id, username: window.currentUser?.username || '', role: window.currentUser?.role || '' });
      if (res && res.status === 'success') { loadHistory(); loadDay(); }
      else { alert('ลบไม่สำเร็จ: ' + (res?.message || '')); btn.disabled = false; }
    } catch (e) { alert('ลบไม่สำเร็จ: ' + e.message); btn.disabled = false; }
  }

  function exportCsv(){
    if (!histRecords.length) return alert('ไม่มีข้อมูลสำหรับ export');
    // หัวคอลัมน์เรียงแบบ Google Form response sheet เดิม
    const header = ['ประทับเวลา', 'Select Line', 'Select Machine'].concat(ITEMS.map(it => it.title))
      .concat([T_ABN, T_RESULT, T_SESA, 'วันที่ (กะ)', 'กะ', 'ผู้บันทึก', 'ประเภทการบันทึก', 'หลักฐาน (ย้อนหลัง)']);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [header.map(q).join(',')].concat(histRecords.map(r => [r.Timestamp, r.Line || LINE, r.Machine]
      .concat(ITEMS.map(it => r[it.key]))
      .concat([r.Abnormal, r.Result, r.SESA, r.Shift_Date, SHIFT_LABEL[r.Shift] || r.Shift, r.Inspector,
        isBackfill(r) ? 'ย้อนหลัง' : 'ปกติ', r.Backfill_Ref || '']).map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `DailyCheckMachine_${$('mk-hist-from').value}_${$('mk-hist-to').value}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ===== ตารางรายเดือน (เครื่อง × วัน แบบ check sheet) =====
  async function loadMonth(){
    const ym = $('mk-month').value;
    if (!ym) return;
    const [y, m] = ym.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const from = `${ym}-01`, to = `${ym}-${String(days).padStart(2, '0')}`;
    const wrap = $('mk-month-table');
    wrap.innerHTML = '<div class="text-center text-gray-400 py-3">กำลังโหลด...</div>';
    try {
      const res = await post({ action: 'GET_MACHINE_CHECKS', dateFrom: from, dateTo: to });
      monthRecords = res && res.status === 'success' ? res.data : [];
    } catch (e) {
      wrap.innerHTML = '<div class="text-center text-red-500 py-3">โหลดข้อมูลไม่สำเร็จ</div>';
      return;
    }
    const today = getShiftDateStr();
    const map = {};
    monthRecords.forEach(r => {
      const k = r.Machine + '|' + String(r.Shift_Date).substring(0, 10);
      (map[k] = map[k] || []).push(r);
    });
    let head = '<th class="p-1 sticky left-0 bg-green-50 z-10 text-left">MC</th>';
    for (let d = 1; d <= days; d++) {
      const dow = new Date(y, m - 1, d).getDay();
      head += `<th class="p-1 min-w-[22px] ${dow === 0 ? 'text-red-500' : ''}">${d}</th>`;
    }
    head += '<th class="p-1">ตรวจ</th><th class="p-1">FAIL</th>';
    const rows = MACHINES.map(mc => {
      let cnt = 0, fails = 0, cells = '';
      for (let d = 1; d <= days; d++) {
        const ds = `${ym}-${String(d).padStart(2, '0')}`;
        const recs = map[mc + '|' + ds] || [];
        let cell = '', cls = '';
        if (recs.length) {
          cnt++;
          const f = recs.some(recordFailed);
          if (f) fails++;
          cell = f ? '✗' : '✓';
          cls = f ? 'bg-red-100 text-red-700 font-bold' : 'bg-green-50 text-green-700';
        } else if (ds < today && new Date(y, m - 1, d).getDay() !== 0) {
          cls = 'bg-gray-100';
        }
        const tip = recs.map(r => `${r.Check_Time} ${r.Result} ${r.AM2}bar SESA ${r.SESA}${isBackfill(r) ? ' (ย้อนหลัง)' : ''}`).join('\n');
        cells += `<td class="p-1 text-center border ${cls}" title="${esc(tip)}">${cell}</td>`;
      }
      return `<tr><td class="p-1 font-bold sticky left-0 bg-white border whitespace-nowrap">${mc}</td>${cells}<td class="p-1 text-center border font-bold">${cnt}</td><td class="p-1 text-center border ${fails ? 'text-red-600 font-bold' : ''}">${fails}</td></tr>`;
    }).join('');
    wrap.innerHTML = `<table class="text-[11px] border-collapse"><thead class="bg-green-50"><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ===== รายงาน: การผลิต vs Daily Check Machine =====
  let gapRows = [];
  async function loadGaps(fromStart){
    const from = fromStart === true ? '' : $('mk-gap-from').value, to = $('mk-gap-to').value;
    if ((!from && fromStart !== true) || !to || (from && from > to)) return alert('กรุณาเลือกช่วงวันที่ให้ถูกต้อง');
    const body = $('mk-gap-body');
    body.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-gray-400">กำลังโหลด... (ข้อมูลเยอะอาจใช้เวลาสักครู่)</td></tr>';
    $('mk-gap-summary').innerHTML = ''; $('mk-gap-machines').innerHTML = '';
    try {
      const res = await post({ action: 'GET_MACHINE_CHECK_GAPS', dateFrom: from, dateTo: to });
      if (!res || res.status !== 'success') throw new Error(res?.message || 'error');
      gapRows = res.data || [];
      if (fromStart === true && gapRows.length) $('mk-gap-from').value = gapRows[0].date; // วันแรกที่มีการลงยอดผลิต
    } catch (e) {
      gapRows = [];
      body.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-red-500">โหลดข้อมูลไม่สำเร็จ: ${esc(e.message)}</td></tr>`;
      return;
    }
    renderGaps();
  }

  function renderGaps(){
    const total = gapRows.length;
    const done = gapRows.filter(r => r.check).length;
    const missing = total - done;
    const fails = gapRows.filter(r => r.check === 'FAIL').length;
    const pct = total ? Math.round(done * 1000 / total) / 10 : 0;
    const days = new Set(gapRows.map(r => r.date)).size;
    $('mk-gap-summary').innerHTML = total
      ? `<div class="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div class="rounded-lg bg-gray-50 border p-2"><div class="text-[11px] text-gray-500">วันที่มีการผลิต</div><div class="text-lg font-bold">${days}</div></div>
          <div class="rounded-lg bg-gray-50 border p-2"><div class="text-[11px] text-gray-500">เครื่อง×กะ ที่ผลิต</div><div class="text-lg font-bold">${total}</div></div>
          <div class="rounded-lg bg-green-50 border border-green-200 p-2"><div class="text-[11px] text-gray-500">มี Daily Check</div><div class="text-lg font-bold text-green-700">${done}${fails ? ` <span class="text-xs text-red-600">(FAIL ${fails})</span>` : ''}</div></div>
          <div class="rounded-lg bg-red-50 border border-red-200 p-2"><div class="text-[11px] text-gray-500">ยังไม่มี Daily Check</div><div class="text-lg font-bold text-red-600">${missing}</div></div>
          <div class="rounded-lg bg-amber-50 border border-amber-200 p-2"><div class="text-[11px] text-gray-500">ความครบถ้วน</div><div class="text-lg font-bold text-amber-700">${pct}%</div></div>
        </div>`
      : '<div class="text-gray-500">ไม่พบการลงยอดผลิตในช่วงวันที่นี้</div>';

    // สรุปรายเครื่อง
    const byMc = {};
    gapRows.forEach(r => {
      const m = byMc[r.machine] = byMc[r.machine] || { total: 0, done: 0, first: '' };
      m.total++; if (r.check) m.done++;
      if (!r.check && !m.first) m.first = r.date;
    });
    const mcs = MACHINES.filter(mc => byMc[mc]);
    $('mk-gap-machines').innerHTML = mcs.length ? `<table class="text-xs border-collapse"><thead class="bg-amber-50"><tr>
        <th class="p-1.5 text-left border">MC</th><th class="p-1.5 border">กะที่ผลิต</th><th class="p-1.5 border">มี Check</th><th class="p-1.5 border">ขาด</th><th class="p-1.5 border">%</th><th class="p-1.5 border text-left">ขาดตั้งแต่</th>
      </tr></thead><tbody>${mcs.map(mc => {
        const m = byMc[mc], miss = m.total - m.done, pc = Math.round(m.done * 100 / m.total);
        return `<tr><td class="p-1.5 border font-bold">${mc}</td><td class="p-1.5 border text-center">${m.total}</td>
          <td class="p-1.5 border text-center text-green-700">${m.done}</td>
          <td class="p-1.5 border text-center ${miss ? 'text-red-600 font-bold' : ''}">${miss}</td>
          <td class="p-1.5 border text-center">${pc}%</td><td class="p-1.5 border">${esc(m.first || '-')}</td></tr>`;
      }).join('')}</tbody></table>` : '';

    const list = $('mk-gap-filter').value === 'missing' ? gapRows.filter(r => !r.check) : gapRows;
    const body = $('mk-gap-body');
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="9" class="p-4 text-center ${total ? 'text-green-700 font-bold' : 'text-gray-400'}">${total ? 'มี Daily Check ครบทุกกะที่ผลิต ✔' : 'ไม่พบข้อมูล'}</td></tr>`;
      return;
    }
    const MAX = 2000;
    body.innerHTML = list.slice(0, MAX).map(r => {
      const st = (r.check === 'PASS' ? '<span class="text-green-700 font-bold">PASS</span>'
        : r.check === 'FAIL' ? '<span class="text-red-600 font-bold">FAIL</span>'
        : '<span class="text-red-600">✗ ไม่มีบันทึก</span>') + (r.check && r.backfill ? BF_BADGE : '');
      const act = r.check ? '' : `<button type="button" class="mk-gap-bf text-purple-700 hover:underline whitespace-nowrap" data-date="${esc(r.date)}" data-mc="${esc(r.machine)}" data-shift="${esc(r.shift)}">✍️ ลงย้อนหลัง</button>`;
      return `<tr class="border-t ${r.check ? '' : 'bg-red-50/40'}">
        <td class="p-1.5 whitespace-nowrap">${esc(r.date)}</td>
        <td class="p-1.5 text-center">${esc(SHIFT_LABEL[r.shift] || r.shift)}</td>
        <td class="p-1.5 text-center">${esc(r.crew || '-')}</td>
        <td class="p-1.5 text-center font-bold">${esc(r.machine)}</td>
        <td class="p-1.5 text-center whitespace-nowrap">${esc(hm(r.firstTs))}${r.lastTs && r.lastTs !== r.firstTs ? '–' + esc(hm(r.lastTs)) : ''}</td>
        <td class="p-1.5">${esc(r.recorders || '-')}</td>
        <td class="p-1.5 text-right">${Number(r.fg || 0).toLocaleString()}</td>
        <td class="p-1.5 text-center">${st}</td>
        <td class="p-1.5 text-center">${act}</td>
      </tr>`;
    }).join('') + (list.length > MAX ? `<tr><td colspan="9" class="p-2 text-center text-gray-500">แสดง ${MAX} จาก ${list.length} แถว — ดูทั้งหมดใน CSV</td></tr>` : '');
    body.querySelectorAll('.mk-gap-bf').forEach(b => b.addEventListener('click', () => startBackfill(b.dataset.date, b.dataset.mc, b.dataset.shift)));
  }

  // เปิดฟอร์มโหมดย้อนหลังจากแถวที่ขาดในรายงาน — ผู้ตรวจจริงกรอกเวลา/ผล/SESA ตามใบตรวจ (ระบบไม่สุ่มหรือเติมค่าให้)
  async function startBackfill(date, machine, shift){
    backfill = { date, machine, shift };
    $('mk-date').value = date;
    await loadDay();
    openForm(machine);
  }

  function hm(ts){ const m = String(ts || '').match(/(\d{1,2}:\d{2})/); return m ? m[1] : ''; }
  function downloadCsv(name, rows){
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  }

  // ===== แม่แบบ + นำเข้า ผลตรวจย้อนหลัง (กรอกจากใบตรวจจริง) =====
  // แม่แบบมีเฉพาะ วันที่/กะ/เครื่อง ของกะที่ขาด — ช่องผลตรวจเว้นว่างทั้งหมด ระบบไม่เติมหรือสุ่มค่าให้
  const TPL_HEAD = ['วันที่ (yyyy-mm-dd)', 'กะ (Day/Night)', 'เครื่อง', 'เวลาตรวจจริง (HH:mm)', 'AM1 (OK/NG)', 'AM2 ลม (bar)', 'AM3 (OK/NG)', 'AM4 (OK/NG)',
    'สิ่งผิดปกติ', 'ผล (PASS/FAIL — ว่าง=คำนวณจาก AM1-4)', 'SESA ผู้ตรวจจริง', 'ชื่อผู้ตรวจ', 'แหล่งที่มา/หลักฐาน'];
  function downloadTemplate(){
    const miss = gapRows.filter(r => !r.check);
    if (!gapRows.length) return alert('กดค้นหา (หรือ "ตั้งแต่วันแรก") ก่อน');
    if (!miss.length) return alert('ไม่มีกะที่ขาด Daily Check ในช่วงนี้');
    downloadCsv(`DailyCheckMachine_Backfill_Template_${$('mk-gap-from').value}_${$('mk-gap-to').value}.csv`,
      [TPL_HEAD].concat(miss.map(r => [r.date, r.shift, r.machine, '', '', '', '', '', '', '', '', '', ''])));
  }

  function parseCsv(text){
    const rows = []; let row = [], cur = '', q = false;
    text = text.replace(/^\ufeff/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }
  function normDate(v){
    v = String(v || '').trim();
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) { let y = +m[1]; if (y > 2500) y -= 543; return y + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); }
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) { let y = +m[3]; if (y > 2500) y -= 543; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
    return '';
  }
  function normTime(v){ const m = String(v || '').trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/); return m ? m[1].padStart(2, '0') + ':' + m[2] + ':' + (m[3] || '00') : ''; }
  function normMcName(v){ const m = String(v || '').toUpperCase().match(/CWM[\s\-_]*0*(\d{1,2})\b/); return m ? 'CWM-' + m[1].padStart(2, '0') : ''; }
  function okNg(it, v){
    const t = String(v || '').trim();
    if (/^(ok|pass|ปกติ|✓|1)$/i.test(t) || t === it.ok) return it.ok;
    if (/^(ng|nok|fail|ผิดปกติ|ชำรุด|✗|0)$/i.test(t) || t === it.ng) return it.ng;
    return '';
  }

  function importCsv(){
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,text/csv';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      let rows;
      try { rows = parseCsv(await f.text()); } catch (e) { return alert('อ่านไฟล์ไม่ได้: ' + e.message); }
      if (rows.length < 2) return alert('ไม่พบข้อมูลในไฟล์');
      const errs = [], items = [];
      rows.slice(1).forEach((c, i) => {
        const line = i + 2;
        const st = {
          AM1: okNg(ITEMS[0], c[4]), AM2: String(c[5] || '').trim(), AM3: okNg(ITEMS[2], c[6]), AM4: okNg(ITEMS[3], c[7])
        };
        const shift = /night|ดึก|^n$/i.test(String(c[1] || '').trim()) ? 'Night' : /day|เช้า|^d$/i.test(String(c[1] || '').trim()) ? 'Day' : '';
        const it = {
          line, shiftDate: normDate(c[0]), shift, machine: normMcName(c[2]), checkTime: normTime(c[3]),
          AM1: st.AM1, AM2: st.AM2, AM3: st.AM3, AM4: st.AM4, abnormal: String(c[8] || '').trim(),
          sesa: String(c[10] || '').trim(), inspector: String(c[11] || '').trim(), backfillRef: String(c[12] || '').trim()
        };
        const blank = !it.checkTime && !st.AM1 && !st.AM2 && !st.AM3 && !st.AM4 && !it.sesa;
        if (blank) return; // แถวที่ยังไม่ได้กรอก (ไม่มีใบตรวจ) — ข้าม ไม่สร้างข้อมูล
        const prob = [];
        if (!it.shiftDate || !it.shift || !it.machine) prob.push('วันที่/กะ/เครื่อง');
        if (!it.checkTime) prob.push('เวลาตรวจจริง');
        if (!st.AM1 || !st.AM3 || !st.AM4) prob.push('AM1/AM3/AM4 (OK/NG)');
        if (st.AM2 === '' || isNaN(parseFloat(st.AM2))) prob.push('AM2 (ตัวเลข bar)');
        if (!/^\d+$/.test(it.sesa)) prob.push('SESA');
        if (!it.backfillRef) prob.push('แหล่งที่มา/หลักฐาน');
        const auto = autoResult(st);
        const r = String(c[9] || '').trim().toUpperCase();
        it.result = r === 'PASS' || r === 'FAIL' ? r : auto;
        if (it.result === 'FAIL' && !it.abnormal) prob.push('สิ่งผิดปกติ (ผล FAIL)');
        if (prob.length) errs.push(`แถว ${line}: ไม่ครบ/ไม่ถูกต้อง — ${prob.join(', ')}`);
        else items.push(it);
      });
      if (errs.length) return alert(`ยังไม่ได้นำเข้า — แก้ไขไฟล์ก่อน (${errs.length} แถว)\n` + errs.slice(0, 25).join('\n') + (errs.length > 25 ? '\n...' : ''));
      if (!items.length) return alert('ไม่มีแถวที่กรอกผลตรวจไว้ (แถวว่างถูกข้าม)');
      const fails = items.filter(x => x.result === 'FAIL').length;
      if (!confirm(`นำเข้าผลตรวจย้อนหลัง ${items.length} แถว (FAIL ${fails})\n\nยืนยันว่าทุกแถวกรอกตามใบตรวจ/หลักฐานจริง และ SESA คือผู้ที่ตรวจจริง?\nทุกแถวจะติดสถานะ "ย้อนหลัง" และบันทึกชื่อคุณเป็นผู้นำเข้า`)) return;
      const btn = $('btn-mk-bf-import'); const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'กำลังนำเข้า...';
      try {
        const res = await post({ action: 'IMPORT_MACHINE_CHECKS', rows: items.map(x => Object.assign({ lineName: LINE }, x)),
          username: window.currentUser?.username || '', role: window.currentUser?.role || '' });
        if (res && res.status === 'success') {
          alert(`นำเข้าแล้ว ${res.imported} แถว` + (res.skipped ? ` · ข้าม ${res.skipped} แถว (กะนั้นมีผลตรวจอยู่แล้ว)` : ''));
          loadGaps(); loadDay(); loadHistory();
        } else {
          alert('นำเข้าไม่สำเร็จ: ' + (res?.message || '') + (res?.errors ? '\n' + res.errors.join('\n') : ''));
        }
      } catch (e) { alert('นำเข้าไม่สำเร็จ: ' + e.message); }
      finally { btn.disabled = false; btn.textContent = label; }
    });
    input.click();
  }

  function exportGapCsv(){
    if (!gapRows.length) return alert('กดค้นหาก่อน');
    const list = $('mk-gap-filter').value === 'missing' ? gapRows.filter(r => !r.check) : gapRows;
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['วันที่', 'กะ', 'กะทีม', 'เครื่อง', 'ลงยอดผลิตครั้งแรก', 'ลงยอดผลิตล่าสุด', 'ผู้ลงยอดผลิต', 'จำนวนครั้งที่ลงยอด', 'FG (ชิ้น)', 'Daily Check Machine', 'ประเภทการบันทึก'].map(q).join(',')]
      .concat(list.map(r => [r.date, SHIFT_LABEL[r.shift] || r.shift, r.crew, r.machine, r.firstTs, r.lastTs, r.recorders, r.entries, r.fg, r.check || 'ไม่มีบันทึก',
        r.check ? (r.backfill ? 'ย้อนหลัง' : 'ปกติ') : ''].map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Production_vs_DailyCheckMachine_${$('mk-gap-from').value}_${$('mk-gap-to').value}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ===== สลับ tab ย่อยใน Daily Check =====
  function switchSub(which){
    const isMk = which === 'machine';
    $('dc-sub-ok1st').classList.toggle('hidden', isMk);
    $('dc-sub-machine').classList.toggle('hidden', !isMk);
    const on = 'bg-green-600 text-white border-green-600', off = 'bg-white text-green-700 border-green-300 hover:bg-green-50';
    $('dc-subtab-ok1st').className = 'px-4 py-2 rounded-lg border-2 font-bold text-sm ' + (isMk ? off : on);
    $('dc-subtab-machine').className = 'px-4 py-2 rounded-lg border-2 font-bold text-sm ' + (isMk ? on : off);
    lsSet('cwm_dc_subtab', which);
    if (isMk) { init(); loadDay(); loadHistory(); loadImages(true); }
  }
  window.switchDailyCheckSub = switchSub;

  function init(){
    if (initialized) return;
    initialized = true;
    const today = getShiftDateStr();
    $('mk-date').value = today;
    $('mk-hist-from').value = addDays(today, -6);
    $('mk-hist-to').value = today;
    $('mk-month').value = today.substring(0, 7);
    $('mk-line').value = LINE;
    $('mk-machine').innerHTML = MACHINES.map(m => `<option value="${m}">${m}</option>`).join('');
    $('mk-hist-machine').innerHTML = '<option value="">ทั้งหมด</option>' + MACHINES.map(m => `<option value="${m}">${m}</option>`).join('');
    $('mk-hist-head').innerHTML = `<tr>
      <th class="p-1.5 text-left">วันที่</th><th class="p-1.5">กะ</th><th class="p-1.5">เวลา</th><th class="p-1.5">MC</th>
      ${ITEMS.map(it => `<th class="p-1.5" title="${esc(it.title)}">${it.key}${it.type === 'number' ? ' (bar)' : ''}</th>`).join('')}
      <th class="p-1.5 text-left">สิ่งผิดปกติ</th><th class="p-1.5">ผล</th><th class="p-1.5">SESA</th><th class="p-1.5 text-left">ผู้บันทึก</th><th class="p-1.5"></th>
    </tr>`;
    $('mk-t-abn').textContent = T_ABN;
    $('mk-t-result').textContent = T_RESULT;
    $('mk-t-sesa').textContent = T_SESA;

    $('btn-mk-refresh').addEventListener('click', loadDay);
    $('mk-date').addEventListener('change', () => { backfill = null; loadDay(); $('mk-form-card').classList.add('hidden'); });
    $('btn-mk-backfill-cancel').addEventListener('click', () => { backfill = null; openForm($('mk-machine').value); });
    $('mk-machine').addEventListener('change', () => openForm($('mk-machine').value));
    $('btn-mk-close').addEventListener('click', () => { backfill = null; $('mk-form-card').classList.add('hidden'); });
    $('btn-mk-all-ok').addEventListener('click', () => {
      ITEMS.forEach(it => { state[it.key] = it.type === 'number' ? (state.AM2 || '6') : it.ok; });
      resultOverride = '';
      renderItems();
    });
    ['PASS', 'FAIL'].forEach(v => $('mk-res-' + v).addEventListener('click', () => { resultOverride = v; renderResult(); }));
    $('btn-mk-save').addEventListener('click', saveForm);
    $('btn-mk-hist').addEventListener('click', loadHistory);
    $('btn-mk-csv').addEventListener('click', exportCsv);
    $('btn-mk-month').addEventListener('click', () => {
      const card = $('mk-month-card');
      card.classList.toggle('hidden');
      if (!card.classList.contains('hidden')) loadMonth();
    });
    $('mk-month').addEventListener('change', loadMonth);
    $('mk-gap-from').value = addDays(today, -90);
    $('mk-gap-to').value = today;
    $('btn-mk-gap').addEventListener('click', () => {
      const card = $('mk-gap-card');
      card.classList.toggle('hidden');
      if (!card.classList.contains('hidden')) { loadGaps(); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    $('btn-mk-gap-load').addEventListener('click', () => loadGaps());
    $('btn-mk-gap-all').addEventListener('click', () => loadGaps(true));
    $('btn-mk-bf-template').addEventListener('click', downloadTemplate);
    $('btn-mk-bf-import').addEventListener('click', importCsv);
    $('mk-gap-filter').addEventListener('change', renderGaps);
    $('btn-mk-gap-csv').addEventListener('click', exportGapCsv);
  }

  // เปิดเมนู Daily Check → กลับไป tab ย่อยที่ใช้ล่าสุด
  document.addEventListener('DOMContentLoaded', () => {
    const a = $('dc-subtab-ok1st'), b = $('dc-subtab-machine');
    if (!a || !b) return;
    a.addEventListener('click', () => switchSub('ok1st'));
    b.addEventListener('click', () => switchSub('machine'));
  });
  window.loadMachineCheckIfActive = function(){
    if (lsGet('cwm_dc_subtab') === 'machine') switchSub('machine');
  };
})();
