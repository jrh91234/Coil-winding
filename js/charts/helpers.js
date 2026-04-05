try { Chart.register(ChartDataLabels); } catch(e) { console.warn("ChartDataLabels not loaded"); }

// ==========================================
// Helper: แยก Setup vs Production จาก NG data
// "Setup - ลวดถลอก (Scratched)" → base = "ลวดถลอก (Scratched)", isSetup = true
// ==========================================
window.parseSetupType = function(typeName) {
    const t = (typeName || '').trim();
    const match = t.match(/^setup\s*-\s*(.+)$/i);
    if (match) return { base: capitalizeFirst(match[1].trim()), isSetup: true };
    if (t.toLowerCase() === 'setup') return { base: 'Setup', isSetup: true };
    return { base: capitalizeFirst(t), isSetup: false };
};

// รวม NG data โดยแยกชั้น Production vs Setup
// input: { "ลวดถลอก (Scratched)": 100, "Setup - ลวดถลอก (Scratched)": 30, "พันหลวม (Loose)": 50 }
// output: { labels: [...], production: [...], setup: [...] }
window.separateSetupData = function(breakdownMap) {
    const prodMap = {};
    const setupMap = {};

    Object.entries(breakdownMap || {}).forEach(([type, val]) => {
        const parsed = window.parseSetupType(type);
        if (parsed.base.toLowerCase() === 'setup') {
            // "Setup" ที่ไม่มี sub-symptom → ไม่รวมเข้ากับอาการอื่น
            prodMap[parsed.base] = (prodMap[parsed.base] || 0) + val;
        } else if (parsed.isSetup) {
            setupMap[parsed.base] = (setupMap[parsed.base] || 0) + val;
        } else {
            prodMap[parsed.base] = (prodMap[parsed.base] || 0) + val;
        }
    });

    // รวม labels ทั้งหมด (unique)
    const allLabels = [...new Set([...Object.keys(prodMap), ...Object.keys(setupMap)])];
    // sort by total descending
    allLabels.sort((a, b) => ((prodMap[b] || 0) + (setupMap[b] || 0)) - ((prodMap[a] || 0) + (setupMap[a] || 0)));

    return {
        labels: allLabels,
        production: allLabels.map(l => prodMap[l] || 0),
        setup: allLabels.map(l => setupMap[l] || 0),
        total: allLabels.map(l => (prodMap[l] || 0) + (setupMap[l] || 0))
    };
};

