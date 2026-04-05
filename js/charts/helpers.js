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

// ==========================================
// Helper: WPP (Weight Per Piece) — shared, strict (no fallback)
// ==========================================
const WPP_TABLE = { "10A": 0.00228, "16A": 0.00279, "20A": 0.00357, "25/32A": 0.005335 };

window.getWppStrict = function(prod) {
    if (!prod) return null;
    for (const k in WPP_TABLE) { if (prod.includes(k)) return WPP_TABLE[k]; }
    return null;
};

window.getKgFromPcs = function(prod, pcs) {
    if (!pcs || pcs <= 0) return 0;
    const w = window.getWppStrict(prod);
    if (w === null) return 0;
    return pcs * w;
};

