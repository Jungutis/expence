import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { expensesApi } from '../services/api';
import type { MonthStat } from '../types';
import { useCategories } from '../hooks/useCategories';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt      = (n: number) => `${Math.abs(n).toFixed(2)} €`;
const fmtShort = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k €` : `${Math.round(n)} €`;

// ── Monthly bar chart ──────────────────────────────────
function MonthBars({ months, height = 160 }: { months: MonthStat[]; height?: number }) {
  const max = Math.max(1, ...months.map(m => m.total));
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: height + 34, width: '100%' }}>
      {months.map(m => {
        const h = m.total === 0 ? 3 : Math.max(6, (m.total / max) * height);
        const isCurrent = m.ym === currentYm;
        return (
          <div key={m.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            title={`${MONTHS_SHORT[m.month - 1]} ${m.year}: ${fmt(m.total)}`}>
            <div className="x-mono" style={{ fontSize: 10.5, color: isCurrent ? 'var(--x-ink)' : 'var(--x-mid)', fontWeight: isCurrent ? 600 : 400 }}>
              {m.total > 0 ? fmtShort(m.total) : ''}
            </div>
            <div style={{
              width: '100%', maxWidth: 52, height: h, borderRadius: 6,
              background: isCurrent ? 'var(--x-warm)' : 'var(--x-paper-2)',
              transition: 'height .4s ease',
            }} />
            <div style={{ fontSize: 11, color: isCurrent ? 'var(--x-ink)' : 'var(--x-mid)', fontWeight: isCurrent ? 600 : 400 }}>
              {MONTHS_SHORT[m.month - 1]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────
export default function Stats() {
  const { user } = useAuth();
  const { metaFor } = useCategories();
  const [months, setMonths]   = useState<MonthStat[]>([]);
  const [range, setRange]     = useState<6 | 12>(6);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true); setError('');
    expensesApi.getStats(range)
      .then(r => setMonths(r.months))
      .catch(() => setError('Failed to load statistics'))
      .finally(() => setLoading(false));
  }, [user, range]);

  const current  = months[months.length - 1];
  const previous = months[months.length - 2];

  const derived = useMemo(() => {
    if (months.length === 0) return null;
    const nonEmpty = months.filter(m => m.total > 0);
    const avg = nonEmpty.length > 0 ? nonEmpty.reduce((s, m) => s + m.total, 0) / nonEmpty.length : 0;
    const biggest = months.reduce((a, b) => (b.total > a.total ? b : a), months[0]);
    const totalAll = months.reduce((s, m) => s + m.total, 0);
    const delta = previous && previous.total > 0 && current
      ? ((current.total - previous.total) / previous.total) * 100
      : null;
    return { avg, biggest, totalAll, delta };
  }, [months, current, previous]);

  // Category totals over whole range, for the breakdown card
  const catTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const m of months) {
      for (const [c, v] of Object.entries(m.byCategory)) {
        if ((v ?? 0) > 0) acc[c] = (acc[c] ?? 0) + (v ?? 0);
      }
    }
    return Object.entries(acc)
      .map(([cat, total]) => ({ cat, total }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [months]);

  const rangeTotal = derived?.totalAll ?? 0;

  if (!user) return null;

  return (
    <div style={{ padding: 'var(--pulse-pad, 24px)', maxWidth: 1080, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, letterSpacing: -0.2 }}>Statistics</h1>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--x-mid)', marginTop: 1 }}>
            Last {range} months
          </p>
        </div>
        <div style={{ flex: 1 }} />

        {/* Range switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--x-bg)', border: '1px solid var(--x-hair)', borderRadius: 11, padding: 4, gap: 2 }}>
          {([6, 12] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{
                background: range === r ? 'var(--x-paper-2)' : 'transparent',
                border: 0, cursor: 'pointer', borderRadius: 8, padding: '8px 14px',
                fontSize: 13, fontWeight: range === r ? 600 : 400,
                color: range === r ? 'var(--x-ink)' : 'var(--x-mid)', fontFamily: 'inherit',
              }}>
              {r}M
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--x-hair)', borderTopColor: 'var(--x-accent)', animation: 'spin .7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : error ? (
        <div className="x-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--x-neg)' }}>{error}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pulse-gap, 14px)' }} className="anim-up">

          {/* ── Summary cards ── */}
          <div className="pulse-row-3">
            <div className="x-card" style={{ background: 'var(--x-grad-warm)', color: 'var(--x-grad-warm-ink)', border: 'none' }}>
              <div style={{ fontSize: 11.5, opacity: .7, textTransform: 'uppercase', letterSpacing: .6, fontWeight: 600, marginBottom: 6 }}>
                This month
              </div>
              <div className="x-num" style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>
                {fmt(current?.total ?? 0)}
              </div>
              {derived?.delta != null && (
                <div style={{ fontSize: 12.5, marginTop: 12, opacity: .85 }}>
                  {derived.delta <= 0 ? '↓' : '↑'} {Math.abs(derived.delta).toFixed(0)}% vs {previous ? MONTHS_SHORT[previous.month - 1] : 'last month'}
                  {derived.delta <= 0 ? ' — nice!' : ''}
                </div>
              )}
            </div>

            <div className="x-card">
              <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 6 }}>
                Monthly average
              </div>
              <div className="x-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>
                {fmt(derived?.avg ?? 0)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 12 }}>
                Across months with spending
              </div>
            </div>

            <div className="x-card">
              <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 6 }}>
                Biggest month
              </div>
              <div className="x-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>
                {fmt(derived?.biggest.total ?? 0)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 12 }}>
                {derived ? `${MONTHS_SHORT[derived.biggest.month - 1]} ${derived.biggest.year}` : '—'}
              </div>
            </div>
          </div>

          {/* ── Monthly chart ── */}
          <div className="x-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, gap: 10 }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>Spending by month</div>
                <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 2 }}>
                  Total <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmt(rangeTotal)}</span> over {range} months
                </div>
              </div>
            </div>
            <MonthBars months={months} height={160} />
          </div>

          {/* ── Category breakdown + month comparison ── */}
          <div className="pulse-row-2">
            <div className="x-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>Categories · {range} months</div>
                <div style={{ fontSize: 12, color: 'var(--x-mid)' }}>{catTotals.length} active</div>
              </div>
              {catTotals.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--x-mid)', fontSize: 13 }}>No data yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {catTotals.map(({ cat, total }) => {
                    const meta = metaFor(cat);
                    const pct  = rangeTotal > 0 ? (total / rangeTotal) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 4, background: meta.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--x-ink-2)' }}>{meta.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span className="x-mono" style={{ fontSize: 12.5, fontWeight: 500 }}>−{fmt(total)}</span>
                            <span className="x-mono" style={{ fontSize: 11, color: 'var(--x-mid)', minWidth: 30, textAlign: 'right' }}>{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 6, background: meta.soft, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: meta.dot, borderRadius: 3, transition: 'width .5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* This vs last month per category */}
            <div className="x-card">
              <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 14 }}>
                This month vs {previous ? MONTHS_SHORT[previous.month - 1] : 'last'}
              </div>
              {!current || !previous ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--x-mid)', fontSize: 13 }}>Not enough data</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Array.from(new Set([...Object.keys(current.byCategory), ...Object.keys(previous.byCategory)]))
                    .map(c => ({
                      cat: c,
                      cur: current.byCategory[c] ?? 0,
                      prev: previous.byCategory[c] ?? 0,
                    }))
                    .filter(x => x.cur > 0 || x.prev > 0)
                    .sort((a, b) => b.cur - a.cur)
                    .map(({ cat, cur, prev }) => {
                      const meta = metaFor(cat);
                      const diff = cur - prev;
                      const up   = diff > 0;
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 15 }}>{meta.emoji}</span>
                          <span style={{ fontSize: 13, color: 'var(--x-ink-2)', flex: 1, minWidth: 0 }}>{meta.label}</span>
                          <span className="x-mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{fmt(cur)}</span>
                          <span className="x-mono" style={{
                            fontSize: 11.5, fontWeight: 600, minWidth: 64, textAlign: 'right',
                            color: Math.abs(diff) < 0.005 ? 'var(--x-mid)' : up ? 'var(--x-neg)' : 'var(--x-pos)',
                          }}>
                            {Math.abs(diff) < 0.005 ? '—' : `${up ? '+' : '−'}${fmt(diff)}`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
