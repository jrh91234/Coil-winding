// 🧹 5ส. หลังเลิกงาน (Production)
// ทุกกะ (A/B) ปิดวันทำงาน จ.–ส. ด้วยรูปพื้นที่ทำงาน 3 รูป (ถ่ายจากกล้องในหน้าเว็บเท่านั้น) แล้วให้ Leader ยืนยัน / ตีกลับให้ทำใหม่
// เก็บลงชีต FiveSEndLog ผ่าน backend (GET_FIVES_WEEK / SAVE_FIVES_END / CONFIRM_FIVES / REJECT_FIVES)
(function(){
  // สิ่งที่แต่ละรูปต้องเห็น (ตามลำดับ)
  const END_SHOTS = ['พื้นที่ทำงาน / พื้นรอบเครื่อง', 'โต๊ะงาน / เครื่องมือ-อุปกรณ์เก็บเข้าที่', 'ถังขยะ / ถังเศษ / จุดวางงาน NG'];
  // รูปตัวอย่างจาง ๆ ในช่องว่าง — ถ้าไม่มีไฟล์ ช่องนั้นเป็นกรอบเปล่า (ดู img/fives/README.md)
  const END_EXAMPLES = ['img/fives/end-1.jpg', 'img/fives/end-2.jpg', 'img/fives/end-3.jpg'];
  const SHIFTS = ['A', 'B'];
  const DAY_LABELS = ['', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const DAY_FULL = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const PHOTO_MAX = 1280;
  const PHOTO_QUALITY = 0.75;
  const FALLBACK_MAX_AGE_MS = 5 * 60 * 1000;
  const CREW_KEY = 'cwm_fives_crew';

  let data = null;          // คำตอบล่าสุดของ GET_FIVES_WEEK
  let weekRef = '';         // วันที่อ้างอิงของสัปดาห์ที่ดูอยู่ ('' = สัปดาห์นี้)
  let view = 'today';
  let crew = '';
  let loadSeq = 0;
  let initialized = false;
  let camStream = null;
  let camJob = null;        // { shift }
  let camShots = [];        // data URL ที่ประทับข้อความแล้ว ช่องละ 1 รูป
  let camIdx = 0;           // ช่องที่กล้องกำลังถ่าย
  let sending = false;
  let confirming = false;

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function $(id){ return document.getElementById(id); }
  function user(){ return window.currentUser || {}; }
  function userName(){ return user().name || user().username || ''; }

  function postFs(payload){
    return fetch(`${SCRIPT_URL}?_t=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(Object.assign({ username: user().username || '', name: userName(), role: user().role || '' }, payload))
    }).then(r => r.json());
  }

  function toast(msg, type){
    const el = document.createElement('div');
    el.className = 'fixed left-1/2 -translate-x-1/2 bottom-6 z-[80] px-4 py-2 rounded-lg shadow-lg text-sm font-bold text-white ' +
      (type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-500' : 'bg-green-600');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // URL ไฟล์ Drive → รูปที่ <img> แสดงได้
  function photoSrc(url, size){
    const s = String(url || '');
    const m = s.match(/\/d\/([-\w]{20,})/) || s.match(/id=([-\w]{20,})/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size || 400}` : s;
  }
  function shortDate(d){ const p = String(d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : d; }
  function timeOf(ts){ const s = String(ts || ''); return s.length >= 16 ? s.substring(11, 16) : s; }
  function addDays(dateStr, n){
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function canConfirm(){ return !!(data && data.canConfirm); }
  // คนที่ถ่ายรูปยืนยันงานตัวเองไม่ได้ (ยกเว้น Admin) — backend เช็คซ้ำ
  function canConfirmEntry(e){ return canConfirm() && (user().role === 'Admin' || e.doneBy !== user().username); }

  function loadCrew(){ try { return localStorage.getItem(CREW_KEY) || ''; } catch (e) { return ''; } }
  function saveCrew(v){ try { localStorage.setItem(CREW_KEY, v); } catch (e) { /* ใช้ได้แค่รอบนี้ */ } }

  // ===== โหลดข้อมูล =====
  async function load(){
    const seq = ++loadSeq;
    if (!data) $('fs-today').innerHTML = '<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400">กำลังโหลด...</div>';
    try {
      const res = await postFs({ action: 'GET_FIVES_WEEK', date: weekRef });
      if (seq !== loadSeq) return;
      if (!res || res.status !== 'success') throw new Error(res && res.message || 'โหลดข้อมูลไม่สำเร็จ');
      data = res;
      render();
    } catch (e) {
      if (seq !== loadSeq) return;
      $('fs-today').innerHTML = '<div class="bg-white rounded-xl shadow p-6 text-center text-red-500">โหลดข้อมูลไม่สำเร็จ: ' + esc(e.message) + '</div>';
    }
  }

  function render(){
    $('fs-crew-a').className = crewBtnClass('A');
    $('fs-crew-b').className = crewBtnClass('B');
    $('fs-pane-today').classList.toggle('hidden', view !== 'today');
    $('fs-pane-week').classList.toggle('hidden', view !== 'week');
    $('fs-view-today').className = viewBtnClass('today');
    $('fs-view-week').className = viewBtnClass('week');
    if (!data) return;
    renderToday();
    renderPending();
    renderWeek();
  }
  function crewBtnClass(c){
    return 'px-3 py-1 rounded-lg border text-sm font-bold ' + (crew === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300');
  }
  function viewBtnClass(v){
    return 'flex-1 py-2 rounded-lg text-sm font-bold ' + (view === v ? 'bg-emerald-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200');
  }

  function endEntry(list, date, shift){
    return (list || []).find(e => e.date === date && e.shift === shift) || null;
  }

  function statusBadge(e, date){
    if (e && e.status === 'confirmed') return '<span class="fs-badge confirmed">✔ ยืนยันแล้ว</span>';
    if (e && e.status === 'done') return '<span class="fs-badge done">⏳ รอ Leader ยืนยัน</span>';
    if (e && e.status === 'rejected') return '<span class="fs-badge rejected">↺ ให้ทำใหม่</span>';
    if (data && date < data.today) return '<span class="fs-badge missed">✖ ไม่ได้ทำ</span>';
    return '<span class="fs-badge todo">ยังไม่ทำ</span>';
  }

  // ===== งานวันนี้ =====
  function endThumbs(e){
    return '<div class="fs-end-thumbs">' + (e.photos || []).map((u, i) =>
      `<img src="${esc(photoSrc(u))}" alt="" loading="lazy" data-photo="${esc(e.entryId)}" data-focus="${i}">`).join('') + '</div>';
  }

  function exampleBox(shift, i){
    return `<button type="button" class="fs-shot-box" data-shoot="${shift}" data-slot="${i}">` +
      `<img class="ex" src="${esc(END_EXAMPLES[i] || '')}" alt="" onerror="this.remove()">` +
      '<span class="ex-tag">ตัวอย่าง</span><span class="cam">📷</span><span class="tap">แตะเพื่อถ่าย</span></button>';
  }

  // 3 ช่องว่างพร้อมรูปตัวอย่างจาง — แตะช่องไหน เปิดกล้องที่รูปนั้น
  function exampleSlots(shift){
    return '<div class="fs-shots-head"><b>รูปถ่ายพื้นที่ทำงาน <span class="req">* ต้องครบ ' + END_SHOTS.length + ' รูป</span></b>' +
      '<span class="cnt">0/' + END_SHOTS.length + ' รูป</span></div>' +
      '<div class="fs-shots">' + END_SHOTS.map((t, i) =>
        '<div><div class="fs-shot-lbl">' + (i + 1) + '. ' + esc(t) + '</div>' + exampleBox(shift, i) + '</div>').join('') + '</div>';
  }

  function renderToday(){
    const box = $('fs-today');
    const d = data;
    if (d.todayDay > 6) {
      box.innerHTML = '<div class="bg-white rounded-xl shadow p-6 text-center text-gray-500">วันอาทิตย์ไม่มีเวร 5ส.</div>';
      return;
    }
    const shifts = crew === 'B' ? ['B', 'A'] : ['A', 'B'];
    box.innerHTML = '<div class="text-sm text-gray-500 mb-2">วัน' + esc(DAY_FULL[d.todayDay]) + ' ' + esc(shortDate(d.today)) + ' (ตัดรอบวัน 08:00)</div>' +
      shifts.map(shift => {
        const e = endEntry(d.endToday, d.today, shift);
        const mine = crew === shift;
        let body = '';
        if (e && e.photos && e.photos.length) {
          body += endThumbs(e);
          body += '<div class="text-sm text-gray-500 mb-2">👤 ' + esc(e.doneByName) + ' · ' + esc(timeOf(e.timestamp)) +
            (e.remark ? ' · ' + esc(e.remark) : '') + '</div>';
        }
        if (e && e.status === 'rejected') {
          body += '<div class="fs-reject-note"><b>Leader ให้ทำใหม่:</b> ' + esc(e.rejectReason) + ' (' + esc(e.confirmedName) + ')</div>';
        }
        if (e && e.status === 'confirmed') {
          body += '<div class="text-sm text-green-700 font-bold">✔ ' + esc(e.confirmedName) + ' ยืนยันเมื่อ ' + esc(timeOf(e.confirmedAt)) + '</div>';
        }
        if (!e || e.status === 'rejected') body += exampleSlots(shift);
        return '<div class="fs-job-card' + (mine ? ' mine' : '') + '">' +
          '<div class="flex justify-between items-center gap-2 mb-1"><span><span class="fs-shift-pill shift-' + shift.toLowerCase() + '">กะ ' + shift + '</span>' +
          (mine ? ' <span class="text-sm text-blue-600 font-bold">งานของคุณ</span>' : '') + '</span>' +
          statusBadge(e, d.today) + '</div>' +
          '<div class="text-xs text-gray-500 mb-2">👥 ผู้รับผิดชอบ: พนักงานกะ ' + shift + ' · ถ่ายรูปพื้นที่ทำงานก่อนเลิกงาน</div>' +
          body + '</div>';
      }).join('');
  }

  // ===== รอ Leader ตรวจยืนยัน =====
  function renderPending(){
    const card = $('fs-pending-card');
    const list = (data.pending || []).slice().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    card.classList.toggle('hidden', !canConfirm() || !list.length);
    if (!canConfirm()) return;
    $('fs-pending-count').textContent = list.length;
    const confirmable = list.filter(canConfirmEntry);
    $('fs-confirm-all').classList.toggle('hidden', confirmable.length < 2);
    $('fs-pending-list').innerHTML = list.map(e =>
      '<div class="fs-pend-item">' +
        '<div class="fs-pend-thumbs">' + (e.photos || []).map((u, i) =>
          `<img src="${esc(photoSrc(u, 200))}" alt="" loading="lazy" data-photo="${esc(e.entryId)}" data-focus="${i}">`).join('') + '</div>' +
        '<div class="flex-1 min-w-0 text-sm"><b>5ส. หลังเลิกงาน</b> <span class="fs-shift-pill shift-' + esc(e.shift.toLowerCase()) + '">กะ ' + esc(e.shift) + '</span><br>' +
          'วัน' + esc(DAY_FULL[e.day] || '') + ' ' + esc(shortDate(e.date)) + ' · ' + esc(timeOf(e.timestamp)) + '<br>' +
          'ผู้ทำ: ' + esc(e.doneByName) + (e.remark ? '<br>หมายเหตุ: ' + esc(e.remark) : '') +
          (canConfirmEntry(e)
            ? '<div class="flex gap-2 mt-2">' +
                `<button type="button" class="fs-btn-ok" data-confirm="${esc(e.entryId)}">✔ ยืนยัน</button>` +
                `<button type="button" class="fs-btn-reject" data-reject="${esc(e.entryId)}">↺ ให้ทำใหม่</button></div>`
            : '<div class="text-xs text-gray-400 mt-2">งานที่คุณถ่ายเอง — ให้ Leader คนอื่นตรวจ</div>') +
        '</div></div>').join('');
  }

  // ===== ตารางรายสัปดาห์ =====
  function renderWeek(){
    const d = data;
    let head = '<thead><tr><th>กะ</th>';
    for (let day = 1; day <= 6; day++) {
      head += '<th class="day-' + day + '">' + DAY_LABELS[day] + '<br><span class="text-[11px] font-normal">' + shortDate(addDays(d.weekStart, day - 1)) + '</span></th>';
    }
    let body = '<tbody>', due = 0, done = 0, confirmed = 0;
    SHIFTS.forEach(shift => {
      body += '<tr><td><span class="fs-shift-pill shift-' + shift.toLowerCase() + '">กะ ' + shift + '</span></td>';
      for (let day = 1; day <= 6; day++) {
        const date = addDays(d.weekStart, day - 1);
        const e = endEntry(d.endEntries, date, shift);
        if (date <= d.today) {
          due++;
          if (e && (e.status === 'done' || e.status === 'confirmed')) done++;
          if (e && e.status === 'confirmed') confirmed++;
        }
        const hasPhoto = e && e.photo;
        body += '<td>' + (e || date <= d.today
          ? '<div class="' + (hasPhoto ? 'cursor-pointer' : '') + '"' + (hasPhoto ? ` data-photo="${esc(e.entryId)}"` : '') + '>' + statusBadge(e, date) +
            (e && e.doneByName ? '<div class="text-[10px] text-gray-400 mt-0.5">' + esc(e.doneByName) + '</div>' : '') + '</div>'
          : '') + '</td>';
      }
      body += '</tr>';
    });
    $('fs-week-title').textContent = shortDate(d.weekStart) + ' – ' + shortDate(d.weekEnd);
    $('fs-week-next').disabled = d.weekEnd >= d.today;
    $('fs-week-table').innerHTML = head + '</tr></thead>' + body + '</tbody>';
    $('fs-week-summary').innerHTML =
      '<span class="fs-badge done">ทำแล้ว ' + done + '/' + due + '</span> ' +
      '<span class="fs-badge confirmed">Leader ยืนยัน ' + confirmed + '/' + due + '</span>';
  }

  // ===== Leader ยืนยัน / ตีกลับ =====
  async function confirmEntries(ids){
    if (confirming || !ids.length) return;
    if (!confirm(ids.length > 1 ? 'ยืนยันทั้งหมด ' + ids.length + ' รายการ?' : 'ยืนยันงาน 5ส. นี้?')) return;
    confirming = true;
    try {
      const res = await postFs({ action: 'CONFIRM_FIVES', entryIds: ids });
      if (!res || res.status !== 'success') { toast((res && res.message) || 'ยืนยันไม่สำเร็จ', 'error'); return; }
      toast(res.message);
      await load();
    } catch (e) {
      toast('ยืนยันไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      confirming = false;
    }
  }

  async function rejectEntry(id){
    if (confirming) return;
    const raw = prompt('เหตุผลที่ให้ทำใหม่ (บังคับ):');
    if (raw === null) return;
    const reason = raw.trim();
    if (!reason) { toast('กรุณาระบุเหตุผลที่ให้ทำใหม่', 'warning'); return; }
    confirming = true;
    try {
      const res = await postFs({ action: 'REJECT_FIVES', entryId: id, reason: reason });
      if (!res || res.status !== 'success') { toast((res && res.message) || 'บันทึกไม่สำเร็จ', 'error'); return; }
      toast(res.message);
      await load();
    } catch (e) {
      toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    } finally {
      confirming = false;
    }
  }

  // ===== กล้อง =====
  // ต้องได้รูปครบทุกช่อง: กล้องเดินไปช่องว่างถัดไปเอง หน้าตรวจแสดงทุกช่อง แตะช่องไหนถ่ายช่องนั้นใหม่
  // ยังไม่ส่งอะไรจนกว่าจะครบทุกช่อง
  function hasLiveCamera(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  function openEndCamera(shift, first){
    if (data && data.todayDay > 6) return;
    camJob = { shift };
    camShots = END_SHOTS.map(() => '');
    $('fs-cam-title').textContent = '5ส. หลังเลิกงาน · กะ ' + shift;
    $('fs-cam-remark').value = '';
    takeShot(first || 0);
  }

  async function takeShot(i){
    if (sending || !camJob) return;
    camIdx = i;
    if (!hasLiveCamera()) {
      $('fs-cam-fallback').value = '';
      $('fs-cam-fallback').click();
      return;
    }
    if (!camStream) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
        });
      } catch (e) {
        // เปิดกล้องรูปแรกไม่ได้ → ไม่มีหน้าให้กลับไป
        if ($('fs-cam').classList.contains('hidden')) camJob = null;
        toast('เปิดกล้องไม่ได้ กรุณาอนุญาตให้ใช้กล้องในเบราว์เซอร์ แล้วลองใหม่', 'error');
        return;
      }
      $('fs-cam-video').srcObject = camStream;
    }
    showLive();
  }

  function showLive(){
    $('fs-cam-hint').textContent = 'รูปที่ ' + (camIdx + 1) + '/' + END_SHOTS.length + ': ' + END_SHOTS[camIdx];
    $('fs-cam-strip').innerHTML = camShots.map((p, i) =>
      `<button type="button" class="fs-cam-slot${i === camIdx ? ' active' : ''}" data-pick="${i}" title="${esc(END_SHOTS[i])}">` +
      (p ? `<img src="${p}" alt="">` : (i + 1)) + '</button>').join('');
    $('fs-cam-video').classList.remove('hidden');
    $('fs-cam-grid').classList.add('hidden');
    $('fs-cam-live').classList.remove('hidden');
    $('fs-cam-review').classList.add('hidden');
    $('fs-cam').classList.remove('hidden');
  }

  function showReview(){
    $('fs-cam-grid').innerHTML = camShots.map((p, i) =>
      `<div class="fs-cam-tile" data-retake="${i}">` +
      (p ? `<img src="${p}" alt="">`
         : `<img src="${esc(END_EXAMPLES[i] || '')}" alt="" style="opacity:0.35;" onerror="this.remove()">` +
           '<span class="absolute">📷 แตะเพื่อถ่ายรูปที่ ' + (i + 1) + '</span>') +
      '<span class="cap">' + (i + 1) + '. ' + esc(END_SHOTS[i]) + '</span></div>').join('');
    $('fs-cam-send').disabled = camShots.some(p => !p);
    $('fs-cam-video').classList.add('hidden');
    $('fs-cam-grid').classList.remove('hidden');
    $('fs-cam-live').classList.add('hidden');
    $('fs-cam-review').classList.remove('hidden');
    $('fs-cam').classList.remove('hidden');
  }

  function stopStream(){
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    camStream = null;
    $('fs-cam-video').srcObject = null;
  }

  function closeCamera(){
    if (sending) return;
    stopStream();
    camJob = null;
    camShots = [];
    $('fs-cam').classList.add('hidden');
  }

  // ย่อรูป + ประทับแถบด้านล่าง: "5ส. หลังเลิกงาน กะ A (1/3) | yyyy-MM-dd HH:mm | ชื่อ" (เวลาไทย)
  function stampPhoto(source, w, h){
    const scale = Math.min(1, PHOTO_MAX / Math.max(w, h));
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, cw, ch);
    const bkk = new Date(Date.now() + 7 * 3600 * 1000).toISOString();
    const text = '5ส. หลังเลิกงาน กะ ' + camJob.shift + ' (' + (camIdx + 1) + '/' + camShots.length + ')' +
      ' | ' + bkk.substring(0, 10) + ' ' + bkk.substring(11, 16) + ' | ' + (userName() || '');
    const fs = Math.max(14, Math.round(cw / 32));
    ctx.font = '700 ' + fs + 'px Sarabun, sans-serif';
    const pad = Math.round(fs * 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, ch - fs - pad * 2, cw, fs + pad * 2);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, ch - pad - fs / 2, cw - pad * 2);
    return canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
  }

  function snap(){
    const video = $('fs-cam-video');
    if (!video.videoWidth) { toast('กล้องยังไม่พร้อม รอสักครู่', 'warning'); return; }
    camShots[camIdx] = stampPhoto(video, video.videoWidth, video.videoHeight);
    const next = camShots.findIndex(p => !p);
    if (next !== -1) { camIdx = next; showLive(); return; }
    stopStream();
    showReview();
  }

  // ไม่มี getUserMedia: ใช้กล้องของเครื่องผ่าน <input capture> และไม่รับรูปเก่าจากคลังภาพ
  function onFallbackPhoto(input){
    const file = input.files && input.files[0];
    if (!file || !camJob) return;
    if (!file.lastModified || Date.now() - file.lastModified > FALLBACK_MAX_AGE_MS) {
      toast('ต้องถ่ายรูปใหม่จากกล้องเท่านั้น (ห้ามใช้รูปเก่าจากคลังภาพ)', 'error');
      if (!$('fs-cam').classList.contains('hidden')) showReview();
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      camShots[camIdx] = stampPhoto(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      showReview();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('อ่านรูปไม่ได้ กรุณาถ่ายใหม่', 'error'); };
    img.src = url;
  }

  async function sendPhotos(){
    if (sending || !camJob || !camShots.length) return;
    if (camShots.some(p => !p)) { toast('กรุณาถ่ายรูปให้ครบ ' + camShots.length + ' รูป', 'warning'); return; }
    sending = true;
    const btn = $('fs-cam-send');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังส่ง...';
    try {
      const res = await postFs({
        action: 'SAVE_FIVES_END',
        shift: camJob.shift,
        photos: camShots.slice(),
        remark: $('fs-cam-remark').value.trim(),
        clientRequestId: 'fives-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
      });
      if (!res || res.status !== 'success') { toast((res && res.message) || 'บันทึกไม่สำเร็จ', 'error'); return; }
      toast(res.message || 'บันทึกเรียบร้อย');
      sending = false;
      closeCamera();
      await load();
    } catch (e) {
      toast('ส่งไม่สำเร็จ กรุณาลองใหม่: ' + e.message, 'error');
    } finally {
      sending = false;
      btn.textContent = '✔ ยืนยันงาน';
      btn.disabled = camShots.some(p => !p);
    }
  }

  // ===== หน้าต่างดูรูป =====
  function openPhoto(id, focus){
    if (!data) return;
    const pool = (data.endEntries || []).concat(data.endToday || [], data.pending || []);
    const e = pool.find(x => x.entryId === id);
    if (!e || !e.photos || !e.photos.length) return;
    $('fs-photo-title').textContent = '5ส. หลังเลิกงาน · กะ ' + e.shift + ' · ' + (DAY_FULL[e.day] || '') + ' ' + shortDate(e.date);
    $('fs-photo-body').innerHTML = e.photos.map((u, i) =>
      `<div class="text-sm font-bold mb-1" id="fs-photo-lbl${i}">${i + 1}. ${esc(END_SHOTS[i] || '')}</div>` +
      `<a href="${esc(u)}" target="_blank" rel="noopener"><img class="w-full max-h-[70vh] object-contain rounded-lg bg-gray-100 mb-3" src="${esc(photoSrc(u, 1600))}" alt=""></a>`).join('');
    let meta = 'ผู้ทำ: ' + e.doneByName + ' เวลา ' + timeOf(e.timestamp);
    if (e.remark) meta += ' · หมายเหตุ: ' + e.remark;
    if (e.status === 'confirmed') meta += ' · ยืนยันโดย ' + e.confirmedName + ' ' + timeOf(e.confirmedAt);
    if (e.status === 'rejected') meta += ' · ตีกลับโดย ' + e.confirmedName + ': ' + e.rejectReason;
    $('fs-photo-meta').textContent = meta;
    $('fs-photo-modal').classList.remove('hidden');
    const target = focus ? $('fs-photo-lbl' + focus) : null;
    if (target) target.scrollIntoView({ block: 'start' });
  }

  function init(){
    if (initialized) return;
    initialized = true;
    crew = loadCrew();
    const sec = $('section-fives');
    // ปุ่มที่สร้างใหม่ทุกครั้งที่ render — ดักที่ section เดียว
    sec.addEventListener('click', ev => {
      const t = ev.target.closest('[data-shoot],[data-photo],[data-confirm],[data-reject]');
      if (!t) return;
      if (t.dataset.shoot) openEndCamera(t.dataset.shoot, Number(t.dataset.slot) || 0);
      else if (t.dataset.photo) openPhoto(t.dataset.photo, Number(t.dataset.focus) || 0);
      else if (t.dataset.confirm) confirmEntries([t.dataset.confirm]);
      else if (t.dataset.reject) rejectEntry(t.dataset.reject);
    });
    $('fs-crew-a').addEventListener('click', () => { crew = 'A'; saveCrew(crew); render(); });
    $('fs-crew-b').addEventListener('click', () => { crew = 'B'; saveCrew(crew); render(); });
    $('fs-view-today').addEventListener('click', () => { view = 'today'; render(); });
    $('fs-view-week').addEventListener('click', () => { view = 'week'; render(); });
    $('fs-refresh').addEventListener('click', load);
    $('fs-confirm-all').addEventListener('click', () => {
      confirmEntries((data && data.pending || []).filter(canConfirmEntry).map(e => e.entryId));
    });
    $('fs-week-prev').addEventListener('click', () => { if (data) { weekRef = addDays(data.weekStart, -7); load(); } });
    $('fs-week-next').addEventListener('click', () => {
      if (!data) return;
      const next = addDays(data.weekStart, 7);
      weekRef = next > data.today ? '' : next;
      load();
    });

    $('fs-cam-close').addEventListener('click', closeCamera);
    $('fs-cam-shutter').addEventListener('click', snap);
    $('fs-cam-send').addEventListener('click', sendPhotos);
    $('fs-cam-fallback').addEventListener('change', ev => onFallbackPhoto(ev.target));
    $('fs-cam-strip').addEventListener('click', ev => {
      const b = ev.target.closest('[data-pick]');
      if (b) { camIdx = Number(b.dataset.pick); showLive(); }
    });
    $('fs-cam-grid').addEventListener('click', ev => {
      const t = ev.target.closest('[data-retake]');
      if (t) takeShot(Number(t.dataset.retake));
    });
    $('fs-photo-close').addEventListener('click', () => $('fs-photo-modal').classList.add('hidden'));
    $('fs-photo-modal').addEventListener('click', ev => { if (ev.target === $('fs-photo-modal')) $('fs-photo-modal').classList.add('hidden'); });
  }

  window.loadFiveS = function(){
    init();
    render();
    load();
  };
})();
