import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { expensesApi, profileApi } from '../services/api';
import type { ExpensesResponse, ExpenseCategory, UserProfile, Expense } from '../types';
import { CATEGORY_META } from '../types';

// ── Category dot colors (design palette) ──────────────
const CAT_DOTS: Record<ExpenseCategory, string> = {
  MAISTAS:   '#0b0d10',
  KURAS:     '#2A6FDB',
  RUBAI:     '#7a5fb0',
  NEBUTINOS: '#8b919c',
  BOLT_WOLT: '#1f8a5b',
  KITOS:     '#a07b2c',
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
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

// ── Spark bar chart ────────────────────────────────────
function SparkBars({ days, height = 120 }: { days: { day: number; total: number }[]; height?: number }) {
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
              background: d.day === today ? 'var(--x-accent)' : 'var(--x-paper-2)',
              transition: 'height .3s ease',
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Budget ring ────────────────────────────────────────
function BudgetRing({ spent, budget, size = 96 }: { spent: number; budget: number; size?: number }) {
  const pct = Math.min(1, budget > 0 ? spent / budget : 0);
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const over = pct >= 1;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--x-paper-2)" strokeWidth="7" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={over ? 'var(--x-neg)' : 'var(--x-accent)'} strokeWidth="7"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="x-mono" style={{ fontSize: 17, fontWeight: 600, color: over ? 'var(--x-neg)' : 'var(--x-ink)' }}>
          {Math.round(pct * 100)}%
        </div>
        <div style={{ fontSize: 9, color: 'var(--x-mid)', letterSpacing: .5, textTransform: 'uppercase' }}>used</div>
      </div>
    </div>
  );
}

