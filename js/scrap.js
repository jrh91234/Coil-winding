// 🗑️ Scrap / Waste Log module (บันทึกขยะ)
// เก็บข้อมูลลง Google Sheet (WasteLog / WasteTypes) ผ่าน backend — port จาก Lug-Screw-management-system
(function(){
  const DEFAULT_TYPES = ['ขยะอันตราย','ขยะรีไซเคิล','ขยะอุตสาหกรรมไม่อันตราย','อื่น ๆ'];
  let typesCache = [];  // [{typeId, typeName}]

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function recorderName(){ return window.currentUser?.name || window.currentUser?.username || '-'; }

  function postScrap(payload){
    return fetch(`${SCRIPT_URL}?_t=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(payload)
    }).then(r => r.json());
  }

  function nowLocalInput(){
    const d = new Date();
    d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
    return d.toISOString().slice(0,16);
  }

  async function loadTypes(){
    try {
      const res = await postScrap({ action: 'GET_WASTE_TYPES' });
      if (res && res.status === 'success' && Array.isArray(res.data) && res.data.length) {
        typesCache = res.data;
      } else {
        typesCache = DEFAULT_TYPES.map(n => ({ typeId: '', typeName: n }));
      }
    } catch(_) {
      typesCache = DEFAULT_TYPES.map(n => ({ typeId: '', typeName: n }));
    }
    renderTypeSelect();
  }

  function renderTypeSelect(){
    const sel = document.getElementById('scrap-type');
    if(sel) sel.innerHTML = typesCache.map(t => `<option value="${esc(t.typeName)}">${esc(t.typeName)}</option>`).join('');
    renderTypePanelList();
  }

  function renderTypePanelList(){
    const box = document.getElementById('scrap-type-list');
    if(!box) return;
    box.innerHTML = typesCache.map(t => {
      const delBtn = t.typeId
        ? `<button data-id="${esc(t.typeId)}" class="btn-scrap-type-del text-red-600 text-xs px-2 py-1 hover:bg-red-50 rounded">ลบ</button>`
        : `<span class="text-[10px] text-gray-400">ค่าเริ่มต้น</span>`;
      return `<div class="flex items-center justify-between bg-white border rounded p-1.5"><span class="text-sm">${esc(t.typeName)}</span>${delBtn}</div>`;
    }).join('');
    box.querySelectorAll('.btn-scrap-type-del').forEach(btn => btn.addEventListener('click', async () => {
      if(typesCache.length <= 1) return alert('ต้องมีชนิดขยะอย่างน้อย 1 รายการ');
      if(!confirm('ลบชนิดขยะนี้?')) return;
      btn.disabled = true;
      try {
        const res = await postScrap({ action: 'DELETE_WASTE_TYPE', typeId: btn.dataset.id, recorder: recorderName(), role: window.currentUser?.role || '' });
        if(res && res.status === 'success') await loadTypes();
        else { alert((res && res.message) || 'ลบไม่สำเร็จ'); btn.disabled = false; }
      } catch(e){ alert('ลบไม่สำเร็จ: ' + e); btn.disabled = false; }
    }));
  }

  async function renderTodayList(){
    const body = document.getElementById('scrap-today-body');
    const totalEl = document.getElementById('scrap-today-total');
    if(!body || !totalEl) return;
    body.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>';
    let items = [];
    try {
      const res = await postScrap({ action: 'GET_TODAY_WASTE' });
      if(res && res.status === 'success' && Array.isArray(res.data)) items = res.data;
    } catch(_) {
      body.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-400">โหลดข้อมูลไม่สำเร็จ</td></tr>';
      totalEl.textContent = 'รวม 0.00 กก.';
      return;
    }
    let total = 0;
    if(!items.length){
      body.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">ยังไม่มีรายการวันนี้</td></tr>';
      totalEl.textContent = 'รวม 0.00 กก.';
      return;
    }
    body.innerHTML = items.map(x => {
      const w = Number(x.WeightKg || 0);
      total += w;
      const ts = String(x.Timestamp || '');
      const hhmm = ts.length >= 16 ? ts.substring(11, 16) : '-';
      return `<tr class="border-t"><td class="p-2">${esc(hhmm)}</td><td class="p-2">${esc(x.WasteType)}</td><td class="p-2 text-right">${w.toFixed(2)}</td><td class="p-2">${esc(x.RecorderName)}</td></tr>`;
    }).join('');
    totalEl.textContent = `รวม ${total.toFixed(2)} กก.`;
  }

  function initScrap(){
    const recorder = document.getElementById('scrap-recorder');
    const dt = document.getElementById('scrap-datetime');
    if(recorder) recorder.value = recorderName();
    if(dt && !dt.value) dt.value = nowLocalInput();
    loadTypes();
    renderTodayList();

    document.getElementById('btn-scrap-type-panel')?.addEventListener('click', () => {
      document.getElementById('scrap-type-panel')?.classList.toggle('hidden');
    });
    document.getElementById('btn-scrap-type-add')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const inp = document.getElementById('scrap-type-new');
      const val = (inp?.value || '').trim();
      if(!val) return;
      btn.disabled = true;
      try {
        const res = await postScrap({ action: 'ADD_WASTE_TYPE', typeName: val, recorder: recorderName(), role: window.currentUser?.role || '' });
        if(res && res.status === 'success'){ inp.value = ''; await loadTypes(); }
        else alert((res && res.message) || 'เพิ่มไม่สำเร็จ');
      } catch(e){ alert('เพิ่มไม่สำเร็จ: ' + e); }
      finally { btn.disabled = false; }
    });
    document.getElementById('btn-scrap-reset-time')?.addEventListener('click', () => {
      if(dt) dt.value = nowLocalInput();
    });
    document.getElementById('btn-scrap-save')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-scrap-save');
      const type = document.getElementById('scrap-type')?.value;
      const weight = Number(document.getElementById('scrap-weight')?.value || 0);
      const datetime = document.getElementById('scrap-datetime')?.value;
      if(!type) return alert('กรุณาเลือกชนิดขยะ');
      if(!(weight > 0)) return alert('กรุณาระบุน้ำหนักมากกว่า 0');
      if(!datetime) return alert('กรุณาระบุวันที่และเวลา');
      const oldLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';
      try {
        const res = await postScrap({
          action: 'SUBMIT_WASTE',
          wasteType: type,
          weightKg: weight,
          recordedAt: datetime,
          recorder: recorderName(),
          username: window.currentUser?.username || '',
          role: window.currentUser?.role || ''
        });
        if(res && res.status === 'success'){
          document.getElementById('scrap-weight').value = '';
          await renderTodayList();
        } else {
          alert((res && res.message) || 'บันทึกไม่สำเร็จ');
        }
      } catch(e){ alert('บันทึกไม่สำเร็จ: ' + e); }
      finally { btn.disabled = false; btn.textContent = oldLabel; }
    });
  }

  document.addEventListener('DOMContentLoaded', initScrap);
  // เรียกตอนสลับเข้าแท็บ (js/globals.js) — อัปเดตชื่อผู้บันทึก + โหลดรายการวันนี้ใหม่จาก backend
  window.refreshScrapRecorder = function(){
    const recorder = document.getElementById('scrap-recorder');
    if(recorder) recorder.value = recorderName();
    renderTodayList();
  };
})();
