import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { expensesApi, profileApi } from '../services/api';
import type { MonthStat, UserProfile } from '../types';
import { useCategories } from '../hooks/useCategories';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `${Math.abs(n).toFixed(2)} €`;

/** Metinė ataskaita — paskutinių 12 mėn. suvestinė, pritaikyta spausdinimui į PDF */
export default function Report() {
  const { user } = useAuth();
  const { metaFor } = useCategories();
  const [months, setMonths]   = useState<MonthStat[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      expensesApi.getStats(12),
      profileApi.getProfile().catch(() => null),
    ])
      .then(([s, p]) => { setMonths(s.months); setProfile(p); })
      .finally(() => setLoading(false));
  }, [user]);

  const d = useMemo(() => {
    const nonEmpty = months.filter(m => m.total > 0);
    const total = months.reduce((s, m) => s + m.total, 0);
    const avg = nonEmpty.length > 0 ? total / nonEmpty.length : 0;
    const biggest = months.length ? months.reduce((a, b) => (b.total > a.total ? b : a), months[0]) : null;
    const smallest = nonEmpty.length ? nonEmpty.reduce((a, b) => (b.total < a.total ? b : a), nonEmpty[0]) : null;

    const catAcc: Record<string, number> = {};
    for (const m of months) {
      for (const [c, v] of Object.entries(m.byCategory)) {
        if ((v ?? 0) > 0) catAcc[c] = (catAcc[c] ?? 0) + (v ?? 0);
      }
    }
    const cats = Object.entries(catAcc).map(([cat, t]) => ({ cat, total: t })).sort((a, b) => b.total - a.total);

    const salary = profile?.salary ?? 0;
    const yearIncome = salary > 0 ? salary * nonEmpty.length : 0;
    const saved = yearIncome > 0 ? yearIncome - nonEmpty.reduce((s, m) => s + m.total, 0) : null;

    return { total, avg, biggest, smallest, cats, saved, monthsTracked: nonEmpty.length };
  }, [months, profile]);

  const max = Math.max(1, ...months.map(m => m.total));
  const period = months.length
    ? `${MONTHS_SHORT[months[0].month - 1]} ${months[0].year} – ${MONTHS_SHORT[months[months.length - 1].month - 1]} ${months[months.length - 1].year}`
    : '';

  if (!user) return null;

  return (
    <div style={{ padding: 'var(--pulse-pad, 24px)', paddingBottom: 64, maxWidth: 760, margin: '0 auto' }}>
      {/* Spausdinant slepiam navigaciją ir mygtukus */}
      <style>{`
        @media print {
          .pulse-side, .no-print { display: none !important; }
          .pulse-shell { display: block !important; }
          .pulse-main { overflow: visible !important; height: auto !important; }
          .x-card { break-inside: avoid; border: 1px solid #ddd !important; box-shadow: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div>
          <Link to="/stats" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--x-mid)', textDecoration: 'none', marginBottom: 6 }}>
            ← Back to stats
          </Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Annual report</h1>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => window.print()} className="x-btn x-btn-primary" style={{ height: 40 }}>
          🖨 Save as PDF
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--x-hair)', borderTopColor: 'var(--x-accent)', animation: 'spin .7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header for print */}
          <div className="x-card">
            <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500 }}>
              Expense report · {period}
            </div>
            <div style={{ fontSize: 13, color: 'var(--x-mid)', marginTop: 2 }}>{user.email}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
              {[
                { label: 'Total spent', value: fmt(d.total) },
                { label: 'Monthly average', value: fmt(d.avg) },
                { label: 'Biggest month', value: d.biggest ? `${MONTHS_SHORT[d.biggest.month - 1]} · ${fmt(d.biggest.total)}` : '—' },
                d.saved != null
                  ? { label: 'Saved (est.)', value: fmt(d.saved) }
                  : { label: 'Months tracked', value: String(d.monthsTracked) },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--x-paper)', borderRadius: 10, padding: '12px 14px' }}>
                  <div className="x-mono" style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.4 }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--x-mid)', marginTop: 3 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly chart */}
          <div className="x-card">
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Spending by month</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
              {months.map(m => (
                <div key={m.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <span className="x-mono" style={{ fontSize: 9, color: 'var(--x-mid)' }}>{m.total > 0 ? Math.round(m.total) : ''}</span>
                  <div style={{ width: '100%', maxWidth: 40, height: `${m.total === 0 ? 2 : Math.max(4, (m.total / max) * 100)}%`, borderRadius: 5, background: 'var(--x-warm)' }} />
                  <span style={{ fontSize: 9.5, color: 'var(--x-mid)' }}>{MONTHS_SHORT[m.month - 1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category table */}
          <div className="x-card">
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Categories</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {d.cats.map(({ cat, total }, i) => {
                const meta = metaFor(cat);
                const pct = d.total > 0 ? (total / d.total) * 100 : 0;
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i > 0 ? '1px solid var(--x-hair)' : 'none' }}>
                    <span style={{ fontSize: 15 }}>{meta.emoji}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{meta.label}</span>
                    <div style={{ width: 120, height: 6, background: meta.soft, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: meta.dot }} />
                    </div>
                    <span className="x-mono" style={{ fontSize: 12, color: 'var(--x-mid)', width: 40, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                    <span className="x-mono" style={{ fontSize: 12.5, fontWeight: 500, width: 90, textAlign: 'right' }}>{fmt(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--x-mid-2)', textAlign: 'center' }}>
            Generated {new Date().toLocaleDateString('en-GB')} · Expences app
          </div>
        </div>
      )}
    </div>
  );
}
