const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'js', 'globals.js'), 'utf8');

function env() {
  const calls = [];
  const hidden = new Set(); // dashboard-content hidden?
  const fetched = [];
  const win = { fetch: (u, i) => { fetched.push(i); return Promise.resolve({}); }, currentUser: { role: 'Admin' }, jobOrderList: [{ id: 1 }],
    loadInbox() { calls.push('inbox'); }, loadDashboard() { calls.push('dashboard'); }, loadJobOrders() { calls.push('planning'); } };
  const el = { classList: { toggle() {}, add() {}, remove() {}, contains: () => hidden.has('dash') } };
  const ctx = vm.createContext({ window: win, document: { getElementById: id => id === 'dashboard-content' || id.startsWith('section-') || id.startsWith('tab-') ? el : null }, Date, JSON, Object, Array, String, Promise, console });
  const m = src.match(/\/\/ ===== ไม่โหลดซ้ำ[\s\S]*?\n\};\n/);
  vm.runInContext('var inboxData = {status:"success"};\n' + m[0], ctx);
  return { win, calls, hidden, fetched, ctx };
}
const sw = e => (t) => e.win.switchTab(t);

test('second visit within TTL does not reload; write invalidates', () => {
  const e = env();
  e.win.switchTab('inbox'); e.win.switchTab('dashboard'); e.win.switchTab('planning');
  e.win.switchTab('inbox'); e.win.switchTab('dashboard'); e.win.switchTab('planning');
  assert.equal(e.calls.join(','), 'inbox,dashboard,planning');
  e.win.fetch('x', { method: 'POST', body: JSON.stringify({ action: 'GET_DASHBOARD' }) });
  e.win.switchTab('inbox');
  assert.equal(e.calls.length, 3);
  e.win.fetch('x', { method: 'POST', body: JSON.stringify({ action: 'SAVE_LOG' }) });
  e.win.switchTab('inbox');
  assert.equal(e.calls.length, 4);
});

test('no data (failed load) reloads', () => {
  const e = env();
  e.win.switchTab('dashboard'); e.hidden.add('dash'); e.win.switchTab('dashboard');
  assert.equal(e.calls.length, 2);
});