// ── Transaction row ────────────────────────────────────
function TxRow({ expense, onDelete }: { expense: Expense; onDelete?: () => void }) {
  const meta = CATEGORY_META[expense.category];
  const dot  = CAT_DOTS[expense.category];
  const d    = new Date(expense.date);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--x-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
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
  );
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

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const [result, prof] = await Promise.all([
        expensesApi.getExpenses(selectedMonth, selectedYear),
        profileApi.getProfile(),
      ]);
      setData(result); setProfile(prof);
    } catch { setError('Failed to load data'); }
    finally  { setLoading(false); }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    await expensesApi.deleteExpense(id);
    fetchData();
  };

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
  const spent       = data?.total ?? 0;
  const income      = profile?.salary ?? 0;
  const balance     = income > 0 ? income - spent : null;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysPassed  = isCurrentMonth ? now.getDate() : daysInMonth;
  const dailyAvg    = daysPassed > 0 ? spent / daysPassed : 0;
  const projected   = dailyAvg * daysInMonth;
  const foodSpent   = data?.byCategory.MAISTAS ?? 0;
  const foodLimit   = profile?.foodMonthlyLimit ?? 0;
  const foodLeft    = Math.max(0, foodLimit - foodSpent);

  const topCats = CATEGORIES
    .map(c => ({ cat: c, total: data?.byCategory[c] ?? 0 }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total);

  const dayData: { day: number; total: number }[] = [];
  if (data && isCurrentMonth) {
    for (let d = 1; d <= now.getDate(); d++) {
      dayData.push({ day: d, total: data.expenses.filter(e => new Date(e.date).getDate() === d).reduce((s, e) => s + e.amount, 0) });
    }
  }

  const recent = data?.expenses.slice(0, 6) ?? [];
  const rest   = data?.expenses.slice(6) ?? [];

  if (!user) return null;

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 1080, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: -0.3 }}>Overview</h1>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--x-mid)', marginTop: 1 }}>
            {MONTHS[selectedMonth - 1]} {selectedYear}
          </p>
        </div>
        <div style={{ flex: 1 }} />

        {/* Month switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--x-bg)', border: '1px solid var(--x-hair)', borderRadius: 9, padding: 3, gap: 2 }}>
          <button onClick={prevMonth} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: '4px 8px', borderRadius: 7, display: 'flex', alignItems: 'center' }}>
            <Ico d={<path d="M15 18l-6-6 6-6"/>} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--x-ink-2)', padding: '0 6px' }}>
            {MONTHS[selectedMonth - 1]}
            {isCurrentMonth && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--x-accent)', fontWeight: 600, letterSpacing: .5 }}>NOW</span>}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            style={{ background: 'transparent', border: 0, cursor: isCurrentMonth ? 'not-allowed' : 'pointer', color: 'var(--x-mid)', padding: '4px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', opacity: isCurrentMonth ? .35 : 1 }}>
            <Ico d={<path d="M9 18l6-6-6-6"/>} />
          </button>
        </div>

        <Link to="/create" className="x-btn x-btn-primary" style={{ textDecoration: 'none' }}>
          <Ico d={<path d="M12 5v14M5 12h14"/>} /> Add expense
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
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="anim-up">

          {/* ── Hero row (3 stat cards) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

            {/* Balance / Spent */}
            <div className="x-card">
              <div style={{ fontSize: 10.5, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 8 }}>
                {balance !== null ? 'Balance · this month' : 'Total spent'}
              </div>
              <div className="x-num" style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1, lineHeight: 1, color: balance !== null && balance < 0 ? 'var(--x-neg)' : 'var(--x-ink)' }}>
                {balance !== null ? `${balance < 0 ? '−' : ''}${fmt(Math.abs(balance))}` : fmt(spent)}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                {income > 0 && <>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--x-mid)', marginBottom: 2 }}>Income</div>
                    <div className="x-mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(income)}</div>
                  </div>
                  <div className="x-divider-v" style={{ height: 26, alignSelf: 'center' }} />
                </>}
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--x-mid)', marginBottom: 2 }}>Spent</div>
                  <div className="x-mono" style={{ fontSize: 13, fontWeight: 500 }}>−{fmt(spent)}</div>
                </div>
                <div className="x-divider-v" style={{ height: 26, alignSelf: 'center' }} />
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--x-mid)', marginBottom: 2 }}>Transactions</div>
                  <div className="x-mono" style={{ fontSize: 13, fontWeight: 500 }}>{data.expenses.length}</div>
                </div>
              </div>
            </div>

            {/* Food budget */}
            <div className="x-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 8 }}>
                  Food budget
                </div>
                <div className="x-num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.5 }}>
                  {fmt(foodLeft)}
                  <span style={{ fontSize: 13, color: 'var(--x-mid)', fontWeight: 400 }}> left</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 5 }}>
                  Daily: <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmt(profile?.foodDailyLimit ?? 0)}</span>
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
              <BudgetRing spent={foodSpent} budget={foodLimit} size={90} />
            </div>

            {/* Daily avg */}
            <div className="x-card">
              <div style={{ fontSize: 10.5, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 8 }}>
                Daily average
              </div>
              <div className="x-num" style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1, lineHeight: 1 }}>
                {fmt(dailyAvg)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 10 }}>
                Projected: <span className="x-mono" style={{ color: income > 0 && projected > income ? 'var(--x-neg)' : 'var(--x-ink-2)' }}>{fmtShort(projected)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 3 }}>
                {daysPassed} of {daysInMonth} days tracked
              </div>
            </div>
          </div>

          {/* ── Middle row (chart + recent) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: dayData.length > 0 ? '1.5fr 1fr' : '1fr', gap: 14 }}>

            {dayData.length > 0 && (
              <div className="x-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Daily spending</div>
                    <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 2 }}>
                      Avg <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmt(dailyAvg)}</span>
                      {' · '}Projected <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmtShort(projected)}</span>
                    </div>
                  </div>
                </div>
                <SparkBars days={dayData} height={120} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 10.5, color: 'var(--x-mid)' }}>
                  <span>{MONTHS[selectedMonth - 1]} 1</span>
                  <span>today · {MONTHS[selectedMonth - 1]} {now.getDate()}</span>
                </div>
              </div>
            )}

            {/* Recent */}
            <div className="x-card" style={{ padding: 0 }}>
              <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Recent</div>
                <Link to="/create" style={{ fontSize: 11.5, color: 'var(--x-mid)', textDecoration: 'none' }}>+ Add →</Link>
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
                      <TxRow expense={e} onDelete={() => handleDelete(e.id)} />
                      {i < recent.length - 1 && <div className="x-divider" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom row (categories + insights) ── */}
          {topCats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
              {/* Categories */}
              <div className="x-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Categories</div>
                  <div style={{ fontSize: 12, color: 'var(--x-mid)' }}>{topCats.length} active</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {topCats.map(({ cat, total }) => {
                    const meta = CATEGORY_META[cat];
                    const dot  = CAT_DOTS[cat];
                    const pct  = spent > 0 ? (total / spent) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 4, background: dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--x-ink-2)' }}>{meta.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span className="x-mono" style={{ fontSize: 13, fontWeight: 500 }}>−{fmt(total)}</span>
                            <span className="x-mono" style={{ fontSize: 11, color: 'var(--x-mid)', minWidth: 28, textAlign: 'right' }}>{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 6, background: 'var(--x-paper-2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: dot, borderRadius: 3, transition: 'width .5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Insights */}
              <div className="x-card">
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: 'var(--x-accent)' }}>
                    <Ico d={<><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v1.3h6V16.7c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/><path d="M9 18h6M10 22h4"/></>} />
                  </span>
                  Insights
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {topCats[0] && (
                    <div style={{ display: 'flex', gap: 11 }}>
                      <div style={{ width: 3, borderRadius: 2, background: 'var(--x-neg)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Top: {CATEGORY_META[topCats[0].cat].label}</div>
                        <div style={{ fontSize: 12, color: 'var(--x-mid)', lineHeight: 1.55 }}>
                          {Math.round((topCats[0].total / spent) * 100)}% of spending — {fmt(topCats[0].total)} this month.
                        </div>
                      </div>
                    </div>
                  )}
                  {income > 0 && (
                    <div style={{ display: 'flex', gap: 11 }}>
                      <div style={{ width: 3, borderRadius: 2, background: projected <= income ? 'var(--x-pos)' : 'var(--x-neg)', flexShrink: 0 }} />
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
                    <div style={{ display: 'flex', gap: 11 }}>
                      <div style={{ width: 3, borderRadius: 2, background: foodSpent >= foodLimit ? 'var(--x-neg)' : 'var(--x-accent)', flexShrink: 0 }} />
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
                    <div style={{ display: 'flex', gap: 11 }}>
                      <div style={{ width: 3, borderRadius: 2, background: 'var(--x-accent)', flexShrink: 0 }} />
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

          {/* ── Extended transaction list ── */}
          {rest.length > 0 && (
            <div className="x-card" style={{ padding: 0 }}>
              <div style={{ padding: '16px 20px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
                  All transactions <span style={{ fontWeight: 400, color: 'var(--x-mid)', fontSize: 13 }}>({data.expenses.length})</span>
                </div>
              </div>
              <div className="x-divider" />
              <div style={{ padding: '2px 20px' }}>
                {rest.map((e, i) => (
                  <div key={e.id}>
                    <TxRow expense={e} onDelete={() => handleDelete(e.id)} />
                    {i < rest.length - 1 && <div className="x-divider" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.expenses.length === 0 && (
            <div className="x-card" style={{ textAlign: 'center', padding: 56 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--x-ink)', marginBottom: 6 }}>No expenses this month</div>
              <div style={{ fontSize: 13, color: 'var(--x-mid)', marginBottom: 20 }}>Start tracking your spending.</div>
              <Link to="/create" className="x-btn x-btn-primary" style={{ textDecoration: 'none' }}>Add first expense</Link>
            </div>
          )}

        </div>
      ) : null}
    </div>
  );
}
