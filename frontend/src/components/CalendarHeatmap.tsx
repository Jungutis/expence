import { useState, useEffect, useMemo } from 'react';
import { expensesApi } from '../services/api';
import type { Expense } from '../types';

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const fmt = (n: number) => `${n.toFixed(2)} €`;

/** Mėnesio kalendorius, kur kiekviena diena nuspalvinta pagal išleistą sumą */
export default function CalendarHeatmap() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  useEffect(() => {
    setLoading(true);
    expensesApi.getExpenses(month, year)
      .then(r => setExpenses(r.expenses))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, [month, year]);

  const { cells, maxDay, monthTotal } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const daily = Array.from({ length: daysInMonth }, () => 0);
    for (const e of expenses) {
      const d = new Date(e.date);
      daily[d.getDate() - 1] += e.amount;
    }
    const max = Math.max(...daily, 1);
    // Pirmos mėnesio dienos savaitės diena (0 = pirmadienis)
    const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const cells: ({ day: number; total: number } | null)[] = [
      ...Array.from({ length: firstDow }, () => null),
      ...daily.map((total, i) => ({ day: i + 1, total })),
    ];
    return { cells, maxDay: max, monthTotal: daily.reduce((s, v) => s + v, 0) };
  }, [expenses, month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="x-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>Spending calendar</div>
          <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 2 }}>
            {MONTHS[month - 1]} {year} · <span className="x-mono" style={{ color: 'var(--x-ink-2)' }}>{fmt(monthTotal)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={prevMonth}
            style={{ background: 'transparent', border: '1px solid var(--x-hair)', borderRadius: 8, cursor: 'pointer', color: 'var(--x-mid)', padding: '6px 9px', display: 'flex' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            style={{ background: 'transparent', border: '1px solid var(--x-hair)', borderRadius: 8, cursor: isCurrentMonth ? 'not-allowed' : 'pointer', color: 'var(--x-mid)', padding: '6px 9px', display: 'flex', opacity: isCurrentMonth ? .35 : 1 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--x-hair)', borderTopColor: 'var(--x-accent)', animation: 'spin .7s linear infinite' }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {DOW.map(d => (
              <div key={d} style={{ fontSize: 10, color: 'var(--x-mid-2)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: .5 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} />;
              const intensity = cell.total > 0 ? 0.12 + 0.78 * (cell.total / maxDay) : 0;
              const isToday = isCurrentMonth && cell.day === now.getDate();
              const isFuture = isCurrentMonth && cell.day > now.getDate();
              return (
                <div key={cell.day}
                  title={`${MONTHS[month - 1]} ${cell.day}: ${fmt(cell.total)}`}
                  style={{
                    aspectRatio: '1', borderRadius: 8, position: 'relative',
                    background: cell.total > 0 ? `rgba(160,77,46,${intensity})` : 'var(--x-paper)',
                    border: isToday ? '2px solid var(--x-ink)' : '1px solid var(--x-hair)',
                    opacity: isFuture ? .35 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    minHeight: 40,
                  }}>
                  <span style={{ fontSize: 10.5, fontWeight: isToday ? 700 : 500, color: intensity > 0.55 ? '#fff' : 'var(--x-mid)' }}>
                    {cell.day}
                  </span>
                  {cell.total > 0 && (
                    <span className="x-mono" style={{ fontSize: 9, fontWeight: 600, color: intensity > 0.55 ? 'rgba(255,255,255,.9)' : 'var(--x-ink-2)' }}>
                      {cell.total >= 100 ? Math.round(cell.total) : cell.total.toFixed(0)}€
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10.5, color: 'var(--x-mid)' }}>
            <span>Less</span>
            {[0, .25, .5, .75, 1].map(a => (
              <span key={a} style={{ width: 14, height: 14, borderRadius: 4, background: a === 0 ? 'var(--x-paper)' : `rgba(160,77,46,${0.12 + 0.78 * a})`, border: '1px solid var(--x-hair)' }} />
            ))}
            <span>More</span>
          </div>
        </>
      )}
    </div>
  );
}
