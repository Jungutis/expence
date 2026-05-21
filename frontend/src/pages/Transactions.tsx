import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { expensesApi } from '../services/api';
import type { Expense, ExpenseCategory } from '../types';
import { CATEGORY_META } from '../types';

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

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const fmt = (n: number) => `${Math.abs(n).toFixed(2)} €`;

function Ico({ d, size = 15 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

// ── Transaction row (with collapse animation) ──────────
function TxRow({ expense, onDelete, deleting }: {
  expense: Expense;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const meta   = CATEGORY_META[expense.category];
  const dot    = CAT_DOTS[expense.category];
  const soft   = CAT_SOFT[expense.category];
  const d      = new Date(expense.date);
  const time   = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const rowRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (rowRef.current && height === undefined) setHeight(rowRef.current.scrollHeight);
  }, [height]);

  const style: React.CSSProperties = deleting
    ? { overflow: 'hidden', height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0, transition: 'height .28s ease, opacity .2s ease, margin .28s ease, padding .28s ease' }
    : { overflow: 'hidden', height: height ?? 'auto', opacity: 1, transition: 'height .28s ease, opacity .2s ease' };

  return (
    <div ref={rowRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
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

export default function Transactions() {
  const { user } = useAuth();
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const result = await expensesApi.getExpenses(selectedMonth, selectedYear);
      setExpenses(result.expenses);
      setTotal(result.total);
    } catch { setError('Failed to load'); }
    finally  { setLoading(false); }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setTimeout(() => {
      setExpenses(prev => prev.filter(e => e.id !== id));
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

  // Group by day
  const grouped: { label: string; items: Expense[] }[] = [];
  for (const e of expenses) {
    const day = new Date(e.date);
    const label = day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) last.items.push(e);
    else grouped.push({ label, items: [e] });
  }

  if (!user) return null;

  return (
    <div style={{ padding: 'var(--pulse-pad, 24px)', maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--x-mid)', textDecoration: 'none', marginBottom: 4 }}>
            <Ico d={<path d="M15 18l-6-6 6-6"/>} size={13} /> Back
          </Link>
          <h1 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, letterSpacing: -0.2 }}>All transactions</h1>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--x-mid)', marginTop: 1 }}>
            {MONTHS[selectedMonth - 1]} {selectedYear}
            {expenses.length > 0 && <> · <span className="x-mono">{expenses.length} items · −{fmt(total)}</span></>}
          </p>
        </div>
        <div style={{ flex: 1 }} />

        {/* Month switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--x-bg)', border: '1px solid var(--x-hair)', borderRadius: 11, padding: 4, gap: 2 }}>
          <button onClick={prevMonth}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
            <Ico d={<path d="M15 18l-6-6 6-6"/>} size={18} />
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--x-ink-2)', padding: '0 4px', whiteSpace: 'nowrap' }}>
            {MONTHS[selectedMonth - 1].slice(0, 3)}
            {isCurrentMonth && <span style={{ marginLeft: 5, fontSize: 11, color: 'var(--x-accent)', fontWeight: 600 }}>NOW</span>}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            style={{ background: 'transparent', border: 0, cursor: isCurrentMonth ? 'not-allowed' : 'pointer', color: 'var(--x-mid)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', opacity: isCurrentMonth ? .35 : 1 }}>
            <Ico d={<path d="M9 18l6-6-6-6"/>} size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--x-hair)', borderTopColor: 'var(--x-accent)', animation: 'spin .7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : error ? (
        <div className="x-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--x-neg)', marginBottom: 12 }}>{error}</p>
          <button onClick={fetchData} className="x-btn x-btn-secondary">Retry</button>
        </div>
      ) : expenses.length === 0 ? (
        <div className="x-card" style={{ textAlign: 'center', padding: 56 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No expenses this month</div>
          <div style={{ fontSize: 13, color: 'var(--x-mid)', marginBottom: 20 }}>Start tracking your spending.</div>
          <Link to="/create" className="x-btn x-btn-primary" style={{ textDecoration: 'none' }}>Add first expense</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="anim-up">
          {grouped.map(({ label, items }) => (
            <div key={label} className="x-card" style={{ padding: 0 }}>
              {/* Day header */}
              <div style={{ padding: '12px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
                <div className="x-mono" style={{ fontSize: 12, color: 'var(--x-mid)' }}>
                  −{fmt(items.reduce((s, e) => s + e.amount, 0))}
                </div>
              </div>
              <div className="x-divider" />
              <div style={{ padding: '2px 20px' }}>
                {items.map((e, i) => (
                  <div key={e.id}>
                    <TxRow expense={e} onDelete={() => handleDelete(e.id)} deleting={deletingId === e.id} />
                    {i < items.length - 1 && <div className="x-divider" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
