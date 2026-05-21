import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { expensesApi, profileApi } from '../services/api';
import type { ExpensesResponse, ExpenseCategory, UserProfile, Expense } from '../types';
import { CATEGORY_META } from '../types';

// ── Category dot colors ────────────────────────────────
const CAT_DOTS: Record<ExpenseCategory, string> = {
  MAISTAS:   '#a04d2e',
  KURAS:     '#1f5454',
  RUBAI:     '#8a5258',
  NEBUTINOS: '#6d4870',
  BOLT_WOLT: '#547040',
  KITOS:     '#a07d2e',
};
const CAT_SOFT: Record<ExpenseCategory, string> = {
  MAISTAS:   '#ecd0bf',
  KURAS:     '#cad9d9',
  RUBAI:     '#e8d2d4',
  NEBUTINOS: '#ddd0de',
  BOLT_WOLT: '#d6dec8',
  KITOS:     '#eddfbc',
};
const CATEGORIES: ExpenseCategory[] = ['MAISTAS','KURAS','RUBAI','NEBUTINOS','BOLT_WOLT','KITOS'];
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const fmt      = (n: number) => `${Math.abs(n).toFixed(2)} €`;
const fmtShort = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k €` : `${Math.round(n)} €`;

// ── Icon helper ────────────────────────────────────────
function Ico({ d, size = 15 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

// ── Spark bar chart ────────────────────────────────────
function SparkBars({ days, height = 110 }: { days: { day: number; total: number }[]; height?: number }) {
  const max = Math.max(1, ...days.map(d => d.total));
  const today = new Date().getDate();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, width: '100%' }}>
      {days.map(d => {
        const h = d.total === 0 ? 2 : Math.max(4, (d.total / max) * (height - 12));
        return (
          <div key={d.day} style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}
            title={`Day ${d.day}: ${fmt(d.total)}`}>
            <div style={{
              width: '100%', height: h, borderRadius: 3,
              background: d.day === today ? 'var(--x-warm)' : 'var(--x-paper-2)',
              transition: 'height .3s ease',
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Budget ring ────────────────────────────────────────
function BudgetRing({ spent, budget, size = 88 }: { spent: number; budget: number; size?: number }) {
  const pct   = Math.min(1, budget > 0 ? spent / budget : 0);
  const r     = (size - 12) / 2;
  const c     = 2 * Math.PI * r;
  // Dynamic color: forest (<70%) → honey (70–90%) → terracotta (>90%)
  const ringColor = pct >= 1 ? 'var(--x-neg)' : pct >= 0.9 ? '#a04d2e' : pct >= 0.7 ? '#a07d2e' : 'var(--x-accent)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--x-paper-2)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={ringColor} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .5s ease, stroke .4s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <div className="x-mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.4, color: pct >= 0.9 ? ringColor : 'var(--x-ink)' }}>
          {Math.round(pct * 100)}%
        </div>
        <div style={{ fontSize: 9, color: 'var(--x-mid)', letterSpacing: 0.4, textTransform: 'uppercase' }}>budget</div>
      </div>
    </div>
  );
}

// ── Transaction row ────────────────────────────────────
function TxRow({ expense, onDelete, deleting }: { expense: Expense; onDelete?: () => void; deleting?: boolean }) {
  const meta    = CATEGORY_META[expense.category];
  const dot     = CAT_DOTS[expense.category];
  const soft    = CAT_SOFT[expense.category];
  const d       = new Date(expense.date);
  const time    = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const rowRef  = useRef<HTMLDivElement>(null);

  // Measure natural height once for collapse animation
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (rowRef.current && height === undefined) {
      setHeight(rowRef.current.scrollHeight);
    }
  }, [height]);

  const style: React.CSSProperties = deleting
    ? { overflow: 'hidden', height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0, transition: 'height .28s ease, opacity .2s ease, margin .28s ease, padding .28s ease' }
    : { overflow: 'hidden', height: height ?? 'auto', opacity: 1, transition: 'height .28s ease, opacity .2s ease' };

  return (
    <div ref={rowRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 }}>
          {meta.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--x-ink)' }}>
            {expense.note || meta.label}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--x-mid)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: dot, flexShrink: 0 }} />
            {meta.label} · {time}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="x-mono" style={{ fontSize: 13.5, fontWeight: 500 }}>−{fmt(expense.amount)}</span>
          {onDelete && (
            <button onClick={onDelete}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: 4, borderRadius: 5, display: 'flex', opacity: 0.6 }}
              title="Delete">
              <Ico d={<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Animated number — subtle opacity pulse on change ──
function Num({ val, format }: { val: number; format: (n: number) => string }) {
  const ref     = useRef<HTMLSpanElement>(null);
  const prev    = useRef(val);
  const mounted = useRef(false);
  useEffect(() => {
    // Skip animation on first mount
    if (!mounted.current) { mounted.current = true; return; }
    if (prev.current !== val && ref.current) {
      ref.current.animate(
        [{ opacity: 0.4 }, { opacity: 1 }],
        { duration: 220, easing: 'ease' },
      );
      prev.current = val;
    }
  }, [val]);
  return <span ref={ref}>{format(val)}</span>;
}

// ── Main ───────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [data,    setData]    = useState<ExpensesResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Separate list state — only this changes on delete, stat cards stay untouched
  const [displayExpenses, setDisplayExpenses] = useState<Expense[]>([]);

  // Track whether initial load animation has already played
  const didAnimateRef = useRef(false);

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const [result, prof] = await Promise.all([
        expensesApi.getExpenses(selectedMonth, selectedYear),
        profileApi.getProfile(),
      ]);
      setData(result);
      setDisplayExpenses(result.expenses);
      setProfile(prof);
    } catch { setError('Failed to load data'); }
    finally  { setLoading(false); }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);

    // After collapse animation — only list updates, stat cards untouched
    setTimeout(() => {
      setDisplayExpenses(prev => prev.filter(e => e.id !== id));
      setDeletingId(null);
    }, 320);

    expensesApi.deleteExpense(id).catch(() => {
      setDeletingId(null);
      fetchData();
    });
  }, [deletingId, fetchData]);

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  // ── Derived ──────────────────────────────────────────
  // ── Derived from displayExpenses — updates instantly on delete ──
  const spent = useMemo(
    () => displayExpenses.reduce((s, e) => s + e.amount, 0),
    [displayExpenses],
  );

  const byCategory = useMemo(
    () => displayExpenses.reduce((acc, e) => {
      acc[e.category as ExpenseCategory] = (acc[e.category as ExpenseCategory] ?? 0) + e.amount;
      return acc;
    }, {} as Partial<Record<ExpenseCategory, number>>),
    [displayExpenses],
  );

  const income      = profile?.salary ?? 0;
  const balance     = income > 0 ? income - spent : null;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  // Daily avg = total spent ÷ today's date (current month) or full month days (past)
  const daysPassed  = isCurrentMonth ? now.getDate() : daysInMonth;
  const dailyAvg    = daysPassed > 0 ? spent / daysPassed : 0;
  const projected   = dailyAvg * daysInMonth;
  const foodSpent   = byCategory['MAISTAS'] ?? 0;
  const foodLimit   = profile?.foodMonthlyLimit ?? 0;
  const foodLeft    = Math.max(0, foodLimit - foodSpent);

  const topCats = useMemo(
    () => CATEGORIES
      .map(c => ({ cat: c, total: byCategory[c] ?? 0 }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total),
    [byCategory],
  );

  // Chart uses original fetch data — doesn't re-animate on delete
  const dayData = useMemo(() => {
    if (!data || !isCurrentMonth) return [];
    return Array.from({ length: now.getDate() }, (_, i) => {
      const day = i + 1;
      return {
        day,
        total: data.expenses
          .filter(e => new Date(e.date).getDate() === day)
          .reduce((s, e) => s + e.amount, 0),
      };
    });
  }, [data, isCurrentMonth, now]);

  const recent = displayExpenses.slice(0, 6);

  if (!user) return null;

  return (
    <div style={{ padding: 'var(--pulse-pad, 24px)', maxWidth: 1080, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, letterSpacing: -0.2 }}>Overview</h1>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--x-mid)', marginTop: 1 }}>
            {MONTHS[selectedMonth - 1]} {selectedYear}
          </p>
        </div>
        <div style={{ flex: 1 }} />

        {/* Month switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--x-bg)', border: '1px solid var(--x-hair)', borderRadius: 11, padding: 4, gap: 2 }}>
          <button onClick={prevMonth}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
            <Ico d={<path d="M15 18l-6-6 6-6"/>} size={18} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--x-ink-2)', padding: '0 6px', whiteSpace: 'nowrap' }}>
            {MONTHS[selectedMonth - 1].slice(0, 3)}
            {isCurrentMonth && <span style={{ marginLeft: 5, fontSize: 11, color: 'var(--x-accent)', fontWeight: 600 }}>NOW</span>}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            style={{ background: 'transparent', border: 0, cursor: isCurrentMonth ? 'not-allowed' : 'pointer', color: 'var(--x-mid)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', opacity: isCurrentMonth ? .35 : 1 }}>
            <Ico d={<path d="M9 18l6-6-6-6"/>} size={18} />
          </button>
        </div>

        <Link to="/create" className="pulse-add" style={{ textDecoration: 'none' }}>
          <Ico d={<path d="M12 5v14M5 12h14"/>} size={14} />
          <span className="pulse-add-label">Add expense</span>
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--x-hair)', borderTopColor: 'var(--x-accent)', animation: 'spin .7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : error ? (
        <div className="x-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--x-neg)', marginBottom: 12 }}>{error}</p>
          <button onClick={fetchData} className="x-btn x-btn-secondary">Retry</button>
        </div>
      ) : data ? (() => {
        const isFirstRender = !didAnimateRef.current;
        if (isFirstRender) didAnimateRef.current = true;
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pulse-gap, 14px)' }} className={isFirstRender ? 'anim-up' : ''}>

          {/* ── Hero row (3 stat cards) ── */}
          <div className="pulse-row-3">

            {/* Balance / Spent */}
            <div className="x-card">
              <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 6 }}>
                {balance !== null ? 'Balance · this month' : 'Total spent'}
              </div>
              <div className="x-num" style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1, marginTop: 4, color: balance !== null && balance < 0 ? 'var(--x-neg)' : 'var(--x-ink)' }}>
                {balance !== null
                  ? <><span>{balance < 0 ? '−' : ''}</span><Num val={Math.abs(balance)} format={fmt} /></>
                  : <Num val={spent} format={fmt} />}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                {income > 0 && <>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--x-mid)', marginBottom: 2 }}>Income</div>
                    <div className="x-mono" style={{ fontSize: 13.5, fontWeight: 500 }}>{fmt(income)}</div>
                  </div>
                  <div className="x-divider-v" style={{ height: 26 }} />
                </>}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--x-mid)', marginBottom: 2 }}>Spent</div>
                  <div className="x-mono" style={{ fontSize: 13.5, fontWeight: 500 }}>−<Num val={spent} format={fmt} /></div>
                </div>
                <div className="x-divider-v" style={{ height: 26 }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--x-mid)', marginBottom: 2 }}>Transactions</div>
                  <div className="x-mono" style={{ fontSize: 13.5, fontWeight: 500 }}><Num val={displayExpenses.length} format={String} /></div>
                </div>
              </div>
            </div>

            {/* Food budget */}
            <div className="x-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 6 }}>
                  Budget
                </div>
                <div className="x-num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>
                  <Num val={foodLeft} format={fmt} /><span style={{ fontSize: 13, color: 'var(--x-mid)', fontWeight: 400 }}> left</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 4 }}>
                  Safe daily: <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmt(profile?.foodDailyLimit ?? 0)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--x-paper-2)', marginTop: 10, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: foodSpent >= foodLimit ? 'var(--x-neg)' : 'var(--x-accent)',
                    width: `${Math.min(100, foodLimit > 0 ? (foodSpent / foodLimit) * 100 : 0)}%`,
                    transition: 'width .5s ease',
                  }} />
                </div>
              </div>
              <BudgetRing spent={foodSpent} budget={foodLimit} size={88} />
            </div>

            {/* Daily avg */}
            <div className="x-card">
              <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 6 }}>
                Daily average
              </div>
              <div className="x-num" style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1, marginTop: 4 }}>
                <Num val={dailyAvg} format={fmt} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 12 }}>
                Projected: <span className="x-mono" style={{ color: income > 0 && projected > income ? 'var(--x-neg)' : 'var(--x-ink-2)' }}><Num val={projected} format={fmtShort} /></span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 3 }}>
                {daysPassed} of {daysInMonth} days tracked
              </div>
            </div>
          </div>

          {/* ── Middle row (chart + recent) ── */}
          <div className="pulse-row-2">

            {dayData.length > 0 ? (
              <div className="x-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>Daily spending</div>
                    <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 2 }}>
                      Avg <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmt(dailyAvg)}</span>
                      {' · '}Proj <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmtShort(projected)}</span>
                    </div>
                  </div>
                </div>
                <SparkBars days={dayData} height={110} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--x-mid)' }}>
                  <span>{MONTHS[selectedMonth - 1].slice(0,3)} 1</span>
                  <span>today · {now.getDate()}</span>
                </div>
              </div>
            ) : (
              <div className="x-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
                <div style={{ textAlign: 'center', color: 'var(--x-mid)', fontSize: 13 }}>
                  No chart data for past months
                </div>
              </div>
            )}

            {/* Recent */}
            <div className="x-card" style={{ padding: 0 }}>
              <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>Recent</div>
                <Link to="/transactions" style={{ fontSize: 12, color: 'var(--x-mid)', textDecoration: 'none' }}>View all →</Link>
              </div>
              <div className="x-divider" />
              {recent.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--x-mid)', fontSize: 13 }}>
                  No expenses yet this month
                </div>
              ) : (
                <div style={{ padding: '2px 20px' }}>
                  {recent.map((e, i) => (
                    <div key={e.id}>
                      <TxRow expense={e} onDelete={() => handleDelete(e.id)} deleting={deletingId === e.id} />
                      {i < recent.length - 1 && <div className="x-divider" />}
                    </div>
                  ))}
                </div>
              )}
              {/* View all / Quick add footer */}
              <div style={{ padding: '10px 20px 16px', display: 'flex', gap: 8 }}>
                {displayExpenses.length > 6 && (
                  <Link to="/transactions" style={{
                    flex: 1, display: 'block', textAlign: 'center', padding: '9px',
                    borderRadius: 9, background: 'var(--x-paper)', border: '1px solid var(--x-hair)',
                    color: 'var(--x-ink-2)', fontSize: 12.5, textDecoration: 'none', fontWeight: 500,
                  }}>
                    View all {displayExpenses.length} →
                  </Link>
                )}
                <Link to="/create" style={{
                  flex: 1, display: 'block', textAlign: 'center', padding: '9px',
                  borderRadius: 9, border: '1px dashed var(--x-hair-2)',
                  color: 'var(--x-mid)', fontSize: 12.5, textDecoration: 'none',
                }}>
                  + Quick add
                </Link>
              </div>
            </div>
          </div>

          {/* ── Bottom row (categories + insights) ── */}
          {topCats.length > 0 && (
            <div className="pulse-row-2">
              {/* Categories */}
              <div className="x-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>Categories</div>
                  <div style={{ fontSize: 12, color: 'var(--x-mid)' }}>{topCats.length} active</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topCats.map(({ cat, total }) => {
                    const meta    = CATEGORY_META[cat];
                    const dot     = CAT_DOTS[cat];
                    const catSoft = CAT_SOFT[cat];
                    const pct     = spent > 0 ? (total / spent) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--x-ink-2)' }}>{meta.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span className="x-mono" style={{ fontSize: 12.5, fontWeight: 500 }}>−{fmt(total)}</span>
                            <span className="x-mono" style={{ fontSize: 11, color: 'var(--x-mid)', minWidth: 30, textAlign: 'right' }}>{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 6, background: catSoft, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: dot, borderRadius: 3, transition: 'width .5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Insights */}
              <div className="x-card">
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: 'var(--x-accent)' }}>
                    <Ico d={<><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v1.3h6V16.7c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/><path d="M9 18h6M10 22h4"/></>} />
                  </span>
                  Insights
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topCats[0] && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 3, borderRadius: 2, background: 'var(--x-neg)', flexShrink: 0, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Top: {CATEGORY_META[topCats[0].cat].label}</div>
                        <div style={{ fontSize: 12, color: 'var(--x-mid)', lineHeight: 1.55 }}>
                          {Math.round((topCats[0].total / spent) * 100)}% of spending — {fmt(topCats[0].total)} this month.
                        </div>
                      </div>
                    </div>
                  )}
                  {income > 0 && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 3, borderRadius: 2, background: projected <= income ? 'var(--x-pos)' : 'var(--x-neg)', flexShrink: 0, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                          {projected <= income ? 'On track' : 'Over budget'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--x-mid)', lineHeight: 1.55 }}>
                          {projected <= income
                            ? `At today's pace you'll save ${fmtShort(income - projected)} this month.`
                            : `Projected spend (${fmtShort(projected)}) exceeds your income.`}
                        </div>
                      </div>
                    </div>
                  )}
                  {foodSpent >= foodLimit * 0.85 && foodLimit > 0 && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 3, borderRadius: 2, background: foodSpent >= foodLimit ? 'var(--x-neg)' : 'var(--x-accent)', flexShrink: 0, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                          {foodSpent >= foodLimit ? 'Food limit reached' : 'Food limit near'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--x-mid)', lineHeight: 1.55 }}>
                          {fmt(foodLeft)} remaining of {fmt(foodLimit)} food budget.
                        </div>
                      </div>
                    </div>
                  )}
                  {!profile?.salary && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 3, borderRadius: 2, background: 'var(--x-accent)', flexShrink: 0, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Set your income</div>
                        <div style={{ fontSize: 12, color: 'var(--x-mid)', lineHeight: 1.55 }}>
                          <Link to="/profile" style={{ color: 'var(--x-accent)', textDecoration: 'none' }}>Add your salary →</Link> to see savings insights.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {displayExpenses.length === 0 && (
            <div className="x-card" style={{ textAlign: 'center', padding: 56 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No expenses this month</div>
              <div style={{ fontSize: 13, color: 'var(--x-mid)', marginBottom: 20 }}>Start tracking your spending.</div>
              <Link to="/create" className="x-btn x-btn-primary" style={{ textDecoration: 'none' }}>Add first expense</Link>
            </div>
          )}

        </div>
        );
      })() : null}
    </div>
  );
}
