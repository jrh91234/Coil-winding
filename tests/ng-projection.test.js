const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', 'charts', f), 'utf8');

function env() {
  const win = {};
  const ctx = vm.createContext({ window: win, localStorage: { getItem() { return null; }, setItem() {} },
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] }, console: { log() {}, warn() {} } });
  win.window = win;
  vm.runInContext(read('helpers.js'), ctx);
  const main = read('main.js');
  vm.runInContext(main.slice(main.indexOf('window.buildNgRateProjection = function')), ctx);
  return win;
}

// ข้อมูลรายวัน 2026-02-02 ถึง endDate, หยุดวันอาทิตย์, NG ค่อย ๆ ลดลง
function makeRows(win, endDate) {
  const rows = [];
  for (let k = '2026-02-02', t = 0; k <= endDate; k = win.addPeriods(k, 'day', 1), t++) {
    const sun = win.periodStartDate(k, 'day').getDay() === 0;
    const rate = 0.04 - t * 0.00005 + (t % 5 - 2) * 0.001;
    const tot = sun ? 0 : 1000;
    rows.push({ date: k, fgKg: tot * (1 - rate), ngKg: tot * rate, fgPcs: tot * 100 * (1 - rate), ngPcs: tot * 100 * rate,
                pendingKg: 0, forecastNgRate: null, ngRate: rate * 100 });
  }
  return rows;
}
function display(win, rows, period) {
  if (period === 'day') return rows;
  return win.groupRowsByPeriod(rows, period, r => r.date, () => ({ fgKg: 0, ngKg: 0 }), (a, r) => { a.fgKg += r.fgKg; a.ngKg += r.ngKg; })
    .map(g => Object.assign(g, { ngRate: g.ngKg / (g.fgKg + g.ngKg) * 100 }));
}

test('addPeriods / periodDayProgress', () => {
  const win = env();
  assert.equal(win.addPeriods('2026-11', 'month', 2), '2027-01');
  assert.equal(win.addPeriods('2026-Q4', 'quarter', 1), '2027-Q1');
  assert.equal(win.addPeriods('2026-11-02', 'week', 1), '2026-11-09');
  assert.equal(win.addPeriods('2026-12-31', 'day', 1), '2027-01-01');
  assert.deepEqual({ ...win.periodDayProgress('2026-11', 'month', '2026-11-05') }, { total: 30, elapsed: 5 });
});

test('holtForecast follows a linear trend and needs 4 points', () => {
  const win = env();
  assert.equal(win.holtForecast([1, 2, 3], 2), null);
  const r = win.holtForecast([10, 9, 8, 7, 6, 5], 1);
  assert.ok(r.forecast[0] < 5 && r.forecast[0] > 3.5, String(r.forecast[0]));
});

test('every period projects forward; current month is partial', () => {
  const win = env();
  const rows = makeRows(win, '2026-11-05');
  const expectFuture = { day: 7, week: 4, month: 3, quarter: 2, year: 1 };
  for (const p of Object.keys(expectFuture)) {
    const disp = display(win, rows, p);
    const r = win.buildNgRateProjection(rows, disp, p);
    assert.ok(r, p);
    assert.equal(r.extraLabels.length, expectFuture[p], p);
    for (const pt of Object.values(r.points)) {
      assert.ok(pt.rate > 0 && pt.lo <= pt.rate && pt.hi >= pt.rate, p);
    }
  }
  const m = win.buildNgRateProjection(rows, display(win, rows, 'month'), 'month');
  const nov = m.points[9];
  assert.equal(nov.isPartial, true);
  assert.equal(nov.progress, '5/30 วัน');
  assert.ok(nov.remainingPcs > 0 && nov.estPcs > nov.remainingPcs);
});

test('day projection skips weekdays with no recent production', () => {
  const win = env();
  const rows = makeRows(win, '2026-11-05');
  const r = win.buildNgRateProjection(rows, rows, 'day');
  assert.ok(!r.extraLabels.includes('2026-11-08'), r.extraLabels.join(','));
});

test('projectPeriodTotals: all periods, partial month, skips Sundays', () => {
  const win = env();
  const daily = [];
  for (let k = '2026-02-02'; k <= '2026-11-05'; k = win.addPeriods(k, 'day', 1)) {
    daily.push({ date: k, value: win.periodStartDate(k, 'day').getDay() === 0 ? 0 : 100000 });
  }
  const expectFuture = { day: 7, week: 4, month: 3, quarter: 2, year: 1 };
  for (const p of Object.keys(expectFuture)) {
    const r = win.projectPeriodTotals(daily, p);
    assert.ok(r, p);
    const lastKey = win.getPeriodKey('2026-11-05', p);
    assert.equal(r.order.filter(k => k > lastKey).length, expectFuture[p], p);
  }
  const d = win.projectPeriodTotals(daily, 'day');
  assert.ok(!d.order.includes('2026-11-08'));
  // คงที่ 100,000 ชิ้น/วันทำงาน: พ.ย. มี 25 วันทำงาน (ไม่นับอาทิตย์) → ≈ 2.5 ล้าน
  const m = win.projectPeriodTotals(daily, 'month');
  const nov = m.points['2026-11'];
  assert.equal(nov.isPartial, true);
  assert.equal(nov.actual, 400000); // 2–5 พ.ย. (1 พ.ย. เป็นวันอาทิตย์)
  assert.ok(Math.abs(nov.value - 2500000) < 1000, String(nov.value));
});
