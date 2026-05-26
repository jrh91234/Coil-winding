// 🗑️ Scrap List module
(function(){
  const TYPE_KEY = 'CWM_SCRAP_TYPES';
  const LOG_KEY = 'CWM_SCRAP_LOGS';
  const DEFAULT_TYPES = ['ขยะอันตราย','ขยะรีไซเคิล','ขยะอุตสาหกรรมไม่อันตราย','อื่น ๆ'];

  function readTypes(){
    try { return JSON.parse(localStorage.getItem(TYPE_KEY)) || DEFAULT_TYPES.slice(); }
    catch(_) { return DEFAULT_TYPES.slice(); }
  }
  function saveTypes(items){ localStorage.setItem(TYPE_KEY, JSON.stringify(items)); }
  function readLogs(){
    try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; }
    catch(_) { return []; }
  }
  function saveLogs(items){ localStorage.setItem(LOG_KEY, JSON.stringify(items)); }
  function nowLocalInput(){
    const d = new Date();
    d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
    return d.toISOString().slice(0,16);
  }

  function renderTypeSelect(){
    const sel = document.getElementById('scrap-type');
    if(!sel) return;
    const types = readTypes();
    sel.innerHTML = types.map(t=>`<option value="${t}">${t}</option>`).join('');
    renderTypePanelList();
  }

  function renderTypePanelList(){
    const box = document.getElementById('scrap-type-list');
    if(!box) return;
    const types = readTypes();
    box.innerHTML = types.map((t,i)=>`<div class="flex items-center justify-between bg-white border rounded p-1.5"><span class="text-sm">${t}</span><button data-index="${i}" class="btn-scrap-type-del text-red-600 text-xs px-2 py-1 hover:bg-red-50 rounded">ลบ</button></div>`).join('');
    box.querySelectorAll('.btn-scrap-type-del').forEach(btn=>btn.addEventListener('click', ()=>{
      const idx = Number(btn.dataset.index);
      const types2 = readTypes();
      if(types2.length <= 1) return alert('ต้องมีชนิดขยะอย่างน้อย 1 รายการ');
      types2.splice(idx,1);
      saveTypes(types2);
      renderTypeSelect();
    }));
  }

  function renderTodayList(){
    const body = document.getElementById('scrap-today-body');
    const totalEl = document.getElementById('scrap-today-total');
    if(!body || !totalEl) return;
    const today = new Date().toISOString().slice(0,10);
    const items = readLogs().filter(x => (x.datetime || '').slice(0,10) === today)
      .sort((a,b)=> (b.datetime||'').localeCompare(a.datetime||''));
    let total = 0;
    if(!items.length){
      body.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">ยังไม่มีรายการวันนี้</td></tr>';
    } else {
      body.innerHTML = items.map(x=>{
        total += Number(x.weight||0);
        const t = new Date(x.datetime);
        const hhmm = isNaN(t) ? '-' : t.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
        return `<tr class="border-t"><td class="p-2">${hhmm}</td><td class="p-2">${x.type}</td><td class="p-2 text-right">${Number(x.weight).toFixed(2)}</td><td class="p-2">${x.recorder}</td></tr>`;
      }).join('');
    }
    totalEl.textContent = `รวม ${total.toFixed(2)} กก.`;
  }

  function initScrap(){
    const recorder = document.getElementById('scrap-recorder');
    const dt = document.getElementById('scrap-datetime');
    if(recorder){ recorder.value = window.currentUser?.name || window.currentUser?.username || '-'; }
    if(dt && !dt.value) dt.value = nowLocalInput();
    renderTypeSelect();
    renderTodayList();

    document.getElementById('btn-scrap-type-panel')?.addEventListener('click', ()=>{
      document.getElementById('scrap-type-panel')?.classList.toggle('hidden');
    });
    document.getElementById('btn-scrap-type-add')?.addEventListener('click', ()=>{
      const inp = document.getElementById('scrap-type-new');
      const val = (inp?.value || '').trim();
      if(!val) return;
      const types = readTypes();
      if(types.some(t => t.toLowerCase() === val.toLowerCase())) return alert('ชนิดขยะนี้มีอยู่แล้ว');
      types.push(val); saveTypes(types); inp.value=''; renderTypeSelect();
    });
    document.getElementById('btn-scrap-reset-time')?.addEventListener('click', ()=>{
      if(dt) dt.value = nowLocalInput();
    });
    document.getElementById('btn-scrap-save')?.addEventListener('click', ()=>{
      const type = document.getElementById('scrap-type')?.value;
      const weight = Number(document.getElementById('scrap-weight')?.value || 0);
      const datetime = document.getElementById('scrap-datetime')?.value;
      const recorderName = window.currentUser?.name || window.currentUser?.username || '-';
      if(!type) return alert('กรุณาเลือกชนิดขยะ');
      if(!(weight > 0)) return alert('กรุณาระบุน้ำหนักมากกว่า 0');
      if(!datetime) return alert('กรุณาระบุวันที่และเวลา');
      const logs = readLogs();
      logs.push({ type, weight, recorder: recorderName, datetime });
      saveLogs(logs);
      document.getElementById('scrap-weight').value = '';
      renderTodayList();
    });
  }

  document.addEventListener('DOMContentLoaded', initScrap);
  window.refreshScrapRecorder = function(){
    const recorder = document.getElementById('scrap-recorder');
    if(recorder) recorder.value = window.currentUser?.name || window.currentUser?.username || '-';
  };
})();
