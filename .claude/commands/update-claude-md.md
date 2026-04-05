Update the CLAUDE.md section map to match current code.

Steps:
1. Use Grep to find key section markers in js/charts.js:
   - `parseSetupType` and `separateSetupData`
   - `paretoViewSelector` or `Pareto Machine Selector`
   - `getWppStrict`
   - `displayTrendData = trendData.map`
   - `charts.qcTrend = new Chart`
   - `showDailyNgBreakdown`
   - `showTrendDayBreakdown`
   - `exportNgRateAudit`
2. Note the actual line numbers from Grep results
3. Count total lines with `wc -l js/charts.js`
4. Update CLAUDE.md "Charts.js Section Map" with correct line numbers
5. Do NOT change any other section of CLAUDE.md unless instructed
