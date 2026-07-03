import { useState, useEffect, useMemo } from 'react';
import { expensesApi } from '../services/api';
import type { MonthStat, Expense } from '../types';
import { useCategories } from '../hooks/useCategories';

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const fmt = (n: number) => `${Math.abs(n).toFixed(2)} €`;

/**
 * Praėjusio mėnesio santrauka — rodoma pirmas 7 mėnesio dienas,
 * kol vartotojas jos neuždaro. Būsena saugoma localStorage.
 */
export default function MonthCloseReport() {
  const { metaFor } = useCategories();
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const storageKey = `month-report-dismissed-${prevYm}`;

  const eligible = now.getDate() <= 7;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === '1');
  const [stats, setStats] = useState<MonthStat[] | null>(null);
  const [prevExpenses, setPrevExpenses] = useState<Expense[] | null>(null);

  useEffect(() => {
    if (!eligible || dismissed) return;
    expensesApi.getStats(7).then(r => setStats(r.months)).catch(() => {});
    expensesApi.getExpenses(prev.getMonth() + 1, prev.getFullYear())
      .then(r => setPrevExpenses(r.expenses)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, dismissed]);

  const report = useMemo(() => {
    if (!stats || !prevExpenses) return null;
    const prevStat = stats.find(m => m.ym === prevYm);
    if (!prevStat || prevStat.total <= 0) return null;

    // Vidurkis iš ankstesnių mėnesių (be praėjusio ir be dabartinio)
    const earlier = stats.filter(m => m.ym !== prevYm && m.ym < prevYm && m.total > 0);
    const avg = earlier.length > 0 ? earlier.reduce((s, m) => s + m.total, 0) / earlier.length : null;
    const deltaVsAvg = avg != null && avg > 0 ? ((prevStat.total - avg) / avg) * 100 : null;

    // Top kategorija
    const topEntry = Object.entries(prevStat.byCategory).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];

    // Savaitės (1-7, 8-14, 15-21, 22-pab.)
    const weekSums = [0, 0, 0, 0];
    for (const e of prevExpenses) {
      const day = new Date(e.date).getDate();
      weekSums[Math.min(3, Math.floor((day - 1) / 7))] += e.amount;
    }
    let best = 0, worst = 0;
    weekSums.forEach((v, i) => {
      if (v < weekSums[best]) best = i;
      if (v > weekSums[worst]) worst = i;
    });

    return {
      total: prevStat.total,
      count: prevExpenses.length,
      deltaVsAvg,
      top: topEntry ? { cat: topEntry[0], total: topEntry[1] ?? 0 } : null,
      bestWeek: { idx: best, total: weekSums[best] },
      worstWeek: { idx: worst, total: weekSums[worst] },
    };
  }, [stats, prevExpenses, prevYm]);

  if (!eligible || dismissed || !report) return null;

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  const weekLabel = (i: number) => ['1–7', '8–14', '15–21', '22+'][i];

  return (
    <div className="x-card" style={{ background: 'var(--x-grad-warm)', color: 'var(--x-grad-warm-ink)', border: 'none', position: 'relative' }}>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(13,31,58,.08)', border: 0, borderRadius: 8, width: 26, height: 26, cursor: 'pointer', color: 'var(--x-grad-warm-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>

      <div style={{ fontSize: 11.5, opacity: .7, textTransform: 'uppercase', letterSpacing: .6, fontWeight: 600, marginBottom: 4 }}>
        ✨ {MONTHS[prev.getMonth()]} in review
      </div>
      <div className="x-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1 }}>
        {fmt(report.total)}
        <span style={{ fontSize: 13, fontWeight: 400, opacity: .7 }}> · {report.count} expenses</span>
      </div>

      <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap', fontSize: 12.5, lineHeight: 1.6 }}>
        {report.deltaVsAvg != null && (
          <div>
            <div style={{ opacity: .6, fontSize: 11 }}>vs your average</div>
            <div style={{ fontWeight: 600 }}>
              {report.deltaVsAvg <= 0 ? '↓' : '↑'} {Math.abs(report.deltaVsAvg).toFixed(0)}%
              {report.deltaVsAvg <= 0 ? ' — well done!' : ''}
            </div>
          </div>
        )}
        {report.top && (
          <div>
            <div style={{ opacity: .6, fontSize: 11 }}>Top category</div>
            <div style={{ fontWeight: 600 }}>{metaFor(report.top.cat).emoji} {metaFor(report.top.cat).label} · {fmt(report.top.total)}</div>
          </div>
        )}
        <div>
          <div style={{ opacity: .6, fontSize: 11 }}>Cheapest week</div>
          <div style={{ fontWeight: 600 }}>days {weekLabel(report.bestWeek.idx)} · {fmt(report.bestWeek.total)}</div>
        </div>
        <div>
          <div style={{ opacity: .6, fontSize: 11 }}>Priciest week</div>
          <div style={{ fontWeight: 600 }}>days {weekLabel(report.worstWeek.idx)} · {fmt(report.worstWeek.total)}</div>
        </div>
      </div>
    </div>
  );
}
