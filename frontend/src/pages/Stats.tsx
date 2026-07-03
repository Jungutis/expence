import { useState, useEffect, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { expensesApi, profileApi, budgetsApi } from '../services/api';
import type { MonthStat, UserProfile, Budget, Expense } from '../types';
import { useCategories } from '../hooks/useCategories';
import CalendarHeatmap from '../components/CalendarHeatmap';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYPARTS = ['Morning 6–11', 'Day 11–17', 'Evening 17–22', 'Night 22–6'];

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
  const now = new Date();

  const [allMonths, setAllMonths]   = useState<MonthStat[]>([]);
  const [timeHeatmap, setTimeHeatmap] = useState<number[][]>([]);
  const [profile, setProfile]       = useState<UserProfile | null>(null);
  const [budgets, setBudgets]       = useState<Budget[]>([]);
  const [curExpenses, setCurExpenses] = useState<Expense[]>([]);
  const [subs, setSubs]       = useState<{
    note: string; category: string; monthlyCost: number; months: number; yearlyCost: number;
    priceChange: { from: number; to: number } | null;
  }[]>([]);
  const [inflation, setInflation] = useState<{
    overallPct: number | null; comparable: number;
    items: { note: string; oldPrice: number; newPrice: number; pct: number }[];
  } | null>(null);
  const [range, setRange]     = useState<6 | 12>(6);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [whatIf, setWhatIf]   = useState<Record<string, number>>({}); // kategorija → sumažinimo %

  useEffect(() => {
    if (!user) return;
    setLoading(true); setError('');
    // Visada imam 13 mėn. — YoY palyginimui ir vidurkiams; grafike rodom pasirinktą rėžį
    Promise.all([
      expensesApi.getStats(13),
      profileApi.getProfile().catch(() => null),
      budgetsApi.list().catch(() => ({ budgets: [] as Budget[] })),
      expensesApi.getExpenses(now.getMonth() + 1, now.getFullYear()).catch(() => ({ expenses: [] as Expense[] })),
      expensesApi.getSubscriptions().catch(() => ({ subscriptions: [] })),
      expensesApi.getInflation().catch(() => null),
    ])
      .then(([stats, prof, budg, cur, subsR, infl]) => {
        setAllMonths(stats.months);
        setTimeHeatmap(stats.timeHeatmap ?? []);
        setProfile(prof);
        setBudgets(budg.budgets);
        setCurExpenses(cur.expenses);
        setSubs(subsR.subscriptions);
        setInflation(infl);
      })
      .catch(() => setError('Failed to load statistics'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const months   = useMemo(() => allMonths.slice(-range), [allMonths, range]);
  const current  = allMonths[allMonths.length - 1];
  const previous = allMonths[allMonths.length - 2];

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

  // ── Prognozė su rėžiu (pagal šio mėnesio dienų svyravimą) ──
  const forecast = useMemo(() => {
    if (curExpenses.length === 0) return null;
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (today >= daysInMonth) return null;
    const daily = Array.from({ length: today }, () => 0);
    let spent = 0;
    for (const e of curExpenses) {
      const d = new Date(e.date).getDate();
      if (d <= today) daily[d - 1] += e.amount;
      spent += e.amount;
    }
    const mean = daily.reduce((s, v) => s + v, 0) / today;
    const variance = daily.reduce((s, v) => s + (v - mean) ** 2, 0) / today;
    const std = Math.sqrt(variance);
    const remaining = daysInMonth - today;
    return {
      spent,
      mid: spent + mean * remaining,
      low: spent + Math.max(0, mean - std * 0.6) * remaining,
      high: spent + (mean + std * 0.6) * remaining,
      daysLeft: remaining,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curExpenses]);

  // ── Anomalijos: kategorija smarkiai virš savo vidurkio ──
  const anomalies = useMemo(() => {
    if (!current || allMonths.length < 3) return [];
    const prior = allMonths.slice(0, -1);
    const out: { cat: string; cur: number; avg: number; pct: number }[] = [];
    for (const [cat, curVal] of Object.entries(current.byCategory)) {
      const cur = curVal ?? 0;
      const vals = prior.map(m => m.byCategory[cat] ?? 0).filter(v => v > 0);
      if (vals.length < 2 || cur <= 0) continue;
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      if (avg > 0 && cur > avg * 1.5 && cur - avg > 10) {
        out.push({ cat, cur, avg, pct: ((cur - avg) / avg) * 100 });
      }
    }
    return out.sort((a, b) => b.pct - a.pct).slice(0, 3);
  }, [current, allMonths]);

  // ── Metai prieš metus: šis mėnuo vs tas pats mėnuo pernai ──
  const yoy = useMemo(() => {
    if (!current || allMonths.length < 13) return null;
    const lastYear = allMonths.find(m => m.month === current.month && m.year === current.year - 1);
    if (!lastYear || lastYear.total <= 0) return null;
    return {
      lastYear,
      pct: ((current.total - lastYear.total) / lastYear.total) * 100,
    };
  }, [current, allMonths]);

  // ── Sutaupymo norma per mėnesius (be dabartinio — jis nebaigtas) ──
  const savingsRates = useMemo(() => {
    const salary = profile?.salary ?? 0;
    if (salary <= 0) return null;
    const closed = allMonths.slice(-13, -1).filter(m => m.total > 0);
    if (closed.length === 0) return null;
    return closed.map(m => ({
      ym: m.ym, month: m.month,
      rate: ((salary - m.total) / salary) * 100,
    }));
  }, [allMonths, profile]);

  // ── Biudžeto disciplina: kiek mėnesių tilpo į limitą ──
  const discipline = useMemo(() => {
    const catBudgets = budgets.filter(b => b.category !== 'TOTAL' && b.amount > 0);
    if (catBudgets.length === 0) return [];
    const closed = allMonths.slice(0, -1).filter(m => m.total > 0);
    if (closed.length === 0) return [];
    return catBudgets.map(b => {
      const hit = closed.filter(m => (m.byCategory[b.category] ?? 0) <= b.amount).length;
      return { cat: b.category, limit: b.amount, hit, of: closed.length };
    }).sort((a, b) => (b.hit / b.of) - (a.hit / a.of));
  }, [budgets, allMonths]);

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
  const heatMax = useMemo(() => Math.max(1, ...timeHeatmap.flat()), [timeHeatmap]);

  // ── „Kas būtų, jei" — top kategorijų mėnesio vidurkiai simuliatoriui ──
  const whatIfCats = useMemo(() => {
    const closed = allMonths.slice(0, -1).filter(m => m.total > 0);
    if (closed.length === 0) return [];
    const acc: Record<string, number> = {};
    for (const m of closed) {
      for (const [c, v] of Object.entries(m.byCategory)) {
        if ((v ?? 0) > 0) acc[c] = (acc[c] ?? 0) + (v ?? 0);
      }
    }
    return Object.entries(acc)
      .map(([cat, total]) => ({ cat, avgMonthly: total / closed.length }))
      .sort((a, b) => b.avgMonthly - a.avgMonthly)
      .slice(0, 4);
  }, [allMonths]);

  const whatIfYearly = useMemo(
    () => whatIfCats.reduce((s, c) => s + c.avgMonthly * ((whatIf[c.cat] ?? 0) / 100) * 12, 0),
    [whatIfCats, whatIf],
  );

  // ── Atsargų fondas: tikslas = 3–6 mėn. faktinių išlaidų vidurkio ──
  const emergency = useMemo(() => {
    const savings = profile?.savings ?? null;
    const closed = allMonths.slice(0, -1).filter(m => m.total > 0);
    if (savings == null || closed.length === 0) return null;
    const avg = closed.reduce((s, m) => s + m.total, 0) / closed.length;
    if (avg <= 0) return null;
    return {
      savings,
      avg,
      target3: avg * 3,
      target6: avg * 6,
      runway: savings / avg,
      pct6: Math.min(100, (savings / (avg * 6)) * 100),
    };
  }, [profile, allMonths]);

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

        <Link to="/report" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--x-bg)', border: '1px solid var(--x-hair)', borderRadius: 11,
          padding: '10px 14px', color: 'var(--x-ink-2)', fontSize: 12.5, fontWeight: 500,
          textDecoration: 'none',
        }}>
          🖨 Report
        </Link>

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
              <div style={{ fontSize: 12.5, marginTop: 12, opacity: .85, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {derived?.delta != null && (
                  <span>
                    {derived.delta <= 0 ? '↓' : '↑'} {Math.abs(derived.delta).toFixed(0)}% vs {previous ? MONTHS_SHORT[previous.month - 1] : 'last month'}
                    {derived.delta <= 0 ? ' — nice!' : ''}
                  </span>
                )}
                {yoy && (
                  <span>
                    {yoy.pct <= 0 ? '↓' : '↑'} {Math.abs(yoy.pct).toFixed(0)}% vs {MONTHS_SHORT[yoy.lastYear.month - 1]} {yoy.lastYear.year} ({fmt(yoy.lastYear.total)})
                  </span>
                )}
              </div>
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

            {forecast ? (
              <div className="x-card">
                <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 6 }}>
                  Month-end forecast
                </div>
                <div className="x-num" style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1, marginTop: 4 }}>
                  {fmtShort(forecast.low)}–{fmtShort(forecast.high)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 10 }}>
                  Most likely ~<span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmtShort(forecast.mid)}</span> · {forecast.daysLeft} days left
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--x-mid-2)', marginTop: 3 }}>
                  Range reflects your daily variance
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* ── Anomalies ── */}
          {anomalies.length > 0 && (
            <div className="x-card" style={{ borderColor: 'rgba(193,75,58,.25)' }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 12 }}>
                ⚡ Unusual this month
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {anomalies.map(a => (
                  <div key={a.cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15 }}>{metaFor(a.cat).emoji}</span>
                    <span style={{ fontSize: 13, color: 'var(--x-ink-2)', flex: 1 }}>{metaFor(a.cat).label}</span>
                    <span className="x-mono" style={{ fontSize: 12.5 }}>{fmt(a.cur)}</span>
                    <span className="x-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--x-neg)' }}>
                      +{a.pct.toFixed(0)}% vs avg {fmtShort(a.avg)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* ── Time heatmap + calendar ── */}
          <div className="pulse-row-2">
            <div className="x-card">
              <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>When you spend</div>
              <div style={{ fontSize: 12, color: 'var(--x-mid)', marginBottom: 14 }}>Last 13 months · darker = more spent</div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 4, alignItems: 'center' }}>
                <div />
                {DOW.map(d => (
                  <div key={d} style={{ fontSize: 10, color: 'var(--x-mid-2)', textAlign: 'center', textTransform: 'uppercase' }}>{d}</div>
                ))}
                {DAYPARTS.map((part, pi) => (
                  <Fragment key={part}>
                    <div style={{ fontSize: 10.5, color: 'var(--x-mid)', whiteSpace: 'nowrap' }}>{part}</div>
                    {DOW.map((_, di) => {
                      const v = timeHeatmap[di]?.[pi] ?? 0;
                      const a = v > 0 ? 0.12 + 0.78 * (v / heatMax) : 0;
                      return (
                        <div key={`${pi}-${di}`}
                          title={`${DOW[di]} · ${part}: ${fmt(v)}`}
                          style={{
                            height: 30, borderRadius: 6,
                            background: v > 0 ? `rgba(74,106,138,${a})` : 'var(--x-paper)',
                            border: '1px solid var(--x-hair)',
                          }} />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <CalendarHeatmap />
          </div>

          {/* ── Savings rate + discipline ── */}
          {(savingsRates || discipline.length > 0) && (
            <div className="pulse-row-2">
              {savingsRates ? (
                <div className="x-card">
                  <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>Savings rate</div>
                  <div style={{ fontSize: 12, color: 'var(--x-mid)', marginBottom: 14 }}>
                    (income − spending) ÷ income · target 20%
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, position: 'relative' }}>
                    {/* Target line at 20% (skalė 0–60%) */}
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(20 / 60) * 100}%`, borderTop: '1.5px dashed var(--x-hair-2)' }} />
                    {savingsRates.map(s => {
                      const clamped = Math.max(0, Math.min(60, s.rate));
                      const neg = s.rate < 0;
                      return (
                        <div key={s.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
                          title={`${MONTHS_SHORT[s.month - 1]}: ${s.rate.toFixed(0)}%`}>
                          <span className="x-mono" style={{ fontSize: 9.5, color: neg ? 'var(--x-neg)' : s.rate >= 20 ? 'var(--x-pos)' : 'var(--x-mid)', fontWeight: 600 }}>
                            {s.rate.toFixed(0)}%
                          </span>
                          <div style={{
                            width: '100%', maxWidth: 40,
                            height: `${Math.max(3, (clamped / 60) * 100)}%`,
                            borderRadius: 5,
                            background: neg ? 'var(--x-neg)' : s.rate >= 20 ? 'var(--x-pos)' : 'var(--x-paper-2)',
                            opacity: neg ? .8 : 1,
                          }} />
                          <span style={{ fontSize: 10, color: 'var(--x-mid)' }}>{MONTHS_SHORT[s.month - 1]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <div />}

              {discipline.length > 0 && (
                <div className="x-card">
                  <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>Budget discipline</div>
                  <div style={{ fontSize: 12, color: 'var(--x-mid)', marginBottom: 14 }}>
                    Months within the limit (closed months only)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {discipline.map(d => {
                      const rate = d.of > 0 ? d.hit / d.of : 0;
                      return (
                        <div key={d.cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <span style={{ fontSize: 13, color: 'var(--x-ink-2)' }}>
                              {metaFor(d.cat).emoji} {metaFor(d.cat).label}
                              <span style={{ fontSize: 11, color: 'var(--x-mid)' }}> · limit {fmtShort(d.limit)}</span>
                            </span>
                            <span className="x-mono" style={{ fontSize: 12, fontWeight: 600, color: rate >= 0.8 ? 'var(--x-pos)' : rate >= 0.5 ? 'var(--x-ink-2)' : 'var(--x-neg)' }}>
                              {d.hit}/{d.of}
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'var(--x-paper-2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rate * 100}%`, borderRadius: 3, background: rate >= 0.8 ? 'var(--x-pos)' : rate >= 0.5 ? 'var(--x-accent)' : 'var(--x-neg)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Emergency fund + personal inflation ── */}
          {(emergency || (inflation && inflation.overallPct != null)) && (
            <div className="pulse-row-2">
              {emergency && (
                <div className="x-card">
                  <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>🛟 Emergency fund</div>
                  <div style={{ fontSize: 12, color: 'var(--x-mid)', marginBottom: 14 }}>
                    Target: 3–6 months of your real spending ({fmtShort(emergency.avg)}/mo)
                  </div>
                  <div className="x-num" style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.6 }}>
                    {fmt(emergency.savings)}
                    <span style={{ fontSize: 13, color: emergency.runway >= 3 ? 'var(--x-pos)' : 'var(--x-neg)', fontWeight: 600 }}>
                      {' '}· {emergency.runway.toFixed(1)} mo runway
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 10, background: 'var(--x-paper-2)', borderRadius: 5, marginTop: 14, overflow: 'visible' }}>
                    <div style={{ height: '100%', width: `${emergency.pct6}%`, borderRadius: 5, background: emergency.runway >= 6 ? 'var(--x-pos)' : emergency.runway >= 3 ? 'var(--x-accent)' : 'var(--x-neg)', transition: 'width .5s ease' }} />
                    {/* 3 mėn. žyma (50% skalės) */}
                    <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: 'var(--x-hair-2)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--x-mid)', marginTop: 6 }}>
                    <span>0</span>
                    <span>3 mo · {fmtShort(emergency.target3)}</span>
                    <span>6 mo · {fmtShort(emergency.target6)}</span>
                  </div>
                  {emergency.runway < 3 && (
                    <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 10 }}>
                      {fmt(emergency.target3 - emergency.savings)} to reach the 3-month safety net.
                    </div>
                  )}
                </div>
              )}

              {inflation && inflation.overallPct != null && (
                <div className="x-card">
                  <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>📈 Your personal inflation</div>
                  <div style={{ fontSize: 12, color: 'var(--x-mid)', marginBottom: 12 }}>
                    Same purchases now vs ~a year ago ({inflation.comparable} comparable items)
                  </div>
                  <div className="x-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.8, color: inflation.overallPct > 0 ? 'var(--x-neg)' : 'var(--x-pos)' }}>
                    {inflation.overallPct > 0 ? '+' : ''}{inflation.overallPct.toFixed(1)}%
                  </div>
                  {inflation.items.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
                      {inflation.items.slice(0, 5).map(it => (
                        <div key={it.note} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--x-ink-2)' }}>{it.note}</span>
                          <span className="x-mono" style={{ color: 'var(--x-mid)', fontSize: 11.5 }}>{fmt(it.oldPrice)} → {fmt(it.newPrice)}</span>
                          <span className="x-mono" style={{ fontWeight: 600, minWidth: 52, textAlign: 'right', color: it.pct > 0 ? 'var(--x-neg)' : 'var(--x-pos)' }}>
                            {it.pct > 0 ? '+' : ''}{it.pct.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── What-if simulator + subscriptions ── */}
          <div className="pulse-row-2">
            {whatIfCats.length > 0 && (
              <div className="x-card">
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>What if…?</div>
                <div style={{ fontSize: 12, color: 'var(--x-mid)', marginBottom: 16 }}>
                  Drag to cut a category — see yearly savings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {whatIfCats.map(({ cat, avgMonthly }) => {
                    const red = whatIf[cat] ?? 0;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: 'var(--x-ink-2)' }}>
                            {metaFor(cat).emoji} {metaFor(cat).label}
                            <span style={{ fontSize: 11, color: 'var(--x-mid)' }}> · avg {fmtShort(avgMonthly)}/mo</span>
                          </span>
                          <span className="x-mono" style={{ fontSize: 12, fontWeight: 600, color: red > 0 ? 'var(--x-pos)' : 'var(--x-mid)' }}>
                            −{red}%
                          </span>
                        </div>
                        <input type="range" min={0} max={100} step={5} value={red}
                          onChange={e => setWhatIf(w => ({ ...w, [cat]: parseInt(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--x-accent)' }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  marginTop: 16, padding: '12px 16px', borderRadius: 10,
                  background: whatIfYearly > 0 ? 'rgba(31,138,91,.08)' : 'var(--x-paper)',
                  border: `1px solid ${whatIfYearly > 0 ? 'rgba(31,138,91,.2)' : 'var(--x-hair)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--x-ink-2)' }}>You'd save per year</span>
                  <span className="x-num" style={{ fontSize: 20, fontWeight: 600, color: whatIfYearly > 0 ? 'var(--x-pos)' : 'var(--x-mid)' }}>
                    {fmt(whatIfYearly)}
                  </span>
                </div>
              </div>
            )}

            {subs.length > 0 && (
              <div className="x-card">
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>Detected recurring payments</div>
                <div style={{ fontSize: 12, color: 'var(--x-mid)', marginBottom: 14 }}>
                  Same note, stable amount, 3+ months — worth reviewing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {subs.slice(0, 8).map(s => (
                    <div key={s.note} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14 }}>{metaFor(s.category).emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.note}</div>
                        <div style={{ fontSize: 11, color: 'var(--x-mid)' }}>
                          {s.months} months
                          {s.priceChange && (
                            <span style={{ color: s.priceChange.to > s.priceChange.from ? 'var(--x-neg)' : 'var(--x-pos)', fontWeight: 600 }}>
                              {' '}· {s.priceChange.to > s.priceChange.from ? '↑' : '↓'} {fmt(s.priceChange.from)} → {fmt(s.priceChange.to)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="x-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmt(s.monthlyCost)}/mo</div>
                        <div className="x-mono" style={{ fontSize: 10.5, color: 'var(--x-neg)' }}>{fmt(s.yearlyCost)}/yr</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--x-hair)', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--x-mid)' }}>Total subscriptions</span>
                  <span className="x-mono" style={{ fontWeight: 600 }}>
                    {fmt(subs.reduce((s, x) => s + x.monthlyCost, 0))}/mo · {fmt(subs.reduce((s, x) => s + x.yearlyCost, 0))}/yr
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
