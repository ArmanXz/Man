import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Clock, Wallet, TrendingUp, TrendingDown, CalendarDays, X, Copy, Download, RotateCcw, Gift, BadgeDollarSign, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ---------- Design tokens ---------- */
const BG = "#E7ECF3";
const LIGHT = "#FFFFFF";
const DARK = "#A9B4C6";
const INK = "#2E3947";
const SUB = "#7C8AA0";
const TEAL = "#3C8C7C";
const CORAL = "#D97066";
const AMBER = "#D6A25B";
const PLUM = "#8A6BA8";

const raised = (r = 20) => ({ background: BG, borderRadius: r, boxShadow: `8px 8px 16px ${DARK}, -8px -8px 16px ${LIGHT}` });
const pressed = (r = 20) => ({ background: BG, borderRadius: r, boxShadow: `inset 6px 6px 12px ${DARK}, inset -6px -6px 12px ${LIGHT}` });
const flat = (r = 20) => ({ background: BG, borderRadius: r, boxShadow: `4px 4px 8px ${DARK}, -4px -4px 8px ${LIGHT}` });
const mono = { fontFamily: "'JetBrains Mono', monospace" };

/* ---------- Rate table (from surat perjanjian) ---------- */
const TIERS = [
  { id: "gt12", label: "> 12 Bulan", harian: 157743, bonus: 16000, lemburBiasa: 22535, lemburMerah: 27302 },
  { id: "9-12", label: "9–12 Bulan", harian: 137376, bonus: 16000, lemburBiasa: 19625, lemburMerah: 24102 },
  { id: "5-8", label: "5–8 Bulan", harian: 132376, bonus: 16000, lemburBiasa: 18911, lemburMerah: 23316 },
  { id: "1-4", label: "1–4 Bulan", harian: 127376, bonus: 16000, lemburBiasa: 18197, lemburMerah: 22531 },
];

const DAYS = ["Kam", "Jum", "Sab", "Min", "Sen", "Sel", "Rab"];
const STATUS = [
  { id: "hadir", label: "Hadir" },
  { id: "libur", label: "Libur" },
  { id: "izin", label: "Izin" },
  { id: "alpha", label: "Alpha" },
];
const CATEGORIES = [
  { id: "pokok", label: "Kebutuhan Pokok", color: TEAL },
  { id: "transport", label: "Transportasi", color: AMBER },
  { id: "tempat", label: "Tempat Tinggal", color: PLUM },
  { id: "kesehatan", label: "Kesehatan", color: CORAL },
  { id: "cicilan", label: "Cicilan / Utang", color: "#6B7A8D" },
  { id: "tabungan", label: "Tabungan", color: "#4A90A4" },
  { id: "lain", label: "Lainnya", color: "#9CA6B4" },
];

const rupiah = (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const todayISO = () => new Date().toISOString().slice(0, 10);
function defaultThursday() {
  // Anchor the week to the most recent Thursday (cut-off start: Kamis–Rabu)
  const d = new Date();
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const sinceThu = (day - 4 + 7) % 7;
  d.setDate(d.getDate() - sinceThu);
  return d.toISOString().slice(0, 10);
}
// Urutan hari mingguan: Kam(0) Jum(1) Sab(2) Min(3) Sen(4) Sel(5) Rab(6)
// Minggu (index 3) default libur — normal hari kerja 6 hari, tapi tetap bisa diubah manual.
const SUNDAY_INDEX = 3;
const emptyDay = (idx) => ({ status: idx === SUNDAY_INDEX ? "libur" : "hadir", jamBiasa: 0, jamMerah: 0 });
const newWeek = (startDate, template) => ({
  id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()),
  start: startDate,
  days: template ? template.map((d) => ({ status: d.status, jamBiasa: 0, jamMerah: 0 })) : Array.from({ length: 7 }, (_, i) => emptyDay(i)),
});
function monthKey(dateStr) { return dateStr ? dateStr.slice(0, 7) : ""; }
function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}
function computeWeek(week, rate) {
  let pokok = 0, lembur = 0, hariHadir = 0;
  week.days.forEach((d) => {
    if (d.status === "hadir") { pokok += rate.harian; hariHadir++; }
    lembur += d.jamBiasa * rate.lemburBiasa + d.jamMerah * rate.lemburMerah;
  });
  const bonus = rate.bonus * hariHadir;
  return { pokok, lembur, bonus, total: pokok + lembur + bonus, hariHadir };
}
function fmtIndoDate(d) {
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}
function cutoffInfo() {
  const today = new Date();
  const dow = today.getDay(); // 0 Sun .. 6 Sat
  const sinceThu = (dow - 4 + 7) % 7;
  const start = new Date(today); start.setDate(today.getDate() - sinceThu);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const payday = new Date(end); payday.setDate(end.getDate() + 3);
  return { start, end, payday };
}

