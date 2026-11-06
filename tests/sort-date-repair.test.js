// Node: node --test tests/sort-date-repair.test.js
// Loads scr/backend.gs with a Utilities stand-in (GMT+7) and checks the Sorting -> Production_Data date handling.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'scr', 'backend.gs'), 'utf8');
const pad = n => String(n).padStart(2, '0');
const Utilities = {
  formatDate(d, tz, fmt) {
    const t = new Date(d.getTime() + 7 * 3600e3);
    return fmt.replace('yyyy', t.getUTCFullYear()).replace('MM', pad(t.getUTCMonth() + 1)).replace('dd', pad(t.getUTCDate())).replace('HH', pad(t.getUTCHours())).replace('mm', pad(t.getUTCMinutes())).replace('ss', pad(t.getUTCSeconds()));
  },
};
const context = vm.createContext({ Utilities, console, Logger: { log() {} }, Date, Map, Set, Number, parseInt, isNaN, String, Array, Error });
vm.runInContext(source, context);
const plan = (prod, sort, from = '2026-10-01') => { context.__p = prod; context.__s = sort; context.__f = from; return vm.runInContext('planSortDateRepair_(__p, __s, __f)', context); };
const j = x => JSON.parse(JSON.stringify(x));

const PROD_HEAD = ['Timestamp', 'Date', 'Machine', 'Shift', 'Product', 'Hour', 'FG', 'Batch_ID', 'Shift_Type'];
const SORT_HEAD = ['Timestamp', 'Job_ID', 'Date', 'Product', 'Status'];
const prod = (date, machine, shift, hour, batch = '', product = 'P1') => ['', date, machine, shift, product, hour, 10, batch, ''];
const sortRow = (id, date) => ['', id, date, 'M : P1', 'Completed'];

test('the QC-approval path no longer shifts the date back a second time', () => {
  const start = source.indexOf('// === แปลงวันที่จาก Sorting_Data ===');
  const end = source.indexOf('const shiftType = (hourNum >= 8 && hourNum < 20)', start);
  assert.ok(start > 0 && end > start, 'block not found');
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /setDate\(/);
  assert.doesNotMatch(block, /hourNum\s*<\s*8/);
  assert.match(block, /dateStr = Utilities\.formatDate\(sortDateRaw, "GMT\+7", "yyyy-MM-dd"\)/);
});

test('a SORT- row dated one day early (time before 08:00) is fixed, with the shift looked up on the right day', () => {
  const rows = [PROD_HEAD,
    prod('2026-11-05', 'CW1', 'A', '08:00-09:00'),
    prod('2026-11-05', 'CW1', 'B', '02:00-03:00'),
    prod('2026-11-04', 'CW1', 'A', '14:00-15:00', 'SORT-J1')];
  const p = plan(rows, [SORT_HEAD, sortRow('J1', '2026-11-05 03:00')]);
  assert.equal(p.fixes.length, 1);
  assert.deepEqual(j(p.fixes[0]), { row: 4, jobId: 'J1', machine: 'CW1', product: 'P1', oldDate: '2026-11-04', sourceDate: '2026-11-05', oldShift: 'A', newDate: '2026-11-05', newShift: 'B' });
});

test('rows already correct, including ones fixed by hand in Excel, are left alone', () => {
  const rows = [PROD_HEAD, prod('2026-11-05', 'CW1', 'B', '03:00-04:00', 'SORT-J1'), prod('2026-11-05', 'CW1', 'A', '09:00-10:00', 'SORT-J2')];
  const p = plan(rows, [SORT_HEAD, sortRow('J1', '2026-11-05 03:00'), sortRow('J2', '2026-11-05 09:00')]);
  assert.equal(p.fixes.length, 0);
  assert.equal(p.counts.alreadyCorrect, 2);
  assert.equal(p.review.length, 0);
});

test('any other mismatch goes to review and is never changed', () => {
  const rows = [PROD_HEAD,
    prod('2026-11-07', 'CW1', 'A', '03:00-04:00', 'SORT-J1'),   // moved forward by hand
    prod('2026-11-04', 'CW1', 'A', '10:00-11:00', 'SORT-J2')];  // time is after 08:00, so not the double-cut pattern
  const p = plan(rows, [SORT_HEAD, sortRow('J1', '2026-11-05 03:00'), sortRow('J2', '2026-11-05 10:00')]);
  assert.equal(p.fixes.length, 0);
  assert.equal(p.review.length, 2);
});

test('only jobs from the start date on are considered; unknown jobs and non-SORT rows are skipped', () => {
  const rows = [PROD_HEAD,
    prod('2026-09-29', 'CW1', 'B', '03:00-04:00', 'SORT-OLD'),
    prod('2026-10-01', 'CW1', 'B', '03:00-04:00', 'SORT-NEW'),
    prod('2026-10-02', 'CW1', 'B', '03:00-04:00', 'SORT-GONE'),
    prod('2026-10-02', 'CW1', 'A', '09:00-10:00', 'BATCH-1')];
  const p = plan(rows, [SORT_HEAD, sortRow('OLD', '2026-09-30 03:00'), sortRow('NEW', '2026-10-02 03:00')]);
  assert.equal(p.counts.sortRows, 3);
  assert.equal(p.counts.beforeFrom, 1);
  assert.equal(p.counts.noSource, 1);
  assert.equal(p.fixes.length, 1);
  assert.equal(p.fixes[0].jobId, 'NEW');
});

test('dates stored as Date objects or Buddhist-year text are read in GMT+7', () => {
  const rows = [PROD_HEAD, prod('2026-11-04', 'CW1', 'A', '', 'SORT-J1'), prod('2026-11-04', 'CW1', 'A', '', 'SORT-J2')];
  const p = plan(rows, [SORT_HEAD, sortRow('J1', new Date('2026-11-05T03:00:00+07:00')), sortRow('J2', '2569-11-05 03:00')]);
  assert.equal(p.fixes.length, 2);
  assert.ok(p.fixes.every(f => f.newDate === '2026-11-05'));
});

test('without a matching production row the shift falls back to day/night, and running the plan twice finds nothing new after the fix', () => {
  const rows = [PROD_HEAD, prod('2026-11-04', 'CW9', 'A', '', 'SORT-J1')];
  const first = plan(rows, [SORT_HEAD, sortRow('J1', '2026-11-05 03:00')]);
  assert.equal(first.fixes[0].newShift, 'B');
  rows[1][1] = first.fixes[0].newDate; rows[1][3] = first.fixes[0].newShift;
  const second = plan(rows, [SORT_HEAD, sortRow('J1', '2026-11-05 03:00')]);
  assert.equal(second.fixes.length, 0);
  assert.equal(second.counts.alreadyCorrect, 1);
});

test('a missing column stops with a clear message instead of guessing', () => {
  assert.throws(() => plan([['Date', 'Machine']], [SORT_HEAD]), /Production_Data/);
  assert.throws(() => plan([PROD_HEAD], [['Foo']]), /Sorting_Data/);
});
