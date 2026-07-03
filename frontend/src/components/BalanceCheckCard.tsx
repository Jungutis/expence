import { useState, useEffect, FormEvent } from 'react';
import { balanceApi } from '../services/api';
import type { BalanceCheck } from '../services/api';

const fmt = (n: number) => `${Math.abs(n).toFixed(2)} €`;

/**
 * Balanso sutikrinimas: įvedi realų sąskaitos likutį, programa palygina su
 * apskaičiuotu (senas likutis + pajamos − užfiksuotos išlaidos) ir parodo,
 * kiek pinigų "dingo" be įrašų.
 */
export default function BalanceCheckCard() {
  const [checks, setChecks]   = useState<BalanceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState('');
  const [income, setIncome]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    balanceApi.list()
      .then(({ checks }) => setChecks(checks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(balance);
    if (isNaN(parsed)) { setError('Enter your current balance'); return; }
    setBusy(true); setError('');
    try {
      const check = await balanceApi.check(parsed, income.trim() === '' ? undefined : parseFloat(income));
      setChecks(prev => [check, ...prev].slice(0, 6));
      setBalance(''); setIncome('');
    } catch {
      setError('Failed to save');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  const last = checks[0];

  return (
    <div className="x-card">
      <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 4 }}>
        Balance check
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--x-mid)', marginBottom: 14 }}>
        Enter your real account balance now and then — the app shows how much spending went untracked.
      </div>

      {/* Paskutinio sutikrinimo rezultatas */}
      {last && last.unaccounted != null && (
        <div style={{
          padding: '11px 14px', borderRadius: 10, marginBottom: 14,
          background: Math.abs(last.unaccounted) < 5 ? 'rgba(31,138,91,.07)' : 'rgba(193,75,58,.06)',
          border: `1px solid ${Math.abs(last.unaccounted) < 5 ? 'rgba(31,138,91,.2)' : 'rgba(193,75,58,.18)'}`,
          fontSize: 12.5, lineHeight: 1.55,
        }}>
          {Math.abs(last.unaccounted) < 5 ? (
            <span style={{ color: 'var(--x-pos)', fontWeight: 600 }}>✓ Records match your bank — great tracking!</span>
          ) : last.unaccounted > 0 ? (
            <>
              <span style={{ fontWeight: 600, color: 'var(--x-neg)' }}>{fmt(last.unaccounted)} untracked</span>
              <span style={{ color: 'var(--x-mid)' }}> since the previous check — spending without records.</span>
            </>
          ) : (
            <>
              <span style={{ fontWeight: 600, color: 'var(--x-pos)' }}>{fmt(last.unaccounted)} extra</span>
              <span style={{ color: 'var(--x-mid)' }}> — you have more than expected (unlogged income or over-logged expenses).</span>
            </>
          )}
        </div>
      )}

      {/* Istorija */}
      {checks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          {checks.slice(0, 4).map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--x-mid)' }}>
              <span style={{ width: 78, flexShrink: 0 }}>
                {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <span className="x-mono" style={{ color: 'var(--x-ink-2)', flex: 1 }}>{fmt(c.balance)}</span>
              {c.unaccounted != null && Math.abs(c.unaccounted) >= 5 && (
                <span className="x-mono" style={{ fontWeight: 600, color: c.unaccounted > 0 ? 'var(--x-neg)' : 'var(--x-pos)' }}>
                  {c.unaccounted > 0 ? `−${fmt(c.unaccounted)} untracked` : `+${fmt(c.unaccounted)}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Naujas sutikrinimas */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="x-label">Current balance (€)</label>
          <input type="number" step="0.01" value={balance} placeholder="e.g. 1240.50"
            onChange={e => setBalance(e.target.value)} className="x-input" style={{ height: 38 }} />
        </div>
        <div>
          <label className="x-label">Income since last <span style={{ fontWeight: 400, textTransform: 'none' }}>(opt.)</span></label>
          <input type="number" min="0" step="0.01" value={income} placeholder="0"
            onChange={e => setIncome(e.target.value)} className="x-input" style={{ height: 38 }} />
        </div>
        <button type="submit" disabled={busy} className="x-btn x-btn-secondary" style={{ height: 38 }}>
          {busy ? '…' : 'Check'}
        </button>
      </form>

      {error && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--x-neg)' }}>⚠ {error}</div>}
    </div>
  );
}