const STORAGE_KEY = "ledger-state-v1";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const [tierId, setTierId] = useState("gt12");
  const [weeks, setWeeks] = useState([newWeek(defaultThursday())]);
  const [expenses, setExpenses] = useState([]);
  const [joinDate, setJoinDate] = useState("");
  const [activeMonth, setActiveMonth] = useState(monthKey(todayISO()));

  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(todayISO());
  const [expCat, setExpCat] = useState("pokok");

  const rate = TIERS.find((t) => t.id === tierId);
  const debounceRef = useRef(null);

  /* ---- load once ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          if (data.tierId) setTierId(data.tierId);
          if (Array.isArray(data.weeks) && data.weeks.length) setWeeks(data.weeks);
          if (Array.isArray(data.expenses)) setExpenses(data.expenses);
          if (data.joinDate) setJoinDate(data.joinDate);
          if (data.activeMonth) setActiveMonth(data.activeMonth);
        }
      } catch (e) {
        // no saved data yet — start fresh
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  /* ---- debounced save ---- */
  useEffect(() => {
    if (!loaded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const payload = JSON.stringify({ tierId, weeks, expenses, joinDate, activeMonth });
        const res = await window.storage.set(STORAGE_KEY, payload, false);
        if (!res) throw new Error("no result");
        setSaveError(false);
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 1200);
      } catch (e) {
        setSaveError(true);
      }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [tierId, weeks, expenses, joinDate, activeMonth, loaded]);

  const weekResults = useMemo(() => weeks.map((w) => ({ ...w, calc: computeWeek(w, rate) })), [weeks, rate]);

  const months = useMemo(() => {
    const s = new Set();
    weeks.forEach((w) => s.add(monthKey(w.start)));
    expenses.forEach((e) => s.add(monthKey(e.date)));
    s.add(activeMonth);
    return Array.from(s).sort();
  }, [weeks, expenses, activeMonth]);

  const monthlyStats = useMemo(() => {
    const map = {};
    months.forEach((m) => {
      const mw = weekResults.filter((w) => monthKey(w.start) === m);
      const me = expenses.filter((e) => monthKey(e.date) === m);
      const pokok = mw.reduce((a, w) => a + w.calc.pokok, 0);
      const bonus = mw.reduce((a, w) => a + w.calc.bonus, 0);
      const lembur = mw.reduce((a, w) => a + w.calc.lembur, 0);
      const income = pokok + bonus + lembur;
      const expense = me.reduce((a, e) => a + e.amount, 0);
      map[m] = { pokok, bonus, lembur, income, expense, saldo: income - expense, weeksCount: mw.length };
    });
    return map;
  }, [months, weekResults, expenses]);

  const monthWeeks = weekResults.filter((w) => monthKey(w.start) === activeMonth);
  const monthExpenses = expenses.filter((e) => monthKey(e.date) === activeMonth);

  const cur = monthlyStats[activeMonth] || { pokok: 0, bonus: 0, lembur: 0, income: 0, expense: 0, saldo: 0 };
  const totalPokok = cur.pokok;
  const totalBonus = cur.bonus;
  const totalLembur = cur.lembur;
  const totalIncome = cur.income;
  const totalExpense = cur.expense;
  const saldo = cur.saldo;

  const chartData = monthWeeks.map((w, i) => ({ name: `Mgu ${i + 1}`, Pendapatan: w.calc.total }));

  const catBreakdown = useMemo(() => {
    const map = {};
    monthExpenses.forEach((e) => { map[e.category || "lain"] = (map[e.category || "lain"] || 0) + e.amount; });
    return CATEGORIES.map((c) => ({ ...c, amount: map[c.id] || 0 })).filter((c) => c.amount > 0);
  }, [monthExpenses]);

  /* ---- THR estimate ---- */
  const thr = useMemo(() => {
    if (!joinDate) return null;
    const start = new Date(joinDate);
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months -= 1;
    months = Math.max(0, months);
    // average recorded monthly (pokok+bonus) across months with data, fallback to a standard estimate
    const byMonth = {};
    weekResults.forEach((w) => {
      const k = monthKey(w.start);
      byMonth[k] = (byMonth[k] || 0) + w.calc.pokok + w.calc.bonus;
    });
    const vals = Object.values(byMonth).filter((v) => v > 0);
    const avgMonthly = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : rate.harian * 22 + rate.bonus * 4.34;
    const eligible = months >= 12;
    const amount = eligible ? avgMonthly : avgMonthly * (months / 12);
    return { months, eligible, amount, avgMonthly };
  }, [joinDate, weekResults, rate]);

  const cutoff = cutoffInfo();

  function updateDay(weekId, dayIdx, patch) {
    setWeeks((ws) => ws.map((w) => (w.id === weekId ? { ...w, days: w.days.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d)) } : w)));
  }
  function addWeek() {
    const last = weeks[weeks.length - 1];
    const base = last ? new Date(last.start) : new Date();
    base.setDate(base.getDate() + 7);
    const startStr = base.toISOString().slice(0, 10);
    setWeeks((ws) => [...ws, newWeek(startStr)]);
    setActiveMonth(monthKey(startStr));
  }
  function duplicateWeek(w) {
    const base = new Date(w.start);
    base.setDate(base.getDate() + 7);
    const startStr = base.toISOString().slice(0, 10);
    setWeeks((ws) => [...ws, newWeek(startStr, w.days)]);
    setActiveMonth(monthKey(startStr));
  }
  function removeWeek(id) { setWeeks((ws) => (ws.length > 1 ? ws.filter((w) => w.id !== id) : ws)); }
  function setWeekStart(id, val) { setWeeks((ws) => ws.map((w) => (w.id === id ? { ...w, start: val } : w))); }
  function addExpense() {
    const amt = parseFloat(expAmount);
    if (!expDesc.trim() || !amt || amt <= 0) return;
    setExpenses((es) => [...es, { id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()), desc: expDesc.trim(), amount: amt, date: expDate, category: expCat }]);
    setExpDesc(""); setExpAmount("");
  }
  function removeExpense(id) { setExpenses((es) => es.filter((e) => e.id !== id)); }

  function exportData() {
    const payload = { tierId, weeks, expenses, joinDate, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `keuangan-${activeMonth}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  async function resetAll() {
    setWeeks([newWeek(defaultThursday())]);
    setExpenses([]);
    setJoinDate("");
    try { await window.storage.delete(STORAGE_KEY, false); } catch (e) {}
    setConfirmReset(false);
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ ...raised(18), padding: "18px 26px", color: SUB, fontSize: 13, fontWeight: 600 }}>Memuat data…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', sans-serif", color: INK, padding: "24px 16px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
        input, select { font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar{height:6px;} ::-webkit-scrollbar-thumb{background:${DARK};border-radius:4px;}
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, color: SUB, textTransform: "uppercase", marginBottom: 6 }}>Shift Payroll Ledger</div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 28, margin: 0, lineHeight: 1.15 }}>Kalkulator Gaji &amp; Keuangan</h1>
            <div style={{ color: SUB, fontSize: 14, marginTop: 4 }}>Data tersimpan otomatis di perangkat ini.</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {savedTick && <span style={{ fontSize: 11, color: TEAL, display: "flex", alignItems: "center", gap: 3 }}><CheckCircle2 size={13} /> Tersimpan</span>}
            {saveError && <span style={{ fontSize: 11, color: CORAL }}>Gagal menyimpan</span>}
          </div>
        </div>

        {/* Tier selector */}
        <div style={{ ...flat(18), padding: 6, display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {TIERS.map((t) => (
            <button key={t.id} onClick={() => setTierId(t.id)}
              style={{ flex: "1 1 auto", minWidth: 90, border: "none", cursor: "pointer", padding: "10px 8px", fontSize: 12.5, fontWeight: 600,
                color: tierId === t.id ? TEAL : SUB, ...(tierId === t.id ? pressed(12) : { borderRadius: 12, background: "transparent" }) }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Payday / cutoff card */}
        <div style={{ ...raised(18), padding: "14px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ ...pressed(999), width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BadgeDollarSign size={18} color={TEAL} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 11.5, color: SUB, fontWeight: 600 }}>Periode cut-off berjalan</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtIndoDate(cutoff.start)} – {fmtIndoDate(cutoff.end)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: SUB, fontWeight: 600 }}>Estimasi upah cair</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>{fmtIndoDate(cutoff.payday)}</div>
          </div>
        </div>

        {/* Month selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
          <CalendarDays size={16} color={SUB} style={{ flexShrink: 0 }} />
          {months.map((m) => (
            <button key={m} onClick={() => setActiveMonth(m)}
              style={{ flexShrink: 0, border: "none", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: 600,
                color: activeMonth === m ? TEAL : SUB, ...(activeMonth === m ? pressed(12) : flat(12)) }}>
              {monthLabel(m)}
            </button>
          ))}
        </div>

        {/* Rekap bulanan */}
        {months.length > 1 && (
          <div style={{ ...raised(18), padding: 4, overflowX: "auto", marginBottom: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 560 }}>
              <thead>
                <tr>
                  {["Bulan", "Pendapatan", "Lembur", "Pengeluaran", "Saldo", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 8px", textAlign: h === "Bulan" ? "left" : "right", color: SUB, fontWeight: 700, fontSize: 10, letterSpacing: 0.3 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const s = monthlyStats[m] || { income: 0, lembur: 0, expense: 0, saldo: 0, weeksCount: 0 };
                  const isActive = m === activeMonth;
                  return (
                    <tr key={m} onClick={() => setActiveMonth(m)}
                      style={{ cursor: "pointer", background: isActive ? "rgba(60,140,124,0.10)" : "transparent" }}>
                      <td style={{ padding: "9px 8px", fontWeight: isActive ? 700 : 600, color: isActive ? TEAL : INK }}>
                        {monthLabel(m)}
                        <span style={{ fontSize: 9.5, color: SUB, fontWeight: 500 }}> · {s.weeksCount} mgu</span>
                      </td>
                      <td style={{ padding: "9px 8px", textAlign: "right", ...mono }}>{rupiah(s.income)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", ...mono, color: AMBER }}>{rupiah(s.lembur)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", ...mono, color: CORAL }}>{rupiah(s.expense)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", ...mono, fontWeight: 700, color: s.saldo >= 0 ? TEAL : CORAL }}>{rupiah(s.saldo)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right" }}>{isActive && <span style={{ fontSize: 9.5, color: TEAL, fontWeight: 700 }}>●</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, marginBottom: 18 }}>
          <div style={{ ...raised(20), padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ ...pressed(999), width: 132, height: 132, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={16} color={saldo >= 0 ? TEAL : CORAL} />
              <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: saldo >= 0 ? TEAL : CORAL, marginTop: 4, textAlign: "center", padding: "0 6px" }}>{rupiah(saldo)}</div>
            </div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 10, fontWeight: 600, letterSpacing: 0.5 }}>SALDO {monthLabel(activeMonth).toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <StatRow icon={<TrendingUp size={16} color={TEAL} />} label="Pendapatan" value={rupiah(totalIncome)} color={TEAL} />
            <StatRow icon={<Clock size={16} color={AMBER} />} label="Lembur" value={rupiah(totalLembur)} color={AMBER} />
            <StatRow icon={<TrendingDown size={16} color={CORAL} />} label="Pengeluaran" value={rupiah(totalExpense)} color={CORAL} />
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div style={{ ...raised(20), padding: "18px 12px", marginBottom: 22, height: 180 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 6, paddingLeft: 8, letterSpacing: 0.5 }}>PENDAPATAN PER MINGGU</div>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={chartData}>
                <CartesianGrid stroke={DARK} strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: SUB }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: SUB }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: `4px 4px 10px ${DARK}`, fontSize: 12 }} />
                <Bar dataKey="Pendapatan" fill={TEAL} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weeks */}
        <SectionTitle>Absensi &amp; Lembur Mingguan — {monthLabel(activeMonth)}</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 8 }}>
          {monthWeeks.length === 0 && (
            <div style={{ ...flat(14), padding: "16px", color: SUB, fontSize: 13, textAlign: "center" }}>
              Belum ada minggu tercatat untuk bulan ini.
            </div>
          )}
          {monthWeeks.map((w, wi) => (
            <div key={w.id} style={{ ...raised(18), padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Minggu {wi + 1}</span>
                  <input type="date" value={w.start} onChange={(e) => setWeekStart(w.id, e.target.value)}
                    style={{ ...pressed(10), border: "none", padding: "5px 8px", fontSize: 12, color: INK }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: TEAL }}>{rupiah(w.calc.total)}</span>
                  <button onClick={() => duplicateWeek(w)} title="Duplikat minggu ini" style={{ border: "none", background: "transparent", cursor: "pointer", color: SUB }}><Copy size={14} /></button>
                  {weeks.length > 1 && (
                    <button onClick={() => removeWeek(w.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: CORAL }}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6 }}>
                {w.days.map((d, di) => (
                  <div key={di} style={{ ...flat(12), padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: SUB }}>{DAYS[di]}</div>
                    <select value={d.status} onChange={(e) => updateDay(w.id, di, { status: e.target.value })}
                      style={{ border: "none", fontSize: 9.5, fontWeight: 600, padding: "3px 2px", width: "100%", textAlign: "center",
                        color: d.status === "hadir" ? TEAL : d.status === "izin" || d.status === "alpha" ? CORAL : SUB, ...pressed(8) }}>
                      {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <input type="number" min="0" step="0.5" placeholder="0" value={d.jamBiasa || ""}
                      onChange={(e) => updateDay(w.id, di, { jamBiasa: parseFloat(e.target.value) || 0 })} title="Jam lembur biasa"
                      style={{ ...pressed(8), border: "none", width: "100%", fontSize: 10.5, textAlign: "center", padding: "3px 2px", ...mono }} />
                    <input type="number" min="0" step="0.5" placeholder="0" value={d.jamMerah || ""}
                      onChange={(e) => updateDay(w.id, di, { jamMerah: parseFloat(e.target.value) || 0 })} title="Jam lembur tanggal merah"
                      style={{ ...pressed(8), border: "none", width: "100%", fontSize: 10.5, textAlign: "center", padding: "3px 2px", color: AMBER, ...mono }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: SUB, marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>Pokok: <b style={{ color: INK }}>{rupiah(w.calc.pokok)}</b></span>
                <span>Lembur: <b style={{ color: INK }}>{rupiah(w.calc.lembur)}</b></span>
                <span>Bonus hadir ({w.calc.hariHadir} hari): <b style={{ color: INK }}>{rupiah(w.calc.bonus)}</b></span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addWeek} style={{ ...flat(14), border: "none", cursor: "pointer", padding: "10px 16px", fontSize: 12.5, fontWeight: 600, color: TEAL, display: "flex", alignItems: "center", gap: 6, marginBottom: 26 }}>
          <Plus size={15} /> Tambah Minggu
        </button>

        {/* Expenses */}
        <SectionTitle>Pengeluaran</SectionTitle>
        <div style={{ ...raised(18), padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Keterangan"
              style={{ ...pressed(10), border: "none", padding: "9px 12px", fontSize: 13, flex: "2 1 140px", color: INK }} />
            <select value={expCat} onChange={(e) => setExpCat(e.target.value)}
              style={{ ...pressed(10), border: "none", padding: "9px 8px", fontSize: 12, flex: "1 1 130px", color: INK }}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="Jumlah (Rp)"
              style={{ ...pressed(10), border: "none", padding: "9px 12px", fontSize: 13, flex: "1 1 100px", color: INK, ...mono }} />
            <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)}
              style={{ ...pressed(10), border: "none", padding: "9px 10px", fontSize: 12.5, flex: "1 1 120px", color: INK }} />
            <button onClick={addExpense} style={{ ...flat(10), border: "none", cursor: "pointer", padding: "9px 14px", color: TEAL, display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 13 }}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        {catBreakdown.length > 0 && (
          <div style={{ ...flat(16), padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: SUB, marginBottom: 8, letterSpacing: 0.5 }}>BREAKDOWN KATEGORI</div>
            {catBreakdown.map((c) => (
              <div key={c.id} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                  <span>{c.label}</span>
                  <span style={{ ...mono, fontWeight: 700 }}>{rupiah(c.amount)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: BG, boxShadow: `inset 2px 2px 4px ${DARK}, inset -2px -2px 4px ${LIGHT}`, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (c.amount / totalExpense) * 100)}%`, height: "100%", background: c.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {monthExpenses.length === 0 && <div style={{ color: SUB, fontSize: 13, padding: "10px 4px" }}>Belum ada pengeluaran bulan ini.</div>}
          {monthExpenses.map((e) => {
            const cat = CATEGORIES.find((c) => c.id === e.category);
            return (
              <div key={e.id} style={{ ...flat(14), padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.desc}</div>
                  <div style={{ fontSize: 11, color: SUB, display: "flex", gap: 6, alignItems: "center" }}>
                    {e.date} {cat && <span style={{ color: cat.color, fontWeight: 600 }}>· {cat.label}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: CORAL }}>{rupiah(e.amount)}</span>
                  <button onClick={() => removeExpense(e.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: SUB }}><X size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>

        {/* THR estimator */}
        <SectionTitle>Estimasi THR</SectionTitle>
        <div style={{ ...raised(18), padding: 16, marginBottom: 26 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ ...pressed(999), width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Gift size={16} color={PLUM} />
            </div>
            <label style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>Tanggal masuk kerja</label>
            <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)}
              style={{ ...pressed(10), border: "none", padding: "7px 10px", fontSize: 12.5, color: INK }} />
          </div>
          {thr ? (
            <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.7 }}>
              Masa kerja: <b style={{ color: INK }}>{thr.months} bulan</b><br />
              {thr.eligible
                ? <>Sudah &ge;1 tahun — berhak <b style={{ color: TEAL }}>THR penuh (1x gaji bulanan)</b>.</>
                : <>Belum genap 1 tahun — THR dihitung proporsional (masa kerja ÷ 12).</>}
              <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: PLUM, marginTop: 8 }}>{rupiah(thr.amount)}</div>
              <div style={{ fontSize: 10.5, marginTop: 4 }}>Estimasi dari rata-rata gaji pokok + bonus hadir bulanan: {rupiah(thr.avgMonthly)}/bulan.</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: SUB }}>Isi tanggal masuk kerja untuk melihat estimasi THR.</div>
          )}
        </div>

        {/* Rate reference */}
        <SectionTitle>Referensi Tarif</SectionTitle>
        <div style={{ ...raised(18), padding: 4, overflowX: "auto", marginBottom: 26 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 480 }}>
            <thead>
              <tr>{["Masa Kerja", "Upah Harian", "Bonus Hadir", "Lembur Biasa", "Lembur Merah"].map((h) => (
                <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: SUB, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.3 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t.id} style={{ background: t.id === tierId ? "rgba(60,140,124,0.08)" : "transparent" }}>
                  <td style={{ padding: "8px 8px", fontWeight: 600 }}>{t.label}</td>
                  <td style={{ padding: "8px 8px", ...mono }}>{rupiah(t.harian)}</td>
                  <td style={{ padding: "8px 8px", ...mono }}>{rupiah(t.bonus)}</td>
                  <td style={{ padding: "8px 8px", ...mono }}>{rupiah(t.lemburBiasa)}</td>
                  <td style={{ padding: "8px 8px", ...mono }}>{rupiah(t.lemburMerah)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Data controls */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={exportData} style={{ ...flat(12), border: "none", cursor: "pointer", padding: "9px 16px", fontSize: 12, fontWeight: 600, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> Ekspor Data (JSON)
          </button>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{ ...flat(12), border: "none", cursor: "pointer", padding: "9px 16px", fontSize: 12, fontWeight: 600, color: CORAL, display: "flex", alignItems: "center", gap: 6 }}>
              <RotateCcw size={14} /> Reset Data
            </button>
          ) : (
            <>
              <button onClick={resetAll} style={{ ...pressed(12), border: "none", cursor: "pointer", padding: "9px 16px", fontSize: 12, fontWeight: 700, color: CORAL }}>Ya, hapus semua</button>
              <button onClick={() => setConfirmReset(false)} style={{ ...flat(12), border: "none", cursor: "pointer", padding: "9px 16px", fontSize: 12, fontWeight: 600, color: SUB }}>Batal</button>
            </>
          )}
        </div>

        <div style={{ fontSize: 10.5, color: SUB, marginTop: 20, textAlign: "center" }}>
          Angka lembur dihitung per jam. Bonus hadir dihitung Rp 16.000 × jumlah hari hadir dalam minggu tersebut.
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value, color }) {
  return (
    <div style={{ ...flat(16), padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ ...pressed(999), width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: SUB, fontWeight: 600 }}>{label}</div>
        <div style={{ ...mono, fontSize: 13, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}
function SectionTitle({ children, style }) {
  return <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 10, color: INK, ...style }}>{children}</div>;
}
