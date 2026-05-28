import { useState } from "react";

const MS_PER_HOUR = 3600000;
const MAX_OUT_MS = 2 * MS_PER_HOUR;

function fmt(ms) {
  if (!ms || ms <= 0) return "—";
  const h = Math.floor(ms / MS_PER_HOUR);
  const m = Math.floor((ms % MS_PER_HOUR) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function dayKeyOf(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function buildDayRange(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKeyOf(d));
  }
  return days;
}

export default function Analytics({ state }) {
  const [period, setPeriod] = useState("7");

  const topTotals = state.dailyTotals || {};
  const bottomTotals = state.bottomDailyTotals || {};
  const removals = state.dailyRemovals || {};

  // Build period days
  const allTopDays = Object.keys(topTotals).sort();
  let periodDays;
  if (period === "7") {
    periodDays = buildDayRange(7);
  } else if (period === "30") {
    periodDays = buildDayRange(30);
  } else {
    if (!allTopDays.length) {
      periodDays = buildDayRange(7);
    } else {
      const start = new Date(allTopDays[0]);
      const today = new Date();
      const days = [];
      const cur = new Date(start);
      while (cur <= today) {
        days.push(dayKeyOf(cur));
        cur.setDate(cur.getDate() + 1);
      }
      periodDays = days;
    }
  }

  // Days in period that have top tray data
  const topRows = periodDays
    .filter(d => topTotals[d] !== undefined)
    .map(d => ({ date: d, out: topTotals[d], removals: removals[d] || 0 }));

  // Days in period that have bottom tray data
  const bottomRows = periodDays
    .filter(d => bottomTotals[d] !== undefined)
    .map(d => ({ date: d, inn: bottomTotals[d] }));

  const hasData = topRows.length > 0;

  // Top tray stats
  const avgOut = mean(topRows.map(r => r.out));
  const compliantCount = topRows.filter(r => r.out <= MAX_OUT_MS).length;
  const compliance = topRows.length ? Math.round((compliantCount / topRows.length) * 100) : null;
  const avgRemovals = topRows.length ? mean(topRows.map(r => r.removals)) : 0;

  // Trend: first half avg vs second half avg (needs ≥4 recorded days)
  const half = Math.floor(topRows.length / 2);
  const trendFirst = half >= 2 ? mean(topRows.slice(0, half).map(r => r.out)) : null;
  const trendSecond = half >= 2 ? mean(topRows.slice(half).map(r => r.out)) : null;
  const trendDelta = trendFirst && trendSecond ? trendSecond - trendFirst : null;

  // Bottom tray stats
  const avgBottomIn = bottomRows.length ? mean(bottomRows.map(r => r.inn)) : null;

  // Chart: bucket by day (≤30) or by week (>30)
  const useWeekly = periodDays.length > 30;
  let chartBuckets;
  if (useWeekly) {
    const weeks = [];
    for (let i = 0; i < periodDays.length; i += 7) {
      const slice = periodDays.slice(i, i + 7);
      const vals = slice.map(d => topTotals[d]).filter(v => v !== undefined);
      if (vals.length) {
        const weekStart = slice[0].slice(5).replace("-", "/");
        weeks.push({ label: weekStart, value: mean(vals), over: mean(vals) > MAX_OUT_MS });
      }
    }
    chartBuckets = weeks;
  } else {
    chartBuckets = periodDays.map(d => ({
      label: d.slice(8), // day number
      value: topTotals[d] ?? 0,
      noData: topTotals[d] === undefined,
      over: (topTotals[d] ?? 0) > MAX_OUT_MS,
    }));
  }

  const chartMax = Math.max(...chartBuckets.map(b => b.value), MAX_OUT_MS, 1);
  const VW = 300;
  const VH = 56;
  const n = chartBuckets.length;
  const gap = n > 20 ? 1 : 2;
  const bw = Math.max(2, (VW - (n - 1) * gap) / n);
  const limitY = (1 - MAX_OUT_MS / chartMax) * VH;

  return (
    <div style={s.content}>

      {/* Period picker */}
      <div style={s.pills}>
        {[["7", "7 days"], ["30", "30 days"], ["all", "All time"]].map(([v, label]) => (
          <button
            key={v}
            style={period === v ? { ...s.pill, ...s.pillActive } : s.pill}
            onClick={() => setPeriod(v)}
          >
            {label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <div style={s.empty}>No data recorded in this period yet.</div>
      ) : (
        <>
          {/* Top tray */}
          <p style={s.sectionLabel}>Top tray</p>
          <div style={s.grid}>
            <StatCard
              label="Avg time out / day"
              value={fmt(avgOut)}
              sub={avgOut <= MAX_OUT_MS ? "within 2h limit ✓" : "over 2h limit"}
              subOk={avgOut <= MAX_OUT_MS}
            />
            <StatCard
              label="Compliance"
              value={`${compliance}%`}
              sub={`${compliantCount} of ${topRows.length} days`}
              subOk={compliance >= 80}
            />
            <StatCard
              label="Avg removals / day"
              value={avgRemovals > 0 ? avgRemovals.toFixed(1) + "×" : "—"}
              sub="times tray came out"
            />
            {trendDelta !== null && (
              <StatCard
                label="Trend"
                value={trendDelta < -60000 ? "Improving" : trendDelta > 60000 ? "Slipping" : "Steady"}
                valueColor={trendDelta < -60000 ? "#5ce0a0" : trendDelta > 60000 ? "#f06868" : "#e8edf5"}
                sub={trendDelta < -60000
                  ? `${fmt(Math.abs(trendDelta))} less out recently`
                  : trendDelta > 60000
                  ? `${fmt(trendDelta)} more out recently`
                  : "no significant change"}
              />
            )}
          </div>

          {/* Sparkline */}
          {chartBuckets.length > 1 && (
            <div style={s.chartCard}>
              <div style={s.chartHeader}>
                <span style={s.chartTitle}>Time out {useWeekly ? "(weekly avg)" : "per day"}</span>
                <span style={s.chartSub}>
                  <span style={{ color: "#f06868" }}>— </span>2h limit
                </span>
              </div>
              <svg
                viewBox={`0 0 ${VW} ${VH + 2}`}
                style={{ width: "100%", height: "auto", display: "block", marginTop: 8 }}
                preserveAspectRatio="none"
              >
                <line x1={0} y1={limitY} x2={VW} y2={limitY} stroke="#f06868" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.6" />
                {chartBuckets.map((b, i) => {
                  const h = b.value > 0 ? Math.max((b.value / chartMax) * VH, 1.5) : 0;
                  const x = i * (bw + gap);
                  return (
                    <rect
                      key={i}
                      x={x} y={VH - h}
                      width={bw} height={h}
                      fill={b.noData ? "#1e2535" : b.over ? "#f06868" : "#3a8f8a"}
                      opacity={b.noData ? 0.3 : 1}
                      rx="0.5"
                    />
                  );
                })}
              </svg>
              <div style={s.chartFooter}>
                <span style={s.chartFooterLabel}>
                  {useWeekly ? chartBuckets[0]?.label : periodDays[0]?.slice(5)}
                </span>
                <span style={s.chartFooterLabel}>today</span>
              </div>
            </div>
          )}

          {/* Bottom tray */}
          {avgBottomIn !== null && (
            <>
              <p style={s.sectionLabel}>Bottom tray</p>
              <div style={s.grid}>
                <StatCard
                  label="Avg wear time / day"
                  value={fmt(avgBottomIn)}
                  sub={`${bottomRows.length} days tracked`}
                />
                <StatCard
                  label="Days tracked"
                  value={String(bottomRows.length)}
                  sub="with bottom tray data"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, subOk, valueColor }) {
  return (
    <div style={s.card}>
      <span style={s.cardLabel}>{label}</span>
      <span style={{ ...s.cardValue, ...(valueColor ? { color: valueColor } : {}) }}>{value}</span>
      {sub && (
        <span style={{
          ...s.cardSub,
          ...(subOk === true ? { color: "#5ce0a0" } : subOk === false ? { color: "#f06868" } : {}),
        }}>
          {sub}
        </span>
      )}
    </div>
  );
}

const s = {
  content: { padding: "16px 20px 32px" },

  pills: { display: "flex", gap: 8, marginBottom: 22 },
  pill: {
    flex: 1, padding: "8px 0", borderRadius: 10,
    border: "1px solid #1e2535", background: "transparent",
    color: "#6b7a94", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
  },
  pillActive: {
    background: "#161b24", color: "#5ce0d8",
    borderColor: "rgba(92,224,216,0.25)",
  },

  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "#6b7a94",
    textTransform: "uppercase", letterSpacing: "0.07em",
    margin: "0 0 10px",
  },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },

  card: {
    background: "#161b24", borderRadius: 14, padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 3,
  },
  cardLabel: { fontSize: 11, color: "#6b7a94", fontWeight: 500 },
  cardValue: { fontSize: 22, fontWeight: 800, color: "#e8edf5", letterSpacing: "-0.02em", lineHeight: 1.1 },
  cardSub: { fontSize: 11, color: "#6b7a94", marginTop: 1 },

  chartCard: {
    background: "#161b24", borderRadius: 16, padding: "16px 16px 12px",
    marginBottom: 22,
  },
  chartHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  chartTitle: { fontSize: 13, fontWeight: 700 },
  chartSub: { fontSize: 11, color: "#6b7a94" },
  chartFooter: { display: "flex", justifyContent: "space-between", marginTop: 6 },
  chartFooterLabel: { fontSize: 10, color: "#6b7a94" },

  empty: { textAlign: "center", color: "#6b7a94", fontSize: 14, padding: "48px 0" },
};
